// src/stores/realtime.js - Real-time Data Store (Cloud API → ModBus fallback)
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axios from 'axios';
import websocketService from '@/services/websocket';

export const useRealtimeStore = defineStore('realtime', () => {
  // Connection state
  const connectionSource = ref('disconnected'); // 'cloud', 'modbus', 'disconnected'
  const isConnected = computed(() => connectionSource.value !== 'disconnected');
  const isLoading = ref(false);
  const lastUpdate = ref(null);
  const error = ref(null);

  // Real-time data with safe defaults
  const data = ref({
    battery: {
      soc: 0,
      power: 0,
      voltage: 0,
      current: 0,
      temperature: 0,
      dailyCharge: 0,
      dailyDischarge: 0
    },
    grid: {
      power: 0,
      voltage: 0,
      current: 0,
      frequency: 0,
      dailyImport: 0,
      dailyExport: 0
    },
    pv: {
      power: 0,
      pv1Power: 0,
      pv2Power: 0,
      pv3Power: 0,
      voltage: 0,
      current: 0,
      dailyEnergy: 0
    },
    load: {
      power: 0,
      voltage: 0,
      current: 0,
      dailyEnergy: 0
    }
  });

  const API_BASE_URL = 'http://localhost:3000/api';

  /**
   * Initialize - NON-BLOCKING!
   * Tries Cloud API first, then ModBus, but doesn't fail if both unavailable
   */
  async function initialize() {
    console.log('🚀 Initializing realtime store (non-blocking)...');
    
    // Try Cloud API first
    const cloudConnected = await tryCloudAPI();
    if (cloudConnected) {
      console.log('✅ Using Cloud API for real-time data');
      connectionSource.value = 'cloud';
      startWebSocketListener();
      return true;
    }

    // Fallback to ModBus
    const modbusConnected = await tryModBus();
    if (modbusConnected) {
      console.log('✅ Using ModBus for real-time data');
      connectionSource.value = 'modbus';
      startWebSocketListener();
      return true;
    }

    // Neither available - that's OK! App still works
    console.log('ℹ️ No real-time data source available (Cloud API or ModBus)');
    connectionSource.value = 'disconnected';
    error.value = 'No real-time data available. Showing historical data only.';
    
    // Still start WebSocket to listen for connection restoration
    startWebSocketListener();
    
    return false;
  }

  /**
   * Try Cloud API connection
   */
  async function tryCloudAPI() {
    try {
      const response = await axios.get(`${API_BASE_URL}/alphaess/cloud-status`, {
        timeout: 3000
      });
      
      if (response.data && response.data.connected) {
        console.log('✅ Cloud API is available');
        return true;
      }
      
      console.log('ℹ️ Cloud API not available:', response.data?.message);
      return false;
    } catch (err) {
      console.log('ℹ️ Cloud API check failed:', err.message);
      return false;
    }
  }

  /**
   * Try ModBus connection
   */
  async function tryModBus() {
    try {
      const response = await axios.get(`${API_BASE_URL}/alphaess/modbus-status`, {
        timeout: 3000
      });
      
      if (response.data && response.data.connected) {
        console.log('✅ ModBus is available');
        return true;
      }
      
      console.log('ℹ️ ModBus not available:', response.data?.message);
      return false;
    } catch (err) {
      console.log('ℹ️ ModBus check failed:', err.message);
      return false;
    }
  }

  /**
   * Fetch current real-time data
   * Only called when we know connection is available
   */
  async function fetchData() {
    if (!isConnected.value) {
      console.log('⏸️ Skipping fetch - not connected');
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await axios.get(`${API_BASE_URL}/alphaess/realtime-data`);
      
      if (response.data) {
        updateData(response.data);
        console.log('✅ Real-time data updated');
      }
    } catch (err) {
      console.error('❌ Error fetching real-time data:', err);
      
      if (err.response?.status === 503) {
        handleConnectionLost();
      } else {
        error.value = err.message || 'Failed to fetch real-time data';
      }
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Update data (called by fetchData or WebSocket)
   */
  function updateData(newData) {
    data.value = {
      battery: {
        soc: newData.battery?.soc ?? data.value.battery.soc,
        power: newData.battery?.power ?? data.value.battery.power,
        voltage: newData.battery?.voltage ?? data.value.battery.voltage,
        current: newData.battery?.current ?? data.value.battery.current,
        temperature: newData.battery?.temperature ?? data.value.battery.temperature,
        dailyCharge: newData.battery?.dailyCharge ?? data.value.battery.dailyCharge,
        dailyDischarge: newData.battery?.dailyDischarge ?? data.value.battery.dailyDischarge
      },
      grid: {
        power: newData.grid?.power ?? data.value.grid.power,
        voltage: newData.grid?.voltage ?? data.value.grid.voltage,
        current: newData.grid?.current ?? data.value.grid.current,
        frequency: newData.grid?.frequency ?? data.value.grid.frequency,
        dailyImport: newData.grid?.dailyImport ?? data.value.grid.dailyImport,
        dailyExport: newData.grid?.dailyExport ?? data.value.grid.dailyExport
      },
      pv: {
        power: newData.pv?.power ?? data.value.pv.power,
        pv1Power: newData.pv?.pv1Power ?? data.value.pv.pv1Power,
        pv2Power: newData.pv?.pv2Power ?? data.value.pv.pv2Power,
        pv3Power: newData.pv?.pv3Power ?? data.value.pv.pv3Power,
        voltage: newData.pv?.voltage ?? data.value.pv.voltage,
        current: newData.pv?.current ?? data.value.pv.current,
        dailyEnergy: newData.pv?.dailyEnergy ?? data.value.pv.dailyEnergy
      },
      load: {
        power: newData.load?.power ?? data.value.load.power,
        voltage: newData.load?.voltage ?? data.value.load.voltage,
        current: newData.load?.current ?? data.value.load.current,
        dailyEnergy: newData.load?.dailyEnergy ?? data.value.load.dailyEnergy
      }
    };

    lastUpdate.value = new Date();
  }

  /**
   * Start WebSocket listener
   */
  function startWebSocketListener() {
    console.log('🔌 Starting WebSocket listener...');

    // Listen for connection status changes
    websocketService.on('connectionStatus', handleConnectionStatus);
    
    // Listen for real-time data updates
    websocketService.on('powerUpdate', handlePowerUpdate);
    
    // Listen for Cloud API events
    websocketService.on('cloudConnected', handleCloudConnected);
    websocketService.on('cloudDisconnected', handleCloudDisconnected);
    
    // Listen for ModBus events
    websocketService.on('modbusConnected', handleModbusConnected);
    websocketService.on('modbusDisconnected', handleModbusDisconnected);

    // Connect WebSocket
    websocketService.connect();
  }

  /**
   * Handle connection status from WebSocket
   */
  function handleConnectionStatus(statusData) {
    console.log('📊 Connection status:', statusData);
    
    if (statusData.cloud?.connected) {
      connectionSource.value = 'cloud';
      error.value = null;
    } else if (statusData.modbus?.connected) {
      connectionSource.value = 'modbus';
      error.value = null;
    } else {
      connectionSource.value = 'disconnected';
      error.value = 'No real-time data available';
    }
  }

  /**
   * Handle power update from WebSocket
   */
  function handlePowerUpdate(powerData) {
    updateData(powerData);
  }

  /**
   * Handle Cloud API connected
   */
  function handleCloudConnected() {
    console.log('🔄 Cloud API connected');
    connectionSource.value = 'cloud';
    error.value = null;
    fetchData(); // Get initial data
  }

  /**
   * Handle Cloud API disconnected
   */
  function handleCloudDisconnected() {
    console.log('⚠️ Cloud API disconnected, trying ModBus...');
    
    // Try ModBus as fallback
    tryModBus().then(connected => {
      if (connected) {
        connectionSource.value = 'modbus';
        error.value = null;
      } else {
        connectionSource.value = 'disconnected';
        error.value = 'Cloud API and ModBus unavailable';
      }
    });
  }

  /**
   * Handle ModBus connected
   */
  function handleModbusConnected() {
    console.log('🔄 ModBus connected');
    
    // Only switch to ModBus if Cloud isn't available
    if (connectionSource.value !== 'cloud') {
      connectionSource.value = 'modbus';
      error.value = null;
      fetchData(); // Get initial data
    }
  }

  /**
   * Handle ModBus disconnected
   */
  function handleModbusDisconnected() {
    console.log('⚠️ ModBus disconnected');
    
    // If we were using ModBus, mark as disconnected
    if (connectionSource.value === 'modbus') {
      connectionSource.value = 'disconnected';
      error.value = 'ModBus connection lost. Try Cloud API.';
    }
  }

  /**
   * Handle connection lost (called by errors)
   */
  function handleConnectionLost() {
    console.log('⚠️ Connection lost');
    connectionSource.value = 'disconnected';
    error.value = 'Connection lost. Retrying...';
  }

  /**
   * Manual refresh
   */
  async function refresh() {
    console.log('🔄 Manual refresh requested');
    await initialize();
    if (isConnected.value) {
      await fetchData();
    }
  }

  /**
   * Get connection info for display
   */
  const connectionInfo = computed(() => {
    return {
      source: connectionSource.value,
      isConnected: isConnected.value,
      statusText: connectionSource.value === 'cloud' 
        ? 'Connected (Cloud API)'
        : connectionSource.value === 'modbus'
        ? 'Connected (ModBus)'
        : 'Disconnected',
      statusColor: isConnected.value ? 'success' : 'warning'
    };
  });

  /**
   * Cleanup
   */
  function cleanup() {
    websocketService.off('connectionStatus', handleConnectionStatus);
    websocketService.off('powerUpdate', handlePowerUpdate);
    websocketService.off('cloudConnected', handleCloudConnected);
    websocketService.off('cloudDisconnected', handleCloudDisconnected);
    websocketService.off('modbusConnected', handleModbusConnected);
    websocketService.off('modbusDisconnected', handleModbusDisconnected);
  }

  return {
    // State
    data,
    connectionSource,
    isConnected,
    isLoading,
    lastUpdate,
    error,
    connectionInfo,

    // Actions
    initialize,
    fetchData,
    refresh,
    updateData,
    cleanup
  };
});