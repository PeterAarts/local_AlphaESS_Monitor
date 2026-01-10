<template>
  <div class="settings-container">
    <div class="settings-content">
      <div class="settings-header">
        <h1>System Settings</h1>
        <div class="header-actions">
          <Button label="Reload" icon="pi pi-refresh" @click="loadSettings" :loading="loading" outlined />
          <Button label="Save All Changes" icon="pi pi-save" @click="saveSettings" :loading="saving" />
        </div>
      </div>

      <TabView>
        <!-- Cloud API Settings -->
        <TabPanel header="Cloud API">
          <div class="settings-panel">
            <div class="panel-header">
              <h3>AlphaESS Cloud API Configuration</h3>
              <p>Configure connection to open.alphaess.com for cloud-based monitoring</p>
            </div>

            <div class="form-grid">
              <!-- Credentials Row -->
              <div class="form-row">
                <div class="form-field">
                  <label for="cloud-appid">Application ID</label>
                  <InputText 
                    id="cloud-appid" 
                    v-model="settings.cloud_api.app_id" 
                    placeholder="Enter App ID"
                  />
                </div>

                <div class="form-field">
                  <label for="cloud-secret">Application Secret</label>
                  <InputText 
                    id="cloud-secret" 
                    v-model="settings.cloud_api.app_secret" 
                    type="password"
                    placeholder="Enter App Secret"
                  />
                  <small>Your secret key from open.alphaess.com</small>
                </div>

                <div class="form-field">
                  <label for="cloud-sn">System Serial Number</label>
                  <InputText 
                    id="cloud-sn" 
                    v-model="settings.cloud_api.system_sn" 
                    placeholder="AL1234567890123"
                  />
                </div>
              </div>

              <!-- Endpoint URL Row -->
              <div class="form-row">
                <div class="form-field">
                  <label for="cloud-endpoint">API Endpoint URL</label>
                  <InputText 
                    id="cloud-endpoint" 
                    v-model="settings.cloud_api.endpoint_url" 
                    placeholder="https://openapi.alphaess.com"
                  />
                  <small>Leave as default unless using alternative endpoint</small>
                </div>
              </div>

              <!-- Settings Row -->
              <div class="form-row">
                <div class="form-field form-field-small">
                  <label for="cloud-enabled">Status</label>
                  <div class="checkbox-field">
                    <Checkbox id="cloud-enabled" v-model="settings.cloud_api.enabled" :binary="true" />
                    <label for="cloud-enabled" class="checkbox-label">Enable Cloud API</label>
                  </div>
                </div>

                <div class="form-field form-field-small">
                  <label for="cloud-interval">Polling Interval (ms)</label>
                  <InputNumber id="cloud-interval" v-model="settings.cloud_api.poll_interval" :min="10000" :step="1000" placeholder="60000" />
                </div>

                <div class="form-field form-field-small">
                  <label>&nbsp;</label>
                  <Button label="Test Connection" icon="pi pi-check-circle" @click="testCloudConnection" :loading="testingCloud" outlined style="width: 100%;" />
                </div>
              </div>

              <small class="field-hint">Get credentials from <a href="https://open.alphaess.com" target="_blank">open.alphaess.com</a> → Developer → My Applications</small>
            </div>
          </div>
        </TabPanel>

        <!-- ModBus Settings -->
        <TabPanel header="ModBus">
          <div class="settings-panel">
            <div class="panel-header">
              <h3>Local ModBus/TCP Configuration</h3>
              <p>Configure direct connection to AlphaESS inverter via ModBus/TCP</p>
            </div>

            <!-- Current Model Info -->
            <div class="current-model-info" v-if="currentModbusModel">
              <div class="info-badge">
                <i class="pi pi-check-circle"></i>
                <span>Current Model: <strong>{{ currentModbusModel.manufacturer }} {{ currentModbusModel.model_name }}</strong></span>
              </div>
              <div class="model-details">
                <span>Battery: {{ currentModbusModel.battery_capacity_kwh }} kWh</span>
                <span>•</span>
                <span>{{ currentModbusModel.register_count || '50+' }} Registers</span>
                <span>•</span>
                <span>MPPT: {{ currentModbusModel.mppt_inputs }}</span>
              </div>
            </div>

            <div class="form-grid">
              <!-- Connection Row -->
              <div class="form-row">
                <div class="form-field">
                  <label for="modbus-ip">IP Address</label>
                  <InputText id="modbus-ip" v-model="settings.modbus.ip_address" placeholder="192.168.1.100" />
                </div>

                <div class="form-field form-field-small">
                  <label for="modbus-port">Port</label>
                  <InputNumber id="modbus-port" v-model="settings.modbus.port" :min="1" :max="65535" placeholder="502" />
                </div>

                <div class="form-field form-field-small">
                  <label for="modbus-slaveid">Slave ID</label>
                  <InputNumber id="modbus-slaveid" v-model="settings.modbus.slave_id" :min="1" :max="247" placeholder="85" />
                </div>
              </div>

              <!-- Settings Row -->
              <div class="form-row">
                <div class="form-field form-field-small">
                  <label for="modbus-enabled">Status</label>
                  <div class="checkbox-field">
                    <Checkbox id="modbus-enabled" v-model="settings.modbus.enabled" :binary="true" />
                    <label for="modbus-enabled" class="checkbox-label">Enable ModBus</label>
                  </div>
                </div>

                <div class="form-field form-field-small">
                  <label for="modbus-interval">Polling Interval (ms)</label>
                  <InputNumber id="modbus-interval" v-model="settings.modbus.poll_interval" :min="1000" :step="1000" placeholder="10000" />
                </div>

                <div class="form-field form-field-small">
                  <label>&nbsp;</label>
                  <Button label="Test Connection" icon="pi pi-check-circle" @click="testModbusConnection" :loading="testingModbus" outlined style="width: 100%;" />
                </div>
              </div>

              <small class="field-hint">Local IP address of your AlphaESS inverter (check your router for the correct IP)</small>
            </div>
          </div>
        </TabPanel>

        <!-- Data Collection Settings -->
        <TabPanel header="Data Collection">
          <div class="settings-panel">
            <div class="panel-header">
              <h3>Data Collection</h3>
              <p>Configure how data is collected and stored</p>
            </div>

            <div class="form-grid">
              <div class="form-row">
                <div class="form-field form-field-small">
                  <label for="primary-source">Primary Data Source</label>
                  <Dropdown 
                    id="primary-source" 
                    v-model="settings.data_collection.primary_source" 
                    :options="sourceOptions"
                    optionLabel="label"
                    optionValue="value"
                    style="width: 100%;"
                  />
                </div>

                <div class="form-field form-field-small">
                  <label for="enable-failover">Automatic Failover</label>
                  <div class="checkbox-field">
                    <Checkbox id="enable-failover" v-model="settings.data_collection.enable_failover" :binary="true" />
                    <label for="enable-failover" class="checkbox-label">Enable automatic source switching</label>
                  </div>
                </div>

                <div class="form-field form-field-small">
                  <label for="cache-timeout">Cache Timeout (ms)</label>
                  <InputNumber id="cache-timeout" v-model="settings.data_collection.cache_timeout" :min="60000" :step="60000" placeholder="300000" />
                </div>
              </div>
            </div>

            <div class="panel-header mt-4">
              <h3>Data Retention</h3>
              <p>Configure how long to keep historical data</p>
            </div>

            <div class="form-grid">
              <div class="form-row">
                <div class="form-field form-field-small">
                  <label for="retain-snapshots">Raw Snapshots (days)</label>
                  <InputNumber id="retain-snapshots" v-model="settings.retention.snapshots_days" :min="1" :max="30" placeholder="7" />
                </div>

                <div class="form-field form-field-small">
                  <label for="retain-minutes">Minute Aggregates (days)</label>
                  <InputNumber id="retain-minutes" v-model="settings.retention.minutes_days" :min="1" :max="90" placeholder="30" />
                </div>

                <div class="form-field form-field-small">
                  <label for="retain-hours">Hourly Aggregates (days)</label>
                  <InputNumber id="retain-hours" v-model="settings.retention.hours_days" :min="1" :max="365" placeholder="90" />
                </div>

                <div class="form-field form-field-small">
                  <label for="retain-daily">Daily Aggregates (years)</label>
                  <InputNumber id="retain-daily" v-model="settings.retention.daily_years" :min="1" :max="50" placeholder="10" />
                </div>
              </div>
            </div>
          </div>
        </TabPanel>

        <!-- System Settings -->
        <TabPanel header="System">
          <div class="settings-panel">
            <div class="panel-header">
              <h3>System Information</h3>
              <p>Basic system configuration</p>
            </div>

            <div class="form-grid">
              <div class="form-row">
                <div class="form-field">
                  <label for="system-name">System Name</label>
                  <InputText id="system-name" v-model="settings.system.system_name" placeholder="Alpha ESS Monitor" />
                </div>

                <div class="form-field">
                  <label for="location">Location</label>
                  <InputText id="location" v-model="settings.system.location" placeholder="e.g., Main House" />
                </div>

                <div class="form-field form-field-small">
                  <label for="timezone">Timezone</label>
                  <InputText id="timezone" v-model="settings.system.timezone" placeholder="UTC" />
                </div>
              </div>
            </div>

            <div class="panel-header mt-4">
              <h3>Change History</h3>
              <p>View all configuration changes</p>
            </div>

            <div class="form-grid">
              <Button label="View Change History" icon="pi pi-history" @click="loadHistory" outlined />
            </div>
          </div>
        </TabPanel>
      </TabView>
    </div>

    <!-- Test Results Dialog -->
    <Dialog v-model:visible="showTestResults" header="Connection Test" :style="{ width: '500px' }">
      <div class="test-results">
        <p>{{ testResults }}</p>
      </div>
      <template #footer>
        <Button label="Close" @click="showTestResults = false" />
      </template>
    </Dialog>

    <!-- History Dialog -->
    <Dialog v-model:visible="showHistory" header="Settings Change History" :style="{ width: '900px' }">
      <DataTable :value="history" paginator :rows="20" :loading="loadingHistory">
        <Column field="changed_at" header="Date/Time" :sortable="true">
          <template #body="slotProps">
            {{ formatDate(slotProps.data.changed_at) }}
          </template>
        </Column>
        <Column field="category" header="Category" :sortable="true" />
        <Column field="setting_key" header="Setting" :sortable="true" />
        <Column field="changed_by" header="Changed By" :sortable="true" />
        <Column field="change_reason" header="Reason" />
      </DataTable>
      <template #footer>
        <Button label="Close" @click="showHistory = false" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import axios from 'axios';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Checkbox from 'primevue/checkbox';
