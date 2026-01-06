// src/stores/systemStore.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useSystemStore = defineStore('system', () => {
  // State
  const isConnected = ref(false);
  const autoRefreshEnabled = ref(true);
  const autoRefreshInterval = ref(null);
  const lastUpdate = ref(null);
  const systemData = ref({
    status: null,
    pvDetails: null,
    dispatchStatus: null
  });
  const error = ref(null);
  const isLoading = ref(false);

  // Computed
  const shouldAutoRefresh = computed(() => isConnected.value && autoRefreshEnabled.value);

  // Actions
  async function initialize() {
    console.log('🚀 Initializing system store...');
    
    // Try to load initial data
    const connected = await loadAllData();
    
    if (connected) {
      startAutoRefresh();
    } else {
      console.log('⚠️ ModBus not connected - auto-refresh disabled');
    }
    
    return connected;
  }

  async function loadAllData() {
    isLoading.value = true;
    error.value = null;
    
    try {
      // Try all three endpoints
      const [statusResult, pvResult, dispatchResult] = await Promise.allSettled([
        fetch('http://localhost:3000/api/alphaess/complete-status'),
        fetch('http://localhost:3000/api/alphaess/pv-details'),
        fetch('http://localhost:3000/api/alphaess/dispatch-status')
      ]);

      // Check if any returned 503
      const has503 = [statusResult, pvResult, dispatchResult].some(
        result => result.status === 'fulfilled' && result.value.status === 503
      );

      if (has503) {
        console.log('⚠️ Received 503 - ModBus not connected, disabling auto-refresh');
        isConnected.value = false;
        stopAutoRefresh();
        
        // Get error details from first 503 response
        const errorResponse = [statusResult, pvResult, dispatchResult].find(
          r => r.status === 'fulfilled' && r.value.status === 503
        );
        
        if (errorResponse) {
          const errorData = await errorResponse.value.json();
          error.value = errorData.message || 'ModBus connection not available';
        }
        
        return false;
      }

      // All successful - parse data
      if (statusResult.status === 'fulfilled' && statusResult.value.ok) {
        systemData.value.status = await statusResult.value.json();
      }
      
      if (pvResult.status === 'fulfilled' && pvResult.value.ok) {
        systemData.value.pvDetails = await pvResult.value.json();
      }
      
      if (dispatchResult.status === 'fulfilled' && dispatchResult.value.ok) {
        systemData.value.dispatchStatus = await dispatchResult.value.json();
      }

      isConnected.value = true;
      lastUpdate.value = new Date();
      return true;

    } catch (err) {
      console.error('❌ Error loading data:', err);
      error.value = err.message;
      isConnected.value = false;
      stopAutoRefresh();
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  function startAutoRefresh(interval = 5000) {
    // Stop existing interval if any
    stopAutoRefresh();

    if (!isConnected.value) {
      console.log('⚠️ Cannot start auto-refresh - not connected');
      return;
    }

    console.log(`✅ Starting auto-refresh (${interval}ms interval)`);
    autoRefreshEnabled.value = true;

    autoRefreshInterval.value = setInterval(async () => {
      if (shouldAutoRefresh.value) {
        await loadAllData();
      }
    }, interval);
  }

  function stopAutoRefresh() {
    if (autoRefreshInterval.value) {
      console.log('🛑 Stopping auto-refresh');
      clearInterval(autoRefreshInterval.value);
      autoRefreshInterval.value = null;
    }
    autoRefreshEnabled.value = false;
  }

  function handleConnectionRestored() {
    console.log('🔄 Connection restored - restarting auto-refresh');
    isConnected.value = true;
    error.value = null;
    
    // Immediately load fresh data
    loadAllData().then(connected => {
      if (connected) {
        startAutoRefresh();
      }
    });
  }

  function handleConnectionLost() {
    console.log('⚠️ Connection lost - stopping auto-refresh');
    isConnected.value = false;
    stopAutoRefresh();
  }

  // Manual refresh (always try, even if disconnected)
  async function manualRefresh() {
    console.log('🔄 Manual refresh triggered');
    return await loadAllData();
  }

  return {
    // State
    isConnected,
    autoRefreshEnabled,
    lastUpdate,
    systemData,
    error,
    isLoading,
    
    // Computed
    shouldAutoRefresh,
    
    // Actions
    initialize,
    loadAllData,
    startAutoRefresh,
    stopAutoRefresh,
    handleConnectionRestored,
    handleConnectionLost,
    manualRefresh
  };
});