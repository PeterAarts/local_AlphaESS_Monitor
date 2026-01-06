<!-- src/views/Dashboard.vue - With TabView -->
<template>
  <div class="dashboard-container">
    <!-- Header Section -->
    <div class="dashboard-header">
      <h1 class="dashboard-title">Dashboard</h1>
      <div class="date-navigation">
        <Button icon="pi pi-chevron-left" text rounded @click="previousDay" />
        <span class="current-date">{{ formatDate(currentDate) }}</span>
        <Button icon="pi pi-chevron-right" text rounded @click="nextDay" />
      </div>
    </div>

    <!-- Summary Section Headers -->
    <div class="summary-wrapper">
      <div class="section-header today-header">
        <h2 class="section-title">Today</h2>
      </div>
      <div class="section-header total-header">
        <h2 class="section-title">Total</h2>
      </div>
    </div>

    <!-- All Cards in One Row -->
    <div class="cards-grid">
      <!-- Today Cards -->
      <StatusCard
        title="Home & Solar"
        :icon="icons.home"
        titleClass="blue-text"
        cardClass="home-card"
        :stats="homeSolarStats"
      />

      <StatusCard
        title="Battery"
        :icon="icons.battery"
        titleClass="green-text"
        cardClass="battery-card"
        :stats="batteryStats"
      />

      <StatusCard
        title="Grid"
        :icon="icons.grid"
        titleClass="orange-text"
        cardClass="grid-card"
        :stats="gridStats"
      />

      <!-- Total Cards -->
      <StatusCard
        title="Economic"
        :icon="icons.eco"
        titleClass="orange-text"
        cardClass="economic-card"
        :stats="economicStats"
      />

      <StatusCard
        title="Green"
        :icon="icons.green"
        titleClass="green-text"
        cardClass="green-card"
        :stats="greenStats"
      />
    </div>

    <!-- TabView for Power Graph and Energy Diagram -->
    <Card class="diagram-card">
      <template #content>
        <TabView>
          <!-- Tab 1: Real-time Power Graph -->
          <TabPanel header="Real-time Power Graph">
            <div class="tab-content">
              <!-- Main Content with SoC and Diagram -->
              <div class="diagram-layout">
                <!-- Battery Status Panel (Left Side) -->
                <div class="soc-panel-wrapper">
                  <BatteryStatus
                    :soc="systemStore.status.battery.soc"
                    :power="systemStore.status.battery.power"
                    :voltage="systemStore.status.battery.voltage"
                    :temperature="systemStore.status.battery.temperature"
                    :showDetails="false"
                  />
                </div>

                <!-- Dynamic System Diagram (Right Side) -->
                <div class="diagram-wrapper">
                  <DynamicSystemDiagram
                    :powerData="systemStore.status"
                    mode="realtime"
                  />
                </div>
              </div>

              <!-- Power Statistics -->
              <div class="power-stats">
                <div class="stat-item">
                  <span class="stat-label">Grid:</span>
                  <span class="stat-value" :class="gridStatusClass">
                    {{ formatPower(systemStore.status.grid.power) }}
                  </span>
                  <span class="stat-status">{{ gridStatus }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Solar:</span>
                  <span class="stat-value solar-color">
                    {{ formatPower(systemStore.status.pv.power) }}
                  </span>
                  <span class="stat-status">Generating</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Battery:</span>
                  <span class="stat-value" :class="batteryStatusClass">
                    {{ formatPower(Math.abs(systemStore.status.battery.power)) }}
                  </span>
                  <span class="stat-status">{{ batteryStatus }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Load:</span>
                  <span class="stat-value load-color">
                    {{ formatPower(systemStore.status.load.power) }}
                  </span>
                  <span class="stat-status">Consuming</span>
                </div>
              </div>
            </div>
          </TabPanel>

          <!-- Tab 2: Energy Diagram -->
          <TabPanel header="Energy Diagram">
            <div class="tab-content">
              <div class="tab-header">
                <div class="date-range-picker">
                  <Calendar 
                    v-model="energyDateRange" 
                    selectionMode="range" 
                    dateFormat="yy-mm-dd"
                    :inline="false"
                    showButtonBar
                  />
                </div>
              </div>

              <!-- Dynamic System Diagram -->
              <DynamicSystemDiagram
                :powerData="energyFlowData"
                mode="energy"
              />

              <!-- Energy Flow Summary -->
              <div class="energy-summary">
                <div class="summary-row">
                  <div class="summary-col">
                    <div class="summary-label">Solar Generation</div>
                    <div class="summary-value solar-color">{{ formatEnergy(energyFlowData.solar) }}</div>
                  </div>
                  <div class="summary-col">
                    <div class="summary-label">Total Consumption</div>
                    <div class="summary-value load-color">{{ formatEnergy(energyFlowData.totalLoad) }}</div>
                  </div>
                  <div class="summary-col">
                    <div class="summary-label">Battery Charged</div>
                    <div class="summary-value battery-color">{{ formatEnergy(todaySummary.charged) }}</div>
                  </div>
                  <div class="summary-col">
                    <div class="summary-label">Grid Feed-in</div>
                    <div class="summary-value">{{ formatEnergy(energyFlowData.feedIn) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>
        </TabView>
      </template>
    </Card>

    <!-- Loading Overlay -->
    <div v-if="systemStore.isLoading" class="loading-overlay">
      <ProgressSpinner />
    </div>

    <!-- Toast for notifications -->
    <Toast />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useSystemStore } from '../stores/system';
import { useToast } from 'primevue/usetoast';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Calendar from 'primevue/calendar';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import ProgressSpinner from 'primevue/progressspinner';
import Toast from 'primevue/toast';

// Import custom components
import StatusCard from '../components/common/StatusCard.vue';
import BatteryStatus from '../components/dashboard/BatteryStatus.vue';
import DynamicSystemDiagram from '../components/dashboard/DynamicSystemDiagram.vue';
import { formatPower, formatEnergy } from '@/utils/formatters';

const systemStore = useSystemStore();
const toast = useToast();

// Icons
const icons = {
  home: new URL('@/assets/dashboard/stat-home.png', import.meta.url).href,
  battery: new URL('@/assets/dashboard/stat-battery.png', import.meta.url).href,
  grid: new URL('@/assets/dashboard/stat-grid.png', import.meta.url).href,
  eco: new URL('@/assets/dashboard/stat-eco.png', import.meta.url).href,
  green: new URL('@/assets/dashboard/stat-green.png', import.meta.url).href
};

// Current date for navigation
const currentDate = ref(new Date());
const energyDateRange = ref([new Date(), new Date()]);

// Mock data - Replace with real data from your API
const todaySummary = ref({
  consumed: 10.22,
  generation: 3.80,
  charged: 5.10,
  discharge: 7.30,
  feedIn: 0.37,
  gridConsumed: 4.59
});

const totalSummary = ref({
  selfConsumed: 100,
  selfSufficiency: 0,
  treesPlanted: 0.06,
  co2Reduction: 0.30
});

const energyFlowData = ref({
  solar: 3.8,
  solarToBattery: 1.5,
  solarToLoad: 1.1,
  solarToGrid: 0.4,
  batteryToLoad: 0.8,
  totalLoad: 10.2,
  feedIn: 0.4
});

// Computed stats for cards
const homeSolarStats = computed(() => [
  { label: 'Consumed', value: todaySummary.value.consumed, unit: 'kWh' },
  { label: 'Generation', value: todaySummary.value.generation, unit: 'kWh' }
]);

const batteryStats = computed(() => [
  { label: 'Charged', value: todaySummary.value.charged, unit: 'kWh' },
  { label: 'Discharge', value: todaySummary.value.discharge, unit: 'kWh' }
]);

const gridStats = computed(() => [
  { label: 'Feed-in', value: todaySummary.value.feedIn, unit: 'kWh' },
  { label: 'Consumed', value: todaySummary.value.gridConsumed, unit: 'kWh' }
]);

const economicStats = computed(() => [
  { label: 'Self-Consumed', value: totalSummary.value.selfConsumed, unit: '%' },
  { label: 'Self-Sufficiency', value: totalSummary.value.selfSufficiency, unit: '%' }
]);

const greenStats = computed(() => [
  { label: 'Trees Planted', value: totalSummary.value.treesPlanted, unit: '' },
  { label: 'CO2 Reduction', value: totalSummary.value.co2Reduction, unit: 'kg' }
]);

// Grid status
const gridStatus = computed(() => {
  if (systemStore.status.grid.power > 0) return 'Importing';
  if (systemStore.status.grid.power < 0) return 'Exporting';
  return 'Idle';
});

const gridStatusClass = computed(() => {
  if (systemStore.status.grid.power > 0) return 'grid-import';
  if (systemStore.status.grid.power < 0) return 'grid-export';
  return 'grid-idle';
});

// Battery status
const batteryStatus = computed(() => {
  if (systemStore.status.battery.power > 0) return 'Charging';
  if (systemStore.status.battery.power < 0) return 'Discharging';
  return 'Idle';
});

const batteryStatusClass = computed(() => {
  if (systemStore.status.battery.power > 0) return 'battery-charging';
  if (systemStore.status.battery.power < 0) return 'battery-discharging';
  return 'battery-idle';
});

// Date navigation
const previousDay = () => {
  currentDate.value = new Date(currentDate.value.setDate(currentDate.value.getDate() - 1));
  loadDashboardData();
};

const nextDay = () => {
  currentDate.value = new Date(currentDate.value.setDate(currentDate.value.getDate() + 1));
  loadDashboardData();
};

const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

// Load dashboard data
const loadDashboardData = async () => {
  try {
    await systemStore.fetchStatus();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load dashboard data',
      life: 5000
    });
  }
};

// Auto-refresh data
let refreshInterval;

onMounted(async () => {
  await loadDashboardData();
  
  // Refresh every 10 seconds
  refreshInterval = setInterval(() => {
    systemStore.fetchStatus();
  }, 10000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<style scoped>
.dashboard-container {
  padding: 1.5rem;
  max-width: 1900px;
  margin: 0 auto;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  min-height: 100vh;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.dashboard-title {
  font-size: 2rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.date-navigation {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: white;
  padding: 0.5rem 1rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.current-date {
  font-size: 1rem;
  font-weight: 600;
  color: #475569;
  min-width: 120px;
  text-align: center;
}

/* Summary Section Headers */
.summary-wrapper {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.section-header {
  padding-left: 0.5rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #475569;
  margin: 0;
  padding-left: 0.5rem;
  border-left: 4px solid #3b82f6;
}

/* All Cards in One Row */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
}

/* Diagram Card */
.diagram-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.tab-content {
  padding: 1rem 0;
}

.diagram-layout {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
  padding: 0 1rem;
  margin-bottom: 1.5rem;
}

.soc-panel-wrapper {
  flex-shrink: 0;
  width: 220px;
}

.diagram-wrapper {
  flex: 1;
  min-width: 0;
}

.tab-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
  padding: 0 1rem;
}

.data-source {
  font-size: 0.75rem;
  color: #9ca3af;
}

/* Power Statistics */
.power-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 12px;
}

.stat-item {
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.stat-value {
  display: block;
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.stat-status {
  display: block;
  font-size: 0.75rem;
  color: #9ca3af;
  text-transform: uppercase;
}

/* Energy Summary */
.energy-summary {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 12px;
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.summary-col {
  text-align: center;
}

.summary-label {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.summary-value {
  font-size: 1.125rem;
  font-weight: 700;
}

/* Color Classes */
.solar-color { color: #f59e0b; }
.battery-color { color: #10b981; }
.battery-charging { color: #10b981; }
.battery-discharging { color: #f59e0b; }
.battery-idle { color: #6b7280; }
.load-color { color: #3b82f6; }
.grid-import { color: #ef4444; }
.grid-export { color: #10b981; }
.grid-idle { color: #6b7280; }

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

/* Responsive Design */
@media (max-width: 1400px) {
  .cards-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  
  .summary-wrapper {
    grid-template-columns: 1fr;
  }
  
  .power-stats,
  .summary-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .cards-grid {
    grid-template-columns: 1fr;
  }
  
  .power-stats,
  .summary-row {
    grid-template-columns: 1fr;
  }
}
</style>