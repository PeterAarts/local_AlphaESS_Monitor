// src/utils/validators.js

export function isValidIPAddress(ip) {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ip)) return false;
  
  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part);
    return num >= 0 && num <= 255;
  });
}

export function isValidPort(port) {
  const portNum = parseInt(port);
  return !isNaN(portNum) && portNum > 0 && portNum <= 65535;
}

export function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

export function isValidSOC(soc) {
  const socNum = parseFloat(soc);
  return !isNaN(socNum) && socNum >= 0 && socNum <= 100;
}

export function isValidPower(watts) {
  const power = parseFloat(watts);
  return !isNaN(power) && power >= 0 && power <= 10000;
}

export default {
  isValidIPAddress,
  isValidPort,
  isValidDate,
  isValidSOC,
  isValidPower
};