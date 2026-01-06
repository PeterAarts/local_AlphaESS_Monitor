// src/routes/system.js - FIXED FOR YOUR DATABASE STRUCTURE
import express from 'express';
import db from '../config/database.js';

const router = express.Router();

console.log('✓ System routes module loaded');

/**
 * GET /api/system/architecture
 * Returns complete system architecture configuration
 */
router.get('/architecture', async (req, res) => {
  try {
    console.log('📊 Fetching system architecture...');
    
    // Get all components from database
    const [components] = await db.query(`
      SELECT 
        id,
        component_key,
        name,
        type,
        category,
        location_type,
        location_label,
        parent_id,
        level_depth,
        display_order,
        is_optional,
        specs,
        data_source
      FROM system_components
      WHERE is_optional = 0 OR is_optional IS NULL
      ORDER BY level_depth ASC, display_order ASC
    `);

    console.log(`✓ Found ${components.length} components`);

    // Get all flows (joining to get component_keys)
    const [flows] = await db.query(`
      SELECT 
        cf.from_component_id,
        cf.to_component_id,
        cf.flow_type,
        cf.flow_direction,
        cf.arrow_color,
        cf.priority,
        c1.component_key as from_key,
        c2.component_key as to_key
      FROM component_flows cf
      LEFT JOIN system_components c1 ON cf.from_component_id = c1.id
      LEFT JOIN system_components c2 ON cf.to_component_id = c2.id
      WHERE cf.is_visible = 1
      ORDER BY cf.priority ASC
    `);

    console.log(`✓ Found ${flows.length} flows`);

    // Build architecture structure
    const architecture = buildArchitecture(components, flows);
    
    console.log(`✓ Built architecture with ${architecture.levels.length} levels`);
    
    res.json(architecture);
  } catch (error) {
    console.error('✗ Error fetching system architecture:', error);
    res.status(500).json({ 
      error: 'Failed to fetch system architecture',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Build architecture from components
 */
function buildArchitecture(components, flows) {
  // Create lookup maps
  const byId = {};
  const byKey = {};
  
  components.forEach(comp => {
    byId[comp.id] = comp;
    byKey[comp.component_key] = comp;
  });
  
  console.log(`📊 Building from ${components.length} components`);
  
  // Group by location_type
  const locations = {};
  
  // First pass: identify locations from components with location_type
  components.forEach(comp => {
    if (comp.location_type) {
      const locKey = comp.location_type;
      
      if (!locations[locKey]) {
        locations[locKey] = {
          key: locKey,
          label: comp.location_label || locKey,
          components: []
        };
        console.log(`📍 Created location: ${locKey} (${comp.location_label || locKey})`);
      }
    }
  });
  
  // Second pass: build component hierarchy
  // Get top-level components (no parent_id)
  const topLevel = components.filter(c => !c.parent_id && c.location_type);
  
  topLevel.forEach(comp => {
    const locKey = comp.location_type;
    
    if (!locations[locKey]) return;
    
    // Determine if this is a main component or a group
    if (comp.category === 'main') {
      // Main component - get its groups as subComponents
      const compData = buildComponentWithGroups(comp, components);
      locations[locKey].components.push(compData);
      console.log(`  ├─ ${comp.name} (main) with ${compData.subComponents.length} groups`);
    } else if (comp.category === 'group') {
      // Top-level group (like Solar 2 in Building A)
      const compData = buildGroupWithDevices(comp, components);
      locations[locKey].components.push(compData);
      console.log(`  ├─ ${comp.name} (group) with ${compData.subComponents.length} devices`);
    }
  });
  
  // Add flows
  flows.forEach(flow => {
    Object.values(locations).forEach(loc => {
      const comp = findInComponents(loc.components, flow.from_key);
      if (comp) {
        comp.flowTo = comp.flowTo || [];
        comp.flowTo.push(flow.to_key);
        comp.flowDirection = flow.flow_direction;
        comp.flowColor = flow.arrow_color;
      }
    });
  });
  
  // Convert to levels
  const levels = Object.entries(locations)
    .sort(([a], [b]) => {
      const order = { external: 0, house: 1, main_house: 1 };
      return (order[a] ?? 2) - (order[b] ?? 2);
    })
    .map(([key, loc], idx) => ({
      level: idx + 1,
      name: key,
      label: loc.label,
      components: loc.components
    }));
  
  console.log(`✅ Levels: ${levels.map(l => `${l.label}(${l.components.length})`).join(', ')}`);
  
  return {
    levels,
    flowRules: { priority: ['solar', 'battery', 'grid'], exportAllowed: true }
  };
}

/**
 * Build main component with groups as subComponents
 */
function buildComponentWithGroups(comp, allComponents) {
  const data = {
    id: comp.id,  // Use integer ID
    component_key: comp.component_key,
    name: comp.name,
    type: comp.type,
    category: comp.category,
    dataSource: comp.data_source,
    specs: parseSpecs(comp.specs),
    subComponents: [],
    flowTo: [],
    flowFrom: []
  };
  
  // Get direct children groups (parent_id points to this component)
  const groups = allComponents.filter(c => c.parent_id === comp.id && c.category === 'group');
  
  groups.forEach(group => {
    const groupData = buildGroupWithDevices(group, allComponents);
    data.subComponents.push(groupData);
  });
  
  return data;
}

/**
 * Build group with devices
 */
function buildGroupWithDevices(group, allComponents) {
  const groupData = {
    id: group.id,  // Use integer ID
    component_key: group.component_key,
    name: group.name,
    type: group.type,
    category: group.category,
    specs: parseSpecs(group.specs),
    subComponents: []
  };
  
  // Get devices for this group
  const devices = allComponents.filter(c => c.parent_id === group.id && c.category === 'device');
  
  devices.forEach(device => {
    groupData.subComponents.push({
      id: device.id,  // Use integer ID
      component_key: device.component_key,
      name: device.name,
      type: device.type,
      category: device.category,
      specs: parseSpecs(device.specs)
    });
  });
  
  console.log(`    └─ ${group.name}: ${devices.length} devices`);
  
  return groupData;
}

/**
 * Parse JSON specs safely
 */
function parseSpecs(specs) {
  if (!specs) return null;
  if (typeof specs === 'object') return specs;
  try {
    return JSON.parse(specs);
  } catch {
    return null;
  }
}

/**
 * Find component by key in array
 */
function findInComponents(components, key) {
  for (const comp of components) {
    if (comp.component_key === key || comp.id === key) return comp;
    if (comp.subComponents) {
      const found = findInComponents(comp.subComponents, key);
      if (found) return found;
    }
  }
  return null;
}

export default router;