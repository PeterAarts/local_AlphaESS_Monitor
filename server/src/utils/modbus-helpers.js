// src/utils/modbus-helpers.js

/**
 * Convert 32-bit signed integer from two 16-bit registers
 */
export function convert32BitSigned(data) {
  let value = (data[0] << 16) | data[1];
  if (value > 0x7FFFFFFF) value -= 0x100000000;
  return value;
}

/**
 * Convert 32-bit unsigned integer from two 16-bit registers
 */
export function convert32BitUnsigned(data) {
  return (data[0] << 16) | data[1];
}

/**
 * Split 32-bit value into two 16-bit registers
 */
export function split32BitValue(value) {
  const lowByte = value & 0xFFFF;
  const highByte = (value >> 16) & 0xFFFF;
  return [lowByte, highByte];
}

/**
 * Convert SOC percentage to register value
 */
export function socToRegister(soc) {
  return Math.round(soc / 0.4);
}

/**
 * Convert register value to SOC percentage
 */
export function registerToSoc(value) {
  return value * 0.4;
}

export default {
  convert32BitSigned,
  convert32BitUnsigned,
  split32BitValue,
  socToRegister,
  registerToSoc
};