import Dropdown from 'primevue/dropdown';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Dialog from 'primevue/dialog';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Toast from 'primevue/toast';

const toast = useToast();

const settings = ref({
  cloud_api: {
    app_id: '',
    app_secret: '',
    system_sn: '',
    endpoint_url: 'https://openapi.alphaess.com',
    enabled: true,
    poll_interval: 60000
  },
  modbus: {
    ip_address: '',
    port: 502,
    slave_id: 85,
    enabled: false,
    poll_interval: 10000
  },
  data_collection: {
    primary_source: 'cloud',
    enable_failover: true,
    cache_timeout: 300000
  },
  retention: {
    snapshots_days: 7,
    minutes_days: 30,
    hours_days: 90,
    daily_years: 10
  },
  system: {
    system_name: 'Alpha ESS Monitor',
    location: '',
    timezone: 'UTC'
  }
});

const sourceOptions = [
  { label: 'Cloud API', value: 'cloud' },
  { label: 'ModBus', value: 'modbus' }
];

const loading = ref(false);
const saving = ref(false);
const testingCloud = ref(false);
const testingModbus = ref(false);
const showTestResults = ref(false);
const testResults = ref('');
const showHistory = ref(false);
const loadingHistory = ref(false);
const history = ref([]);
const currentModbusModel = ref(null);

const loadSettings = async () => {
  loading.value = true;
  try {
    const response = await axios.get('http://localhost:3000/api/settings/system');
    
    // Convert API response format to component format
    Object.keys(response.data).forEach(category => {
      if (settings.value[category]) {
        Object.keys(response.data[category]).forEach(key => {
          settings.value[category][key] = response.data[category][key].value;
        });
      }
    });

    toast.add({ 
      severity: 'success', 
      summary: 'Loaded', 
      detail: 'Settings loaded from database', 
      life: 2000 
    });
  } catch (error) {
    console.error('Error loading settings:', error);
    toast.add({ 
      severity: 'error', 
      summary: 'Error', 
      detail: 'Failed to load settings from database', 
      life: 5000 
    });
  } finally {
    loading.value = false;
  }
};

const saveSettings = async () => {
  saving.value = true;
  try {
    // Save each category to database
    for (const [category, values] of Object.entries(settings.value)) {
      await axios.put(`http://localhost:3000/api/settings/system/${category}`, {
        settings: values,
        changedBy: 'user',
        reason: 'Updated via Settings UI'
      });
    }

    // Reload data collector with new settings from database
    await axios.post('http://localhost:3000/api/settings/system/reload');

    toast.add({ 
      severity: 'success', 
      summary: 'Saved', 
      detail: 'All settings saved to database and applied', 
      life: 3000 
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    toast.add({ 
      severity: 'error', 
      summary: 'Error', 
      detail: error.response?.data?.error || 'Failed to save settings to database', 
      life: 5000 
    });
  } finally {
    saving.value = false;
  }
};

const testCloudConnection = async () => {
  testingCloud.value = true;
  
  // Log what we're about to send
  console.log('Testing Cloud API connection with:', {
    appId: settings.value.cloud_api.app_id,
    systemSn: settings.value.cloud_api.system_sn,
    endpointUrl: settings.value.cloud_api.endpoint_url,
    hasSecret: !!settings.value.cloud_api.app_secret
  });
  
  try {
    const response = await axios.post('http://localhost:3000/api/settings/test/cloud-connection', {
      appId: settings.value.cloud_api.app_id,
      appSecret: settings.value.cloud_api.app_secret,
      systemSn: settings.value.cloud_api.system_sn,
      endpointUrl: settings.value.cloud_api.endpoint_url
    });

    testResults.value = response.data.message || 'Connection successful!';
    showTestResults.value = true;
    
    toast.add({
      severity: 'success',
      summary: 'Connection Test',
      detail: 'Cloud API connection successful!',
      life: 3000
    });
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message;
    testResults.value = `Connection failed: ${errorMsg}`;
    showTestResults.value = true;
    
    toast.add({
      severity: 'error',
      summary: 'Connection Failed',
      detail: errorMsg,
      life: 5000
    });
    
    console.error('Cloud API test error:', error.response?.data || error);
  } finally {
    testingCloud.value = false;
  }
};

const testModbusConnection = async () => {
  testingModbus.value = true;
  try {
    const response = await axios.post('http://localhost:3000/api/settings/test/modbus-connection', {
      ip: settings.value.modbus.ip_address,
      port: settings.value.modbus.port,
      slaveId: settings.value.modbus.slave_id
    });

    testResults.value = response.data.message || 'Connection successful!';
    showTestResults.value = true;
  } catch (error) {
    testResults.value = `Connection failed: ${error.response?.data?.message || error.message}`;
    showTestResults.value = true;
  } finally {
    testingModbus.value = false;
  }
};

const loadHistory = async () => {
  showHistory.value = true;
  loadingHistory.value = true;
  try {
    const response = await axios.get('http://localhost:3000/api/settings/system/history?limit=100');
    history.value = response.data;
  } catch (error) {
    console.error('Error loading history:', error);
    toast.add({ 
      severity: 'error', 
      summary: 'Error', 
      detail: 'Failed to load change history', 
      life: 3000 
    });
  } finally {
    loadingHistory.value = false;
  }
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString();
};

onMounted(() => {
  loadSettings();
  loadCurrentModbusModel();
});

const loadCurrentModbusModel = async () => {
  try {
    const response = await axios.get('http://localhost:3000/api/setup/status');
    if (response.data.selectedModel) {
      currentModbusModel.value = response.data.selectedModel;
    }
  } catch (error) {
    console.error('Error loading current model:', error);
  }
};
</script>

<style scoped>
.settings-container {
  width: 100%;
  min-height: 100vh;
  background: #f8f9fa;
  padding: 0;
}

.settings-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e2e8f0;
}

.settings-header h1 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
  color: #1e293b;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.settings-panel {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.panel-header {
  margin-bottom: 1.5rem;
}

.panel-header h3 {
  margin: 0 0 0.25rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
}

.panel-header p {
  margin: 0;
  color: #64748b;
  font-size: 0.875rem;
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  align-items: end;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-field-small {
  max-width: 250px;
}

.form-field label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #475569;
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.checkbox-label {
  font-weight: 400 !important;
  margin: 0;
}

.field-hint {
  color: #64748b;
  font-size: 0.8125rem;
  margin-top: 0.5rem;
  display: block;
}

.field-hint a {
  color: #3b82f6;
  text-decoration: none;
}

.field-hint a:hover {
  text-decoration: underline;
}

.test-results {
  padding: 1rem;
  background: #f8fafc;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  white-space: pre-wrap;
  color: #334155;
}

.mt-4 {
  margin-top: 2rem;
}

/* Responsive */
@media (max-width: 1024px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .form-field-small {
    max-width: 100%;
  }
}

/* TabView styling */
:deep(.p-tabview-nav) {
  background: white;
  border-bottom: 2px solid #e2e8f0;
}

:deep(.p-tabview-panels) {
  background: transparent;
  padding: 1.5rem 0;
}

.current-model-info {
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.info-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #166534;
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.info-badge i {
  color: #22c55e;
}

.model-details {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #15803d;
  font-size: 0.875rem;
  margin-left: 1.75rem;
}
</style>