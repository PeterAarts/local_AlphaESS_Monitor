// src/stores/config.js - Configuration Store (loads once at startup)
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axios from 'axios';

export const useConfigStore = defineStore('config', () => {
  // Loading state
  const isLoaded = ref(false);
  const isLoading = ref(false);
  const error = ref(null);
  
  // Configuration data
  const selectedModel = ref(null);
  const modbusConfig = ref({
    ip: '',
    port: 502,
    slaveId: 85,
    enabled: false
  });
  const cloudApiConfig = ref({
    appId: '',
    systemSn: '',
    endpointUrl: 'https://openapi.alphaess.com/api',
    enabled: false
  });
  const setupCompleted = ref(false);

  const API_BASE_URL = 'http://localhost:3000/api';

  /**
   * Load all configuration from backend
   * Called once on app startup
   */
  async function loadConfiguration() {
    if (isLoaded.value) {
      console.log('✓ Configuration already loaded');
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      console.log('📥 Loading application configuration...');

      // Load setup status and selected model
      try {
        const setupResponse = await axios.get(`${API_BASE_URL}/setup/status`);
        setupCompleted.value = setupResponse.data.setupCompleted || false;
        selectedModel.value = setupResponse.data.selectedModel || null;

        console.log('✓ Setup status:', setupCompleted.value ? 'Complete' : 'Incomplete');
        if (selectedModel.value) {
          console.log('✓ Selected model:', selectedModel.value.manufacturer, selectedModel.value.model_name);
        }
      } catch (err) {
        console.error('❌ Error loading setup status:', err);
        setupCompleted.value = false;
        selectedModel.value = null;
      }

      // Load ModBus configuration
      try {
        const modbusResponse = await axios.get(`${API_BASE_URL}/settings/category/modbus`);
        if (modbusResponse.data) {
          modbusConfig.value = {
            ip: modbusResponse.data.ip_address || '',
            port: modbusResponse.data.port || 502,
            slaveId: modbusResponse.data.slave_id || 85,
            enabled: modbusResponse.data.enabled !== false
          };
          console.log('✓ ModBus config:', modbusConfig.value.ip || 'Not configured');
        }
      } catch (err) {
        console.log('ℹ️ No ModBus configuration found');
      }

      // Load Cloud API configuration
      try {
        const cloudResponse = await axios.get(`${API_BASE_URL}/settings/category/cloud_api`);
        if (cloudResponse.data) {
          cloudApiConfig.value = {
            appId: cloudResponse.data.app_id || '',
            systemSn: cloudResponse.data.system_sn || '',
            endpointUrl: cloudResponse.data.endpoint_url || 'https://openapi.alphaess.com/api',
            enabled: cloudResponse.data.enabled !== false
          };
          console.log('✓ Cloud API config:', cloudApiConfig.value.enabled ? 'Enabled' : 'Disabled');
        }
      } catch (err) {
        console.log('ℹ️ No Cloud API configuration found');
      }

      isLoaded.value = true;
      console.log('✅ Configuration loaded successfully');

    } catch (err) {
      console.error('❌ Error loading configuration:', err);
      error.value = err.message;
      
      // Still mark as loaded to prevent infinite loops
      isLoaded.value = true;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Reload configuration (for after settings changes)
   */
  async function reloadConfiguration() {
    isLoaded.value = false;
    await loadConfiguration();
  }

  /**
   * Update selected model
   */
  async function updateSelectedModel(modelId) {
    try {
      await axios.post(`${API_BASE_URL}/setup/select-model`, { modelId });
      
      // Reload to get updated model
      await reloadConfiguration();
      
      return true;
    } catch (err) {
      console.error('Error updating selected model:', err);
      return false;
    }
  }

  /**
   * Update ModBus configuration
   */
  async function updateModbusConfig(config) {
    try {
      await axios.post(`${API_BASE_URL}/settings/modbus`, config);
      
      // Update local state
      modbusConfig.value = { ...modbusConfig.value, ...config };
      
      return true;
    } catch (err) {
      console.error('Error updating ModBus config:', err);
      return false;
    }
  }

  /**
   * Update Cloud API configuration
   */
  async function updateCloudApiConfig(config) {
    try {
      await axios.post(`${API_BASE_URL}/settings/cloud-api`, config);
      
      // Update local state
      cloudApiConfig.value = { ...cloudApiConfig.value, ...config };
      
      return true;
    } catch (err) {
      console.error('Error updating Cloud API config:', err);
      return false;
    }
  }

  /**
   * Mark setup as completed
   */
  async function completeSetup() {
    try {
      await axios.post(`${API_BASE_URL}/setup/complete`);
      setupCompleted.value = true;
      return true;
    } catch (err) {
      console.error('Error completing setup:', err);
      return false;
    }
  }

  /**
   * Get configuration summary for display
   */
  const summary = computed(() => {
    return {
      setupCompleted: setupCompleted.value,
      hasModel: selectedModel.value !== null,
      hasModbus: modbusConfig.value.ip !== '',
      hasCloudApi: cloudApiConfig.value.appId !== '',
      model: selectedModel.value ? {
        name: `${selectedModel.value.manufacturer} ${selectedModel.value.model_name}`,
        battery: selectedModel.value.battery_capacity_kwh,
        mppt: selectedModel.value.mppt_inputs
      } : null,
      modbus: modbusConfig.value.enabled ? {
        ip: modbusConfig.value.ip,
        status: 'Enabled'
      } : { status: 'Disabled' },
      cloudApi: cloudApiConfig.value.enabled ? {
        appId: cloudApiConfig.value.appId,
        status: 'Enabled'
      } : { status: 'Disabled' }
    };
  });

  return {
    // State
    isLoaded,
    isLoading,
    error,
    selectedModel,
    modbusConfig,
    cloudApiConfig,
    setupCompleted,
    summary,
    
    // Actions
    loadConfiguration,
    reloadConfiguration,
    updateSelectedModel,
    updateModbusConfig,
    updateCloudApiConfig,
    completeSetup
  };
});