// src/utils/calculations.js

/**
 * Calculate self-consumption rate
 * (PV - Export) / PV * 100
 */
export function calculateSelfConsumption(pvGeneration, gridExport) {
  if (pvGeneration === 0) return 0;
  return ((pvGeneration - gridExport) / pvGeneration) * 100;
}

/**
 * Calculate self-sufficiency rate
 * (Load - Import) / Load * 100
 */
export function calculateSelfSufficiency(loadConsumption, gridImport) {
  if (loadConsumption === 0) return 0;
  return ((loadConsumption - gridImport) / loadConsumption) * 100;
}

/**
 * Calculate battery cycles from charge/discharge
 */
export function calculateBatteryCycles(chargeKwh, dischargeKwh, batteryCapacity) {
  const totalKwh = chargeKwh + dischargeKwh;
  return totalKwh / (batteryCapacity * 2); // Divide by 2 because full cycle is charge+discharge
}

/**
 * Calculate cost based on tariff
 */
export function calculateCost(energyKwh, ratePerKwh) {
  return energyKwh * ratePerKwh;
}

/**
 * Calculate savings (avoided grid import cost - export revenue opportunity cost)
 */
export function calculateSavings(selfUsedPV, importRate, exportRate) {
  return selfUsedPV * (importRate - exportRate);
}

export default {
  calculateSelfConsumption,
  calculateSelfSufficiency,
  calculateBatteryCycles,
  calculateCost,
  calculateSavings
};