<!-- src/components/dashboard/DynamicSystemDiagram-v5.vue - FULLY DYNAMIC -->
<template>
  <div class="dynamic-system-diagram">
    <!-- Controls -->
    <div class="diagram-controls">
      <!-- Debug Info -->
      <div v-if="showDebug" class="debug-info">
        <p>Components: {{ components.length }}</p>
        <p>Locations: {{ locationsList.length }}</p>
        <p>Flows: {{ flows.length }}</p>
      </div>

      <!-- View Mode Selector -->
      <div class="view-mode-selector">
        <label class="mode-label">View Mode:</label>
        <SelectButton v-model="viewMode" :options="viewModeOptions" optionLabel="label" optionValue="value" />
      </div>
    </div>

    <!-- Main Grid - Dynamically Generated -->
    <div class="diagram-grid" :style="gridStyle" ref="diagramGrid">
      <!-- Dynamically create columns for each location -->
      <div
        v-for="(location, index) in locationsList"
        :key="location.key"
        :ref="el => { if (el) locationRefs[location.key] = el }"
        class="grid-column"
      >
        <div 
          :class="['location-box', `location-${location.key}`]"
          :style="getLocationStyle(location)"
        >
          <h3 class="location-title">{{ location.label }}</h3>
          
          <div class="location-content">
            <!-- Parent Components (main components like Grid, Backup Unit) -->
            <div v-if="location.parents.length > 0" class="parent-section">
              <div
                v-for="parent in location.parents"
                :key="parent.component_key"
                :ref="el => { if (el) componentRefs[parent.component_key] = el }"
                :class="['component-box', `component-${parent.type}`]"
                :style="getComponentStyle(parent)"
              >
                <div class="component-name">{{ formatComponentName(parent.name) }}</div>
                <div v-if="parent.powerValue" class="component-value">
                  {{ formatPower(parent.powerValue) }}
                </div>
              </div>
            </div>

            <!-- Group Components (Solar, Battery, Home Usage) -->
            <div v-if="location.groups.length > 0" class="groups-section">
              <div
                v-for="group in location.groups"
                :key="group.component_key"
                :ref="el => { if (el) componentRefs[group.component_key] = el }"
                :class="['group-box', `group-${group.type}`]"
                :style="getGroupStyle(group)"
              >
                <div class="group-name">{{ formatComponentName(group.name) }}</div>
                
                <!-- Devices (only in detailed mode) -->
                <div v-if="viewMode === 'detailed' && group.devices && group.devices.length > 0" class="devices-row">
                  <div
                    v-for="device in group.devices"
                    :key="device.component_key"
                    :class="['device-box', `device-${device.type}`]"
                  >
                    {{ formatDeviceName(device.name) }}
                  </div>
                </div>

                <div v-if="group.powerValue" class="group-value">
                  {{ formatPower(group.powerValue) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SVG Overlay for Connection Lines -->
    <svg 
      ref="svgCanvas"
      class="connections-overlay" 
      :width="svgWidth" 
      :height="svgHeight"
    >
      <defs>
        <marker id="arrowhead-green" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
          <polygon points="0 0, 10 3, 0 6" fill="#4a7c59" />
        </marker>
        <marker id="arrowhead-orange" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
          <polygon points="0 0, 10 3, 0 6" fill="#f97316" />
        </marker>
        <marker id="arrowhead-blue" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
          <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" />
        </marker>
      </defs>

      <!-- Dynamically generated connection lines -->
      <g v-for="line in connectionLines" :key="line.id">
        <path
          :d="line.path"
          :stroke="line.color"
          :stroke-width="line.width"
          :stroke-dasharray="line.dashed ? '5,5' : 'none'"
          fill="none"
          :marker-end="line.showArrow ? `url(#arrowhead-${line.arrowColor})` : 'none'"
        />
        
        <!-- Reverse arrow for bidirectional -->
        <polygon
          v-if="line.bidirectional && line.reverseArrowPoints"
          :points="line.reverseArrowPoints"
          :fill="line.color"
        />
      </g>
    </svg>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import SelectButton from 'primevue/selectbutton';
import systemArchitectureService from '@/services/systemArchitecture';

const props = defineProps({
  powerData: {
    type: Object,
    default: () => ({})
  },
  mode: {
    type: String,
    default: 'realtime'
  }
});

const showDebug = ref(false);
const viewMode = ref('simple');
const components = ref([]);
const flows = ref([]);
const diagramGrid = ref(null);
const svgCanvas = ref(null);
const locationRefs = ref({});
const componentRefs = ref({});
const svgWidth = ref(1200);
const svgHeight = ref(600);

const viewModeOptions = [
  { label: 'Simple', value: 'simple' },
  { label: 'Detailed', value: 'detailed' }
];

// Load architecture from database
onMounted(async () => {
  await loadArchitecture();
  await nextTick();
  calculateConnectionLines();
  
  // Recalculate lines on window resize
  window.addEventListener('resize', calculateConnectionLines);
});

const loadArchitecture = async () => {
  try {
    // FORCE REFRESH - clear cache
    systemArchitectureService.clearCache();
    
    // Load from service with force refresh
    const arch = await systemArchitectureService.getArchitecture(true);
    console.log('📦 Loaded architecture:', arch);
    
    if (!arch || !arch.levels || arch.levels.length === 0) {
      console.warn('⚠️ Invalid or empty architecture, using fallback');
      loadFallbackData();
      return;
    }
    
    // Log what we got from API
    console.log('📊 Levels from API:', arch.levels.map(l => `${l.label}(${l.components.length})`).join(', '));
    
    // Extract components from levels
    const allComps = [];
    const flowList = [];
    let flowId = 0;
    
    arch.levels.forEach(level => {
      console.log(`📍 Processing level: ${level.label} with ${level.components.length} components`);
      
      level.components.forEach(comp => {
        // Add main component
        allComps.push({
          component_key: comp.component_key,
          name: comp.name,
          type: comp.type,
          category: comp.category,
          location_type: level.name,
          location_label: level.label,
          parent_id: null,
          color: comp.color,
          data_source: comp.dataSource,
          specs: comp.specs
        });
        
        // Add subcomponents as devices
        if (comp.subComponents && comp.subComponents.length > 0) {
          comp.subComponents.forEach(sub => {
            allComps.push({
              component_key: sub.component_key,
              name: sub.name,
              type: sub.type,
              category: 'device',
              parent_id: comp.component_key,
              location_type: level.name,
              location_label: level.label,
              specs: sub.specs
            });
          });
        }
        
        // Add flows
        if (comp.flowTo && comp.flowTo.length > 0) {
          comp.flowTo.forEach(targetKey => {
            flowList.push({
              id: flowId++,
              from: comp.component_key,
              to: targetKey,
              type: 'primary',
              bidirectional: comp.flowDirection === 'bidirectional',
              color: comp.flowColor
            });
          });
        }
      });
    });
    
    console.log(`✅ Extracted ${allComps.length} components and ${flowList.length} flows`);
    
    // Verify we have data
    if (allComps.length === 0) {
      console.warn('⚠️ No components extracted, using fallback');
      loadFallbackData();
      return;
    }
    
    components.value = allComps;
    flows.value = flowList;
    
    console.log('✅ Architecture loaded successfully');
    console.log('📋 Components:', components.value.map(c => `${c.name}(${c.location_type})`).join(', '));
    
  } catch (error) {
    console.error('❌ Failed to load architecture:', error);
    loadFallbackData();
  }
};

const loadFallbackData = () => {
  components.value = [
    { component_key: 'grid', name: 'Grid', type: 'grid', category: 'main', location_type: 'external', location_label: 'External', parent_id: null, color: '#1e5a78' },
    { component_key: 'backup_unit', name: 'Backup\nunit', type: 'backup_unit', category: 'main', location_type: 'main_house', location_label: 'House', parent_id: null, color: '#1e5a78' },
    { component_key: 'home_usage', name: 'Home\nUsage', type: 'home_usage', category: 'group', location_type: 'main_house', location_label: 'House', parent_id: null, color: '#3b82f6' },
    { component_key: 'solar_1', name: 'Solar 1', type: 'solar_system', category: 'group', location_type: 'main_house', location_label: 'House', parent_id: null, color: '#93c5fd' },
    { component_key: 'solar_1_inverter', name: 'Inverter', type: 'inverter', category: 'device', parent_id: 'solar_1', color: '#4a7c59' },
    { component_key: 'solar_1_panels', name: 'Solar Panels', type: 'solar_panels', category: 'device', parent_id: 'solar_1', color: '#4a7c59' },
    { component_key: 'battery_1', name: 'Battery 1', type: 'battery_system', category: 'group', location_type: 'main_house', location_label: 'House', parent_id: null, color: '#6ee7b7' },
    { component_key: 'battery_1_inverter', name: 'Inverter', type: 'inverter', category: 'device', parent_id: 'battery_1', color: '#4a7c59' },
    { component_key: 'battery_1_pack', name: 'Battery', type: 'battery_pack', category: 'device', parent_id: 'battery_1', color: '#4a7c59' },
    { component_key: 'solar_2', name: 'Solar 2', type: 'solar_system', category: 'group', location_type: 'building_a', location_label: 'Building A', parent_id: null, color: '#93c5fd' },
    { component_key: 'solar_2_inverter', name: 'Inverter', type: 'inverter', category: 'device', parent_id: 'solar_2', color: '#4a7c59' },
    { component_key: 'solar_2_panels', name: 'Solar Panels', type: 'solar_panels', category: 'device', parent_id: 'solar_2', color: '#4a7c59' },
    { component_key: 'solar_3', name: 'Solar 3', type: 'solar_system', category: 'group', location_type: 'building_b', location_label: 'Building B', parent_id: null, color: '#93c5fd' },
    { component_key: 'solar_3_panels', name: 'Solar Panels', type: 'solar_panels', category: 'device', parent_id: 'solar_3', color: '#4a7c59' }
  ];
  
  flows.value = [
    { id: 1, from: 'grid', to: 'backup_unit', type: 'primary', bidirectional: true },
    { id: 2, from: 'backup_unit', to: 'home_usage', type: 'primary', bidirectional: false },
    { id: 3, from: 'solar_1', to: 'backup_unit', type: 'primary', bidirectional: false },
    { id: 4, from: 'battery_1', to: 'backup_unit', type: 'primary', bidirectional: true },
    { id: 5, from: 'solar_2', to: 'backup_unit', type: 'secondary', bidirectional: false },
    { id: 6, from: 'solar_3', to: 'battery_1', type: 'secondary', bidirectional: false }
  ];
};

// Group components by location
const locationsList = computed(() => {
  const locationsMap = {};
  
  console.log('🗺️ Building locationsList from', components.value.length, 'components');
  
  components.value.forEach(comp => {
    if (!comp.parent_id && comp.location_type) {
      const key = comp.location_type;
      
      if (!locationsMap[key]) {
        locationsMap[key] = {
          key,
          label: comp.location_label || key,
          parents: [],
          groups: []
        };
        console.log(`  📍 Created location: ${key} (${comp.location_label})`);
      }
      
      if (comp.category === 'main' || comp.category === 'external') {
        locationsMap[key].parents.push(comp);
        console.log(`    ├─ Added parent: ${comp.name}`);
      } else if (comp.category === 'group') {
        // Get child devices
        const devices = components.value.filter(c => c.parent_id === comp.component_key);
        locationsMap[key].groups.push({
          ...comp,
          devices
        });
        console.log(`    ├─ Added group: ${comp.name} with ${devices.length} devices`);
      }
    }
  });
  
  // Sort locations: external, main_house, then others
  const sorted = Object.values(locationsMap).sort((a, b) => {
    const order = { external: 0, main_house: 1 };
    const aOrder = order[a.key] ?? 2;
    const bOrder = order[b.key] ?? 2;
    return aOrder - bOrder;
  });
  
  console.log('🗺️ Final locations:', sorted.map(l => `${l.label}(${l.parents.length}p + ${l.groups.length}g)`).join(', '));
  
  return sorted;
});

// Grid style
const gridStyle = computed(() => ({
  gridTemplateColumns: locationsList.value.map(() => 'auto').join(' '),
  gap: '1.5rem',
  justifyContent: 'start'
}));

// Get location-specific styles
const getLocationStyle = (location) => {
  const baseStyle = {
    borderColor: '#d1d5db',
    borderWidth: '2px'
  };
  
  if (location.key === 'main_house') {
    baseStyle.borderColor = '#1e5a78';
    baseStyle.borderWidth = '3px';
  }
  
  return baseStyle;
};

// Get component-specific styles
const getComponentStyle = (component) => {
  return {
    backgroundColor: component.color || '#1e5a78',
    color: 'white'
  };
};

// Get group-specific styles
const getGroupStyle = (group) => {
  const colors = {
    solar_system: { bg: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', border: '#93c5fd' },
    battery_system: { bg: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', border: '#6ee7b7' },
    home_usage: { bg: '#3b82f6', border: '#3b82f6' }
  };
  
  const style = colors[group.type] || { bg: '#f3f4f6', border: '#d1d5db' };
  
  return {
    background: style.bg,
    borderColor: style.border
  };
};

// Format component name
const formatComponentName = (name) => {
  return name || '';
};

// Format device name
const formatDeviceName = (name) => {
  return name.toLowerCase().replace('solar ', '');
};

// Format power value
const formatPower = (value) => {
  if (!value) return '0 W';
  const absValue = Math.abs(value);
  if (absValue >= 1000) {
    return `${(absValue / 1000).toFixed(2)} kW`;
  }
  return `${absValue.toFixed(0)} W`;
};

// Calculate connection lines dynamically
const connectionLines = ref([]);

const calculateConnectionLines = async () => {
  await nextTick();
  
  if (!svgCanvas.value || !diagramGrid.value) return;
  
  const gridRect = diagramGrid.value.getBoundingClientRect();
  svgWidth.value = gridRect.width;
  svgHeight.value = gridRect.height;
  
  const lines = [];
  
  flows.value.forEach(flow => {
    const fromEl = componentRefs.value[flow.from];
    const toEl = componentRefs.value[flow.to];
    
    if (!fromEl || !toEl) return;
    
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    
    // Calculate relative positions
    const x1 = fromRect.right - gridRect.left;
    const y1 = fromRect.top + fromRect.height / 2 - gridRect.top;
    const x2 = toRect.left - gridRect.left;
    const y2 = toRect.top + toRect.height / 2 - gridRect.top;
    
    // Determine line properties based on flow type
    const isRemote = flow.type === 'secondary';
    const color = flow.bidirectional ? '#f97316' : '#4a7c59';
    const arrowColor = flow.bidirectional ? 'orange' : 'green';
    
    // Create path
    const path = `M ${x1} ${y1} L ${x2} ${y2}`;
    
    lines.push({
      id: flow.id,
      path,
      color,
      width: 2,
      dashed: isRemote,
      showArrow: true,
      arrowColor,
      bidirectional: flow.bidirectional,
      reverseArrowPoints: flow.bidirectional ? calculateReverseArrow(x1, y1, x2, y2) : null
    });
  });
  
  connectionLines.value = lines;
};

const calculateReverseArrow = (x1, y1, x2, y2) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const arrowLength = 10;
  const arrowWidth = 6;
  
  const tipX = x1 + 15;
  const tipY = y1;
  
  const base1X = tipX + arrowLength * Math.cos(angle + Math.PI);
  const base1Y = tipY + arrowLength * Math.sin(angle + Math.PI);
  const base2X = tipX + arrowLength * Math.cos(angle + Math.PI);
  const base2Y = tipY + arrowLength * Math.sin(angle + Math.PI);
  
  const perpAngle = angle + Math.PI / 2;
  const corner1X = base1X + (arrowWidth / 2) * Math.cos(perpAngle);
  const corner1Y = base1Y + (arrowWidth / 2) * Math.sin(perpAngle);
  const corner2X = base2X - (arrowWidth / 2) * Math.cos(perpAngle);
  const corner2Y = base2Y - (arrowWidth / 2) * Math.sin(perpAngle);
  
  return `${tipX},${tipY} ${corner1X},${corner1Y} ${corner2X},${corner2Y}`;
};

// Watch for view mode changes and recalculate lines
watch(viewMode, async () => {
  await nextTick();
  calculateConnectionLines();
});
</script>

<style scoped>
.dynamic-system-diagram {
  width: 100%;
  background: #f8f9fa;
  border-radius: 12px;
  padding: 2rem;
  position: relative;
}

.diagram-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
}

.debug-info {
  background: #fef3c7;
  padding: 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
}

.debug-info p {
  margin: 0.25rem 0;
}

.view-mode-selector {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.mode-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
}

.diagram-grid {
  display: grid;
  align-items: stretch;
  position: relative;
}

.grid-column {
  display: flex;
  min-height: fit-content;
}

/* Location Boxes */
.location-box {
  border-style: solid;
  border-radius: 16px;
  padding: 0;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 150px;
}

.location-title {
  margin: 0;
  padding: 1rem;
  font-size: 1rem;
  font-weight: 600;
  color: #475569;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(to bottom, #f9fafb, white);
  border-radius: 14px 14px 0 0;
}

.location-main_house .location-title {
  background: linear-gradient(to bottom, #dbeafe, white);
  color: #1e5a78;
}

.location-content {
  flex: 1;
  padding: 1rem;
  display: flex;
  gap: 1rem;
}

/* Parent Section */
.parent-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  justify-content: center;
}

/* Groups Section */
.groups-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  justify-content: space-around;
}

/* Component Boxes */
.component-box {
  padding: 1.25rem 1rem;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  min-width: 100px;
}

.component-name {
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.3;
  white-space: pre-line;
}

.component-value {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
}

/* Group Boxes */
.group-box {
  border-radius: 12px;
  padding: 0.75rem;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  border: 2px solid;
  text-align: center;
}

.group-name {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #1e293b;
  white-space: pre-line;
}

.group-home_usage .group-name {
  color: white;
}

.group-value {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.devices-row {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-top: 0.5rem;
}

.device-box {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 500;
  color: white;
  background: #4a7c59;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  line-height: 1.2;
  text-align: center;
}

/* SVG Overlay */
.connections-overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 10;
}

/* Responsive */
@media (max-width: 1200px) {
  .diagram-grid {
    grid-template-columns: 1fr 1fr !important;
  }
}

@media (max-width: 768px) {
  .diagram-grid {
    grid-template-columns: 1fr !important;
  }
}
</style>