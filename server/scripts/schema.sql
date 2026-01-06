-- scripts/schema.sql

-- ============================================
-- Alpha ESS Monitoring System Database Schema
-- ============================================

-- 1. Real-time snapshots
CREATE TABLE IF NOT EXISTS energy_snapshots (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME(3) NOT NULL,
  battery_soc TINYINT,
  battery_voltage DECIMAL(6,2),
  battery_current DECIMAL(8,2),
  battery_power INT,
  battery_temperature DECIMAL(4,1),
  grid_power INT,
  grid_voltage_l1 DECIMAL(5,1),
  grid_voltage_l2 DECIMAL(5,1),
  grid_voltage_l3 DECIMAL(5,1),
  grid_current_l1 DECIMAL(7,2),
  grid_current_l2 DECIMAL(7,2),
  grid_current_l3 DECIMAL(7,2),
  grid_frequency DECIMAL(5,2),
  pv_power INT,
  pv_voltage_l1 DECIMAL(5,1),
  pv_current_l1 DECIMAL(7,2),
  load_power INT,
  inverter_power INT,
  INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB;

-- 2. Minute aggregates
CREATE TABLE IF NOT EXISTS energy_minutes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  battery_soc_avg DECIMAL(5,2),
  battery_power_avg INT,
  battery_temperature_avg DECIMAL(4,1),
  grid_power_avg INT,
  pv_power_avg INT,
  load_power_avg INT,
  battery_soc_min TINYINT,
  battery_soc_max TINYINT,
  pv_power_max INT,
  grid_power_min INT,
  grid_power_max INT,
  UNIQUE KEY idx_timestamp (timestamp)
) ENGINE=InnoDB;

-- 3. Hourly aggregates
CREATE TABLE IF NOT EXISTS energy_hours (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  battery_soc_avg DECIMAL(5,2),
  battery_power_avg INT,
  grid_power_avg INT,
  pv_power_avg INT,
  load_power_avg INT,
  pv_energy_wh INT,
  grid_import_wh INT,
  grid_export_wh INT,
  battery_charge_wh INT,
  battery_discharge_wh INT,
  load_consumption_wh INT,
  UNIQUE KEY idx_timestamp (timestamp)
) ENGINE=InnoDB;

-- 4. Daily summaries
CREATE TABLE IF NOT EXISTS energy_daily (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  pv_generation_kwh DECIMAL(8,2),
  grid_import_kwh DECIMAL(8,2),
  grid_export_kwh DECIMAL(8,2),
  battery_charge_kwh DECIMAL(8,2),
  battery_discharge_kwh DECIMAL(8,2),
  load_consumption_kwh DECIMAL(8,2),
  self_consumption_rate DECIMAL(5,2),
  self_sufficiency_rate DECIMAL(5,2),
  battery_soc_min TINYINT,
  battery_soc_max TINYINT,
  battery_soc_avg DECIMAL(5,2),
  battery_cycles DECIMAL(5,2),
  pv_peak_power INT,
  pv_hours DECIMAL(4,1),
  cost_grid_import DECIMAL(8,2),
  revenue_grid_export DECIMAL(8,2),
  savings DECIMAL(8,2),
  UNIQUE KEY idx_date (date)
) ENGINE=InnoDB;

-- 5. Monthly summaries
CREATE TABLE IF NOT EXISTS energy_monthly (
  id INT AUTO_INCREMENT PRIMARY KEY,
  year INT NOT NULL,
  month TINYINT NOT NULL,
  pv_generation_kwh DECIMAL(10,2),
  grid_import_kwh DECIMAL(10,2),
  grid_export_kwh DECIMAL(10,2),
  battery_charge_kwh DECIMAL(10,2),
  battery_discharge_kwh DECIMAL(10,2),
  load_consumption_kwh DECIMAL(10,2),
  self_consumption_rate DECIMAL(5,2),
  self_sufficiency_rate DECIMAL(5,2),
  cost_grid_import DECIMAL(10,2),
  revenue_grid_export DECIMAL(10,2),
  savings DECIMAL(10,2),
  UNIQUE KEY idx_year_month (year, month)
) ENGINE=InnoDB;

-- 6. System events
CREATE TABLE IF NOT EXISTS system_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  description TEXT,
  severity ENUM('info', 'warning', 'error', 'critical') DEFAULT 'info',
  data JSON,
  INDEX idx_timestamp (timestamp),
  INDEX idx_event_type (event_type)
) ENGINE=InnoDB;

-- 7. Dispatch history
CREATE TABLE IF NOT EXISTS dispatch_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  mode VARCHAR(50) NOT NULL,
  target_power INT,
  target_soc TINYINT,
  planned_duration INT,
  actual_duration INT,
  energy_transferred_wh INT,
  triggered_by VARCHAR(50),
  notes TEXT,
  INDEX idx_start_time (start_time)
) ENGINE=InnoDB;

-- 8. Electricity tariffs
CREATE TABLE IF NOT EXISTS electricity_tariffs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  import_rate DECIMAL(8,4),
  export_rate DECIMAL(8,4),
  days_of_week SET('mon','tue','wed','thu','fri','sat','sun'),
  active BOOLEAN DEFAULT TRUE,
  INDEX idx_active (active)
) ENGINE=InnoDB;

-- 9. Scheduled dispatch
CREATE TABLE IF NOT EXISTS scheduled_dispatch (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  mode VARCHAR(50) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  duration INT,
  target_power INT,
  target_soc TINYINT,
  days_of_week SET('mon','tue','wed','thu','fri','sat','sun'),
  conditions JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_enabled (enabled)
) ENGINE=InnoDB;

-- 10. System configuration
CREATE TABLE IF NOT EXISTS system_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(50) UNIQUE NOT NULL,
  config_value TEXT,
  description TEXT,
  data_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;