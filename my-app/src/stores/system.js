// src/stores/system.js - SAFE INITIALIZATION VERSION
import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';

export const useSystemStore = defineStore('system', () => {
  // State
  const isLoading = ref(false);
  const isConnected = ref(false);
  const autoRefreshEnabled = ref(false);
  const error = ref(null);
  const hasInitialized = ref(false);
  
  // Status data with safe defaults
  const status = ref({
    battery: {
      soc: 0,
      power: 0,
      voltage: 0,
      temperature: 0,
      dailyCharge: 0,
      dailyDischarge: 0
    },
    grid: {
      power: 0,
      dailyImport: 0,
      dailyExport: 0
    },
    pv: {
      power: 0,
      pv1Power: 0,
      pv2Power: 0,
      pv3Power: 0,
      dailyEnergy: 0
    },
    load: {
      power: 0,
      dailyEnergy: 0
    }
  });

  // Base API URL
  const API_BASE_URL = 'http://localhost:3000/api';

  /**
   * Fetch current system status
   * ONLY call this when you KNOW the connection is available
   */
  async function fetchStatus() {
    // Don't fetch if we know we're disconnected
    if (!isConnected.value) {
      console.log('⏸️ Skipping fetchStatus - not connected');
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      console.log('📊 Fetching system status...');
      
      const response = await axios.get(`${API_BASE_URL}/alphaess/complete-status`);
      
      if (response.status === 503) {
        console.warn('⚠️ ModBus not connected (503)');
        isConnected.value = false;
        autoRefreshEnabled.value = false;
        error.value = 'ModBus connection not available';
        return;
      }

      // Update status with safe defaults
      const data = response.data;
      status.value = {
        battery: {
          soc: data.battery?.soc ?? 0,
          power: data.battery?.power ?? 0,
          voltage: data.battery?.voltage ?? 0,
          temperature: data.battery?.temperature ?? 0,
          dailyCharge: data.battery?.dailyCharge ?? 0,
          dailyDischarge: data.battery?.dailyDischarge ?? 0
        },
        grid: {
          power: data.grid?.power ?? 0,
          dailyImport: data.grid?.dailyImport ?? 0,
          dailyExport: data.grid?.dailyExport ?? 0
        },
        pv: {
          power: data.pv?.power ?? 0,
          pv1Power: data.pv?.pv1Power ?? 0,
          pv2Power: data.pv?.pv2Power ?? 0,
          pv3Power: data.pv?.pv3Power ?? 0,
          dailyEnergy: data.pv?.dailyEnergy ?? 0
        },
        load: {
          power: data.load?.power ?? 0,
          dailyEnergy: data.load?.dailyEnergy ?? 0
        }
      };

      isConnected.value = true;
      console.log('✅ Status fetched successfully');

    } catch (err) {
      console.error('❌ Error fetching status:', err);
      
      if (err.response?.status === 503) {
        isConnected.value = false;
        autoRefreshEnabled.value = false;
        error.value = 'ModBus connection not available';
      } else {
        error.value = err.message || 'Failed to fetch status';
      }
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Initialize store - try collector-status, fallback to complete-status
   */
  async function initialize() {
    // Only initialize once
    if (hasInitialized.value) {
      console.log('✓ Store already initialized');
      return isConnected.value;
    }

    console.log('🚀 Initializing system store...');
    isLoading.value = true;
    error.value = null;

    try {
      // Try collector-status endpoint first (lightweight)
      try {
        const response = await axios.get(`${API_BASE_URL}/alphaess/collector-status`, {
          timeout: 3000
        });
        
        if (response.data.connected) {
          console.log('✅ ModBus is connected (from collector-status)');
          isConnected.value = true;
          autoRefreshEnabled.value = true;
        } else {
          console.log('⚠️ ModBus is not connected (from collector-status)');
          isConnected.value = false;
          autoRefreshEnabled.value = false;
          error.value = response.data.message || 'ModBus not connected';
        }
      } catch (collectorError) {
        // Collector status endpoint doesn't exist - try complete-status as fallback
        console.log('ℹ️ Collector-status not available, checking complete-status...');
        
        try {
          const response = await axios.get(`${API_BASE_URL}/alphaess/complete-status`, {
            timeout: 3000
          });
          
          if (response.status === 503) {
            console.log('⚠️ ModBus is not connected (503 from complete-status)');
            isConnected.value = false;
            autoRefreshEnabled.value = false;
            error.value = 'ModBus connection not available';
          } else {
            console.log('✅ ModBus is connected (from complete-status)');
            isConnected.value = true;
            autoRefreshEnabled.value = true;
          }
        } catch (statusError) {
          if (statusError.response?.status === 503) {
            console.log('⚠️ ModBus is not connected (503)');
            isConnected.value = false;
            autoRefreshEnabled.value = false;
            error.value = 'ModBus connection not available';
          } else {
            // API server might be down
            console.warn('⚠️ Cannot reach API server');
            isConnected.value = false;
            autoRefreshEnabled.value = false;
            error.value = 'Cannot reach API server';
          }
        }
      }

      hasInitialized.value = true;
      return isConnected.value;

    } catch (err) {
      console.error('❌ Error initializing store:', err);
      error.value = err.message;
      isConnected.value = false;
      autoRefreshEnabled.value = false;
      hasInitialized.value = true;
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Handle connection restored (called by WebSocket)
   */
  function handleConnectionRestored() {
    console.log('🔄 Connection restored by WebSocket');
    isConnected.value = true;
    autoRefreshEnabled.value = true;
    error.value = null;
  }

  /**
   * Handle connection lost (called by WebSocket)
   */
  function handleConnectionLost() {
    console.log('⚠️ Connection lost (WebSocket notification)');
    isConnected.value = false;
    autoRefreshEnabled.value = false;
  }

  /**
   * Start auto-refresh (called by WebSocket when connection restored)
   */
  function startAutoRefresh() {
    console.log('▶️ Starting auto-refresh');
    autoRefreshEnabled.value = true;
  }

  /**
   * Stop auto-refresh (called by WebSocket when connection lost)
   */
  function stopAutoRefresh() {
    console.log('⏸️ Stopping auto-refresh');
    autoRefreshEnabled.value = false;
  }

  /**
   * Manual refresh - for retry button
   */
  async function manualRefresh() {
    console.log('🔄 Manual refresh requested');
    
    // Reset initialization to allow retry
    hasInitialized.value = false;
    
    // Try to check connection again
    await initialize();
    
    // If connected, fetch data
    if (isConnected.value) {
      await fetchStatus();
    }
  }

  return {
    // State
    isLoading,
    isConnected,
    autoRefreshEnabled,
    error,
    status,
    
    // Actions
    initialize,
    fetchStatus,
    handleConnectionRestored,
    handleConnectionLost,
    startAutoRefresh,
    stopAutoRefresh,
    manualRefresh
  };
});