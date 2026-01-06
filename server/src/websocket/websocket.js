/**
 * WebSocket Server for Real-Time Power Data
 * Enhanced with ModBus connection monitoring and auto-refresh control
 * 
 * Features:
 * - Sends power data updates every 10 seconds
 * - Monitors ModBus connection state
 * - Broadcasts modbus_connected/modbus_disconnected events
 * - Maintains backward compatibility with existing data structure
 */

import { WebSocketServer } from 'ws';
import dataCollector from '../services/dataCollector.js';

class PowerDataWebSocketServer {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map to track client intervals
    this.lastModbusState = null;
    this.connectionCheckInterval = null;
  }

  /**
   * Initialize WebSocket server
   * @param {Object} options - Server options
   * @param {number} options.port - Server port (default: 3000)
   * @param {string} options.path - WebSocket path (default: /ws/power-data)
   */
  initialize(options = {}) {
    const { port = 3000, path = '/ws/power-data' } = options;

    this.wss = new WebSocketServer({ port, path });
    
    console.log(`✅ WebSocket server started on ws://localhost:${port}${path}`);

    // Set up connection handling
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Start monitoring ModBus connection state
    this.startConnectionMonitoring();
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    const clientIp = req.socket.remoteAddress;
    console.log(`📱 Client connected from ${clientIp}`);

    // Send initial connection status
    this.sendConnectionStatus(ws);

    // Send initial power data immediately
    this.sendPowerData(ws);

    // Set up periodic power data updates (every 10 seconds)
    const interval = setInterval(async () => {
      if (ws.readyState === ws.OPEN) {
        await this.sendPowerData(ws);
      } else {
        clearInterval(interval);
      }
    }, 10000); // 10 seconds

    // Store interval reference
    this.clients.set(ws, interval);

    // Handle incoming messages from client
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        this.handleClientMessage(ws, data);
      } catch (error) {
        console.error('Error parsing client message:', error);
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      console.log(`📱 Client disconnected from ${clientIp}`);
      const interval = this.clients.get(ws);
      if (interval) {
        clearInterval(interval);
        this.clients.delete(ws);
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      const interval = this.clients.get(ws);
      if (interval) {
        clearInterval(interval);
        this.clients.delete(ws);
      }
    });
  }

  /**
   * Handle messages from client
   */
  handleClientMessage(ws, data) {
    switch (data.type) {
      case 'ping':
        this.send(ws, { type: 'pong', timestamp: new Date().toISOString() });
        break;
      
      case 'request_status':
        this.sendConnectionStatus(ws);
        break;
      
      case 'request_power_data':
        this.sendPowerData(ws);
        break;
      
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  /**
   * Get current power data from dataCollector
   */
  async getCurrentPowerData() {
    try {
      const collectorStatus = dataCollector.getStatus();
      
      // If ModBus is not connected, return null or cached data
      if (!collectorStatus.connected) {
        return null;
      }

      // Get real data from dataCollector
      const completeStatus = await dataCollector.getCompleteStatus();
      
      // Transform alphaESS data to your expected format
      return this.transformToExpectedFormat(completeStatus);

    } catch (error) {
      console.error('Error getting power data:', error);
      return null;
    }
  }

  /**
   * Transform alphaESS data to expected WebSocket format
   */
  transformToExpectedFormat(alphaData) {
    // This is a sample transformation - adjust based on your actual alphaESS data structure
    return {
      batterySOC: alphaData.battery?.soc || 0,
      components: {
        grid: {
          currentIn: alphaData.grid?.power > 0 ? alphaData.grid.power : 0,
          currentOut: alphaData.grid?.power < 0 ? Math.abs(alphaData.grid.power) : 0,
          dailyIn: alphaData.grid?.dailyIn || 0,
          dailyOut: alphaData.grid?.dailyOut || 0
        },
        backup_unit: {
          currentIn: alphaData.backup?.powerIn || 0,
          currentOut: alphaData.backup?.powerOut || 0,
          dailyIn: alphaData.backup?.dailyIn || 0,
          dailyOut: alphaData.backup?.dailyOut || 0
        },
        solar_1: {
          currentOut: alphaData.pv?.pv1Power || 0,
          dailyOut: alphaData.pv?.pv1Energy || 0
        },
        solar_2: {
          currentOut: alphaData.pv?.pv2Power || 0,
          dailyOut: alphaData.pv?.pv2Energy || 0
        },
        solar_3: {
          currentOut: alphaData.pv?.pv3Power || 0,
          dailyOut: alphaData.pv?.pv3Energy || 0
        },
        home_usage: {
          currentIn: alphaData.load?.power || 0,
          dailyIn: alphaData.load?.dailyEnergy || 0
        },
        battery_1: {
          currentIn: alphaData.battery?.power > 0 ? alphaData.battery.power : 0,
          currentOut: alphaData.battery?.power < 0 ? Math.abs(alphaData.battery.power) : 0,
          dailyIn: alphaData.battery?.dailyCharge || 0,
          dailyOut: alphaData.battery?.dailyDischarge || 0
        }
      },
      flows: this.calculateFlows(alphaData)
    };
  }

  /**
   * Calculate power flows between components
   */
  calculateFlows(alphaData) {
    // Calculate flows based on actual power values
    // This is a simplified example - adjust based on your system logic
    return {
      'grid_to_backup_unit': {
        current: alphaData.grid?.power > 0 ? alphaData.grid.power : 0
      },
      'backup_unit_to_solar_1': {
        current: 0 // Solar doesn't receive power
      },
      'backup_unit_to_home_usage': {
        current: alphaData.load?.power || 0
      },
      'backup_unit_to_battery_1': {
        current: alphaData.battery?.power > 0 ? alphaData.battery.power : 0
      },
      'backup_unit_to_solar_2': {
        current: 0 // Solar doesn't receive power
      }
    };
  }

  /**
   * Send power data to client
   */
  async sendPowerData(ws) {
    const collectorStatus = dataCollector.getStatus();
    
    if (!collectorStatus.connected) {
      // Don't send power data when disconnected
      console.log('⚠️ Skipping power data - ModBus not connected');
      return;
    }

    try {
      const powerData = await this.getCurrentPowerData();
      
      if (powerData) {
        this.send(ws, {
          type: 'power_update',
          data: powerData,
          timestamp: new Date().toISOString()
        });
        console.log('📊 Power data sent:', new Date().toISOString());
      }
    } catch (error) {
      console.error('Error sending power data:', error);
    }
  }

  /**
   * Send connection status to client
   */
  sendConnectionStatus(ws) {
    const status = dataCollector.getStatus();
    
    this.send(ws, {
      type: 'connection_status',
      connected: status.connected,
      connectionStatus: status.connectionStatus,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Start monitoring ModBus connection state
   */
  startConnectionMonitoring() {
    // Check connection state every 5 seconds
    this.connectionCheckInterval = setInterval(() => {
      const currentState = dataCollector.getStatus().connected;
      
      // Detect state changes
      if (this.lastModbusState !== null && this.lastModbusState !== currentState) {
        if (currentState === true) {
          console.log('🔄 ModBus connection restored!');
          this.broadcastModbusConnected();
        } else {
          console.log('⚠️ ModBus connection lost!');
          this.broadcastModbusDisconnected();
        }
      }
      
      this.lastModbusState = currentState;
    }, 5000);
  }

  /**
   * Broadcast modbus_connected event to all clients
   */
  broadcastModbusConnected() {
    this.broadcast({
      type: 'modbus_connected',
      timestamp: new Date().toISOString(),
      message: 'ModBus connection restored - auto-refresh should restart'
    });
  }

  /**
   * Broadcast modbus_disconnected event to all clients
   */
  broadcastModbusDisconnected() {
    this.broadcast({
      type: 'modbus_disconnected',
      timestamp: new Date().toISOString(),
      message: 'ModBus connection lost - auto-refresh should stop'
    });
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(data) {
    const message = JSON.stringify(data);
    let sent = 0;

    this.wss.clients.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        ws.send(message);
        sent++;
      }
    });

    if (sent > 0) {
      console.log(`📡 Broadcast ${data.type} to ${sent} client(s)`);
    }
  }

  /**
   * Send message to specific client
   */
  send(ws, data) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Close WebSocket server
   */
  close() {
    console.log('🛑 Closing WebSocket server...');

    // Clear connection monitoring
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }

    // Clear all client intervals
    this.clients.forEach((interval) => {
      clearInterval(interval);
    });
    this.clients.clear();

    // Close all connections
    if (this.wss) {
      this.wss.clients.forEach(ws => {
        ws.close();
      });
      this.wss.close();
    }

    console.log('✅ WebSocket server closed');
  }
}

// Export singleton instance
export default new PowerDataWebSocketServer();

/* 
 * INTEGRATION NOTES:
 * 
 * 1. In your main app.js, initialize this WebSocket server:
 * 
 *    import websocketServer from './websocket/websocket.js';
 *    websocketServer.initialize({ port: 3000, path: '/ws/power-data' });
 * 
 * 2. The server will automatically:
 *    - Send power_update messages every 10 seconds
 *    - Monitor ModBus connection state
 *    - Broadcast modbus_connected/modbus_disconnected events
 * 
 * 3. Message types sent to clients:
 *    - connection_status: Current ModBus connection state
 *    - power_update: Power data in your existing format
 *    - modbus_connected: ModBus reconnected (triggers auto-refresh restart)
 *    - modbus_disconnected: ModBus disconnected (triggers auto-refresh stop)
 * 
 * 4. The power_update data structure matches your existing format:
 *    {
 *      type: 'power_update',
 *      data: {
 *        batterySOC: 75,
 *        components: { ... },
 *        flows: { ... }
 *      },
 *      timestamp: '2025-01-06T...'
 *    }
 * 
 * 5. Adjust transformToExpectedFormat() to match your actual alphaESS data structure
 */