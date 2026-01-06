// src/services/dataCollector.js - Enhanced version with WebSocket support
import AlphaESSController from '../controllers/AlphaESSController.js';
import db from './database.js';

class DataCollector {
  constructor() {
    this.alphaESS = null;
    this.collectionInterval = null;
    this.aggregationInterval = null;
    this.dailyTasksTimeout = null;
    this.isRunning = false;
    this.currentDispatchId = null;
    this.connectionStatus = {
      connected: false,
      lastAttempt: null,
      errorMessage: null
    };
    this.websocketServer = null; // Will be set by app.js
  }

  // Method to inject WebSocket server reference
  setWebSocketServer(wss) {
    this.websocketServer = wss;
    console.log('✅ WebSocket server reference set in dataCollector');
  }

  async start(ip, port = 502, slaveId = 85, snapshotInterval = 10000) {
    if (this.isRunning) {
      console.log('⚠ Data collector already running');
      return;
    }

    console.log('🚀 Starting data collector...');

    // Try to connect to Alpha ESS
    try {
      this.alphaESS = new AlphaESSController(ip, port, slaveId);
      await this.alphaESS.connect();
      this.updateConnectionStatus(true, null);
    } catch (error) {
      console.error('❌ Initial AlphaESS connection failed:', error.message);
      this.updateConnectionStatus(false, error.message);
      await db.logEvent('connection_failed', `Initial connection failed: ${error.message}`, 'error');
      
      // Continue anyway - we'll try to reconnect periodically
      console.log('⚠ Data collector starting without ModBus connection (will retry)');
    }

    // Start snapshot collection
    this.collectionInterval = setInterval(async () => {
      try {
        // Try to reconnect if not connected
        if (!this.alphaESS || !this.alphaESS.connected) {
          console.log('🔄 Attempting to reconnect to AlphaESS...');
          try {
            if (!this.alphaESS) {
              this.alphaESS = new AlphaESSController(ip, port, slaveId);
            }
            await this.alphaESS.connect();
            
            // Connection restored!
            this.updateConnectionStatus(true, null);
            console.log('✅ Reconnected to AlphaESS');
            await db.logEvent('connection_restored', 'ModBus connection restored', 'info');
            
          } catch (reconnectError) {
            this.updateConnectionStatus(false, reconnectError.message);
            // Don't spam logs - just update status
            return;
          }
        }

        // Collect snapshot if connected
        if (this.alphaESS && this.alphaESS.connected) {
          await this.collectSnapshot();
        }
      } catch (error) {
        console.error('⌛ Error collecting snapshot:', error.message);
        await db.logEvent('data_collection_error', error.message, 'error');
        
        // Connection lost!
        if (this.alphaESS) {
          this.alphaESS.connected = false;
        }
        this.updateConnectionStatus(false, error.message);
      }
    }, snapshotInterval);

    // Start aggregation tasks (every minute)
    this.aggregationInterval = setInterval(async () => {
      try {
        await this.runAggregations();
      } catch (error) {
        console.error('⌛ Error running aggregations:', error.message);
      }
    }, 60000);

    // Schedule daily tasks
    this.scheduleDailyTasks();

    this.isRunning = true;
    await db.logEvent('system_start', 'Data collection started', 'info');
    console.log('✅ Data collector started successfully');
  }

  updateConnectionStatus(connected, errorMessage) {
    const wasConnected = this.connectionStatus.connected;
    
    this.connectionStatus = {
      connected,
      lastAttempt: new Date(),
      errorMessage
    };

    // Detect state change
    if (wasConnected !== connected) {
      console.log(`🔄 Connection state changed: ${wasConnected} -> ${connected}`);
      
      // Notify WebSocket server if available
      if (this.websocketServer) {
        if (connected) {
          this.websocketServer.broadcastModbusConnected();
        } else {
          this.websocketServer.broadcastModbusDisconnected();
        }
      }
    }
  }

  async collectSnapshot() {
    const status = await this.alphaESS.getCompleteStatus();
    await db.storeSnapshot(status);
    
    // Log to console every 10 snapshots (reduce noise)
    if (!this.snapshotCount) this.snapshotCount = 0;
    this.snapshotCount++;
    
    if (this.snapshotCount % 10 === 0) {
      console.log(`📊 Snapshot #${this.snapshotCount} - Battery: ${status.battery.soc}% | PV: ${status.pv.power}W | Grid: ${status.grid.power}W`);
    }
  }

  async runAggregations() {
    console.log('🔄 Running aggregations...');
    await db.aggregateToMinutes();
    await db.aggregateToHours();
  }

  scheduleDailyTasks() {
    const now = new Date();
    const night = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0, 5, 0, 0 // 00:05 AM
    );
    const msToMidnight = night.getTime() - now.getTime();

    console.log(`⏰ Daily tasks scheduled for ${night.toLocaleTimeString()}`);

    this.dailyTasksTimeout = setTimeout(() => {
      this.runDailyTasks();
      // Then run daily at 00:05
      this.aggregationInterval = setInterval(() => this.runDailyTasks(), 24 * 60 * 60 * 1000);
    }, msToMidnight);
  }

  async runDailyTasks() {
    console.log('🌙 Running daily aggregation tasks...');

    try {
      await db.aggregateToDaily();
      const deleted = await db.cleanupOldSnapshots(7);
      console.log(`✅ Daily aggregation completed, cleaned up ${deleted} old snapshots`);
      await db.logEvent('daily_aggregation', `Completed, cleaned ${deleted} snapshots`, 'info');
    } catch (error) {
      console.error('⌛ Error in daily tasks:', error.message);
      await db.logEvent('daily_aggregation_error', error.message, 'error');
    }
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping data collector...');

    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }

    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }

    if (this.dailyTasksTimeout) {
      clearTimeout(this.dailyTasksTimeout);
    }

    if (this.alphaESS) {
      await this.alphaESS.disconnect();
    }

    this.isRunning = false;
    await db.logEvent('system_stop', 'Data collection stopped', 'info');
    console.log('✅ Data collector stopped');
  }

  getStatus() {
    return {
      running: this.isRunning,
      connected: this.alphaESS ? this.alphaESS.connected : false,
      currentDispatch: this.currentDispatchId,
      snapshotCount: this.snapshotCount || 0,
      connectionStatus: this.connectionStatus
    };
  }

  // Check if ModBus is connected and throw appropriate error
  _ensureConnected() {
    if (!this.alphaESS || !this.alphaESS.connected) {
      const error = new Error('AlphaESS ModBus connection not available. Please check the inverter connection.');
      error.code = 'MODBUS_NOT_CONNECTED';
      error.statusCode = 503; // Service Unavailable
      error.details = this.connectionStatus;
      throw error;
    }
  }

  // Wrapper methods that also log to database
  async chargeFromGrid(watts, targetSOC, durationHours, triggeredBy = 'manual') {
    this._ensureConnected();
    
    const durationSeconds = durationHours * 3600;
    const result = await this.alphaESS.chargeFromGrid(watts, targetSOC, durationSeconds);

    this.currentDispatchId = await db.logDispatchStart(
      'charge_from_grid',
      watts,
      targetSOC,
      durationSeconds,
      triggeredBy
    );

    await db.logEvent('dispatch_start', `Charging at ${watts}W to ${targetSOC}%`, 'info', result);

    // Auto-end after duration
    setTimeout(async () => {
      if (this.currentDispatchId) {
        await db.logDispatchEnd(this.currentDispatchId, null);
        this.currentDispatchId = null;
        await db.logEvent('dispatch_end', 'Charge completed (timeout)', 'info');
      }
    }, durationSeconds * 1000);

    return result;
  }

  async dischargeToGrid(watts, minimumSOC, durationHours, triggeredBy = 'manual') {
    this._ensureConnected();
    
    const durationSeconds = durationHours * 3600;
    const result = await this.alphaESS.dischargeToGrid(watts, minimumSOC, durationSeconds);

    this.currentDispatchId = await db.logDispatchStart(
      'discharge_to_grid',
      watts,
      minimumSOC,
      durationSeconds,
      triggeredBy
    );

    await db.logEvent('dispatch_start', `Discharging at ${watts}W to ${minimumSOC}%`, 'info', result);

    setTimeout(async () => {
      if (this.currentDispatchId) {
        await db.logDispatchEnd(this.currentDispatchId, null);
        this.currentDispatchId = null;
        await db.logEvent('dispatch_end', 'Discharge completed (timeout)', 'info');
      }
    }, durationSeconds * 1000);

    return result;
  }

  async stopDispatch() {
    this._ensureConnected();
    
    const result = await this.alphaESS.stopDispatch();

    if (this.currentDispatchId) {
      await db.logDispatchEnd(this.currentDispatchId, null);
      this.currentDispatchId = null;
    }

    await db.logEvent('dispatch_stop', 'Dispatch mode stopped manually', 'info', result);

    return result;
  }

  async preventDischarge() {
    this._ensureConnected();
    
    const result = await this.alphaESS.preventGridDischarge();
    await db.logEvent('dispatch_start', 'Grid discharge prevented', 'info', result);
    return result;
  }

  async normalOperation() {
    return this.stopDispatch();
  }

  // Pass-through methods with connection checking
  async getCompleteStatus() {
    this._ensureConnected();
    return this.alphaESS.getCompleteStatus();
  }

  async getPVDetails() {
    this._ensureConnected();
    return this.alphaESS.getACCoupledPVPower();
  }

  async getDispatchConfig() {
    this._ensureConnected();
    return this.alphaESS.getDispatchConfig();
  }
}

export default new DataCollector();