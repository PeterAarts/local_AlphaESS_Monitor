-- ============================================
-- Alpha ESS Monitoring System Database
-- ============================================

-- Drop existing tables (use carefully!)
-- DROP TABLE IF EXISTS energy_snapshots;
-- DROP TABLE IF EXISTS energy_minutes;
-- DROP TABLE IF EXISTS energy_hours;
-- DROP TABLE IF EXISTS energy_daily;
-- DROP TABLE IF EXISTS energy_monthly;
-- DROP TABLE IF EXISTS system_events;
-- DROP TABLE IF EXISTS dispatch_history;
-- DROP TABLE IF EXISTS electricity_tariffs;
-- DROP TABLE IF EXISTS scheduled_dispatch;
-- DROP TABLE IF EXISTS system_config;

-- ============================================
-- 1. REAL-TIME DATA (High Frequency)
-- ============================================
CREATE TABLE energy_snapshots (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME(3) NOT NULL,
  
  -- Battery (from registers 0x0100-0x0103, 0x041B)
  battery_soc TINYINT COMMENT 'State of Charge (%)',
  battery_voltage DECIMAL(6,2) COMMENT 'Voltage (V)',
  battery_current DECIMAL(8,2) COMMENT 'Current (A)',
  battery_power INT COMMENT 'Power (W, negative=charging, positive=discharging)',
  battery_temperature DECIMAL(4,1) COMMENT 'Temperature (°C)',
  
  -- Grid (from registers 0x0470-0x049C)
  grid_power INT COMMENT 'Grid power (W, negative=exporting, positive=importing)',
  grid_voltage_l1 DECIMAL(5,1) COMMENT 'Grid voltage L1 (V)',
  grid_voltage_l2 DECIMAL(5,1) COMMENT 'Grid voltage L2 (V)',
  grid_voltage_l3 DECIMAL(5,1) COMMENT 'Grid voltage L3 (V)',
  grid_current_l1 DECIMAL(7,2) COMMENT 'Grid current L1 (A)',
  grid_current_l2 DECIMAL(7,2) COMMENT 'Grid current L2 (A)',
  grid_current_l3 DECIMAL(7,2) COMMENT 'Grid current L3 (A)',
  grid_frequency DECIMAL(5,2) COMMENT 'Grid frequency (Hz)',
  
  -- PV AC-Coupled (from registers 0x0470-0x048A)
  pv_power INT COMMENT 'PV power (W)',
  pv_voltage_l1 DECIMAL(5,1) COMMENT 'PV voltage L1 (V)',
  pv_current_l1 DECIMAL(7,2) COMMENT 'PV current L1 (A)',
  
  -- Load/Consumption (from registers 0x041A, 0x0492)
  load_power INT COMMENT 'Load power (W)',
  inverter_power INT COMMENT 'Inverter power (W)',
  
  INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB COMMENT='High-frequency snapshots (every 10 seconds)';

-- ============================================
-- 2. MINUTE-LEVEL AGGREGATION
-- ============================================
CREATE TABLE energy_minutes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL COMMENT 'Start of minute',
  
  -- Averages
  battery_soc_avg DECIMAL(5,2),
  battery_power_avg INT,
  battery_temperature_avg DECIMAL(4,1),
  grid_power_avg INT,
  pv_power_avg INT,
  load_power_avg INT,
  
  -- Min/Max
  battery_soc_min TINYINT,
  battery_soc_max TINYINT,
  pv_power_max INT,
  grid_power_min INT,
  grid_power_max INT,
  
  UNIQUE KEY idx_timestamp (timestamp)
) ENGINE=InnoDB COMMENT='Per-minute aggregates';

-- ============================================
-- 3. HOURLY AGGREGATION
-- ============================================
CREATE TABLE energy_hours (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL COMMENT 'Start of hour',
  
  -- Averages
  battery_soc_avg DECIMAL(5,2),
  battery_power_avg INT,
  grid_power_avg INT,
  pv_power_avg INT,
  load_power_avg INT,
  
  -- Energy totals for the hour (Wh)
  pv_energy_wh INT COMMENT 'PV generation this hour',
  grid_import_wh INT COMMENT 'Energy imported from grid',
  grid_export_wh INT COMMENT 'Energy exported to grid',
  battery_charge_wh INT COMMENT 'Energy charged to battery',
  battery_discharge_wh INT COMMENT 'Energy discharged from battery',
  load_consumption_wh INT COMMENT 'Total consumption',
  
  UNIQUE KEY idx_timestamp (timestamp)
) ENGINE=InnoDB COMMENT='Per-hour aggregates';

-- ============================================
-- 4. DAILY SUMMARIES
-- ============================================
CREATE TABLE energy_daily (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  
  -- Energy totals (kWh)
  pv_generation_kwh DECIMAL(8,2) COMMENT 'Total PV generation',
  grid_import_kwh DECIMAL(8,2) COMMENT 'Total grid import',
  grid_export_kwh DECIMAL(8,2) COMMENT 'Total grid export',
  battery_charge_kwh DECIMAL(8,2) COMMENT 'Total battery charging',
  battery_discharge_kwh DECIMAL(8,2) COMMENT 'Total battery discharging',
  load_consumption_kwh DECIMAL(8,2) COMMENT 'Total consumption',
  
  -- Efficiency metrics
  self_consumption_rate DECIMAL(5,2) COMMENT '% of PV used directly (not exported)',
  self_sufficiency_rate DECIMAL(5,2) COMMENT '% of load met by PV+battery',
  
  -- Battery statistics
  battery_soc_min TINYINT,
  battery_soc_max TINYINT,
  battery_soc_avg DECIMAL(5,2),
  battery_cycles DECIMAL(5,2) COMMENT 'Estimated charge cycles',
  
  -- PV statistics
  pv_peak_power INT COMMENT 'Peak PV power (W)',
  pv_hours DECIMAL(4,1) COMMENT 'Equivalent full sun hours',
  
  -- Financial (optional)
  cost_grid_import DECIMAL(8,2) COMMENT 'Cost of imported electricity',
  revenue_grid_export DECIMAL(8,2) COMMENT 'Revenue from exported electricity',
  savings DECIMAL(8,2) COMMENT 'Total savings',
  
  UNIQUE KEY idx_date (date),
  INDEX idx_date_range (date)
) ENGINE=InnoDB COMMENT='Daily summaries';

-- ============================================
-- 5. MONTHLY SUMMARIES
-- ============================================
CREATE TABLE energy_monthly (
  id INT AUTO_INCREMENT PRIMARY KEY,
  year INT NOT NULL,
  month TINYINT NOT NULL,
  
  -- Energy totals (kWh)
  pv_generation_kwh DECIMAL(10,2),
  grid_import_kwh DECIMAL(10,2),
  grid_export_kwh DECIMAL(10,2),
  battery_charge_kwh DECIMAL(10,2),
  battery_discharge_kwh DECIMAL(10,2),
  load_consumption_kwh DECIMAL(10,2),
  
  -- Efficiency metrics
  self_consumption_rate DECIMAL(5,2),
  self_sufficiency_rate DECIMAL(5,2),
  
  -- Financial
  cost_grid_import DECIMAL(10,2),
  revenue_grid_export DECIMAL(10,2),
  savings DECIMAL(10,2),
  
  UNIQUE KEY idx_year_month (year, month)
) ENGINE=InnoDB COMMENT='Monthly summaries';

-- ============================================
-- 6. SYSTEM EVENTS LOG
-- ============================================
CREATE TABLE system_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  event_type VARCHAR(50) NOT NULL COMMENT 'e.g., dispatch_start, system_error',
  description TEXT,
  severity ENUM('info', 'warning', 'error', 'critical') DEFAULT 'info',
  data JSON COMMENT 'Additional event data',
  
  INDEX idx_timestamp (timestamp),
  INDEX idx_event_type (event_type),
  INDEX idx_severity (severity)
) ENGINE=InnoDB COMMENT='System events and errors';

-- ============================================
-- 7. DISPATCH MODE HISTORY
-- ============================================
CREATE TABLE dispatch_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  mode VARCHAR(50) NOT NULL COMMENT 'charge_from_grid, discharge_to_grid, etc.',
  target_power INT COMMENT 'Target power (W)',
  target_soc TINYINT COMMENT 'Target state of charge (%)',
  planned_duration INT COMMENT 'Planned duration (seconds)',
  actual_duration INT COMMENT 'Actual duration (seconds)',
  energy_transferred_wh INT COMMENT 'Energy transferred (Wh)',
  triggered_by VARCHAR(50) COMMENT 'manual, schedule, automation',
  notes TEXT,
  
  INDEX idx_start_time (start_time)
) ENGINE=InnoDB COMMENT='Dispatch mode history';

-- ============================================
-- 8. ELECTRICITY TARIFFS
-- ============================================
CREATE TABLE electricity_tariffs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  import_rate DECIMAL(8,4) COMMENT 'Import rate (€/kWh)',
  export_rate DECIMAL(8,4) COMMENT 'Export rate (€/kWh)',
  days_of_week SET('mon','tue','wed','thu','fri','sat','sun') COMMENT 'Applicable days',
  active BOOLEAN DEFAULT TRUE,
  
  INDEX idx_active (active)
) ENGINE=InnoDB COMMENT='Electricity pricing tariffs';

-- Example tariff data
INSERT INTO electricity_tariffs (name, start_time, end_time, import_rate, export_rate, days_of_week, active) VALUES
('Night Rate', '23:00:00', '07:00:00', 0.15, 0.05, 'mon,tue,wed,thu,fri,sat,sun', TRUE),
('Peak Rate', '17:00:00', '21:00:00', 0.35, 0.08, 'mon,tue,wed,thu,fri', TRUE),
('Standard Rate', '07:00:00', '17:00:00', 0.25, 0.06, 'mon,tue,wed,thu,fri,sat,sun', TRUE),
('Weekend Rate', '00:00:00', '23:59:59', 0.20, 0.06, 'sat,sun', TRUE);

-- ============================================
-- 9. SCHEDULED DISPATCH
-- ============================================
CREATE TABLE scheduled_dispatch (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  mode VARCHAR(50) NOT NULL COMMENT 'charge_from_grid, discharge_to_grid',
  start_time TIME NOT NULL,
  end_time TIME,
  duration INT COMMENT 'Duration in seconds (alternative to end_time)',
  target_power INT,
  target_soc TINYINT,
  days_of_week SET('mon','tue','wed','thu','fri','sat','sun'),
  conditions JSON COMMENT 'Additional conditions (e.g., SOC < 20%)',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_enabled (enabled)
) ENGINE=InnoDB COMMENT='Scheduled dispatch configurations';

-- Example scheduled dispatch
INSERT INTO scheduled_dispatch (name, enabled, mode, start_time, duration, target_power, target_soc, days_of_week) VALUES
('Night Charging', TRUE, 'charge_from_grid', '23:00:00', 28800, 3000, 100, 'mon,tue,wed,thu,fri,sat,sun'),
('Peak Export', TRUE, 'discharge_to_grid', '17:00:00', 14400, 4000, 20, 'mon,tue,wed,thu,fri');

-- ============================================
-- 10. SYSTEM CONFIGURATION
-- ============================================
CREATE TABLE system_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(50) UNIQUE NOT NULL,
  config_value TEXT,
  description TEXT,
  data_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='System configuration';

-- Default configuration
INSERT INTO system_config (config_key, config_value, description, data_type) VALUES
('alpha_ess_ip', '192.168.1.XXX', 'Alpha ESS inverter IP address', 'string'),
('alpha_ess_port', '502', 'Modbus TCP port', 'number'),
('alpha_ess_slave_id', '85', 'Modbus slave ID', 'number'),
('snapshot_interval_seconds', '10', 'Data collection interval', 'number'),
('battery_capacity_kwh', '10.1', 'Total battery capacity', 'number'),
('battery_usable_capacity_kwh', '9.7', 'Usable battery capacity', 'number'),
('pv_capacity_kwp', '3.0', 'PV system capacity', 'number'),
('inverter_max_power_w', '5000', 'Inverter maximum power', 'number'),
('aggregation_enabled', 'true', 'Enable automatic data aggregation', 'boolean'),
('cleanup_snapshots_days', '7', 'Days to keep detailed snapshots', 'number'),
('default_currency', 'EUR', 'Currency for financial calculations', 'string'),
('timezone', 'Europe/Amsterdam', 'System timezone', 'string');

-- ============================================
-- VIEWS (Optional - for easier queries)
-- ============================================

-- Current day summary (real-time)
CREATE OR REPLACE VIEW v_today_summary AS
SELECT 
  DATE(timestamp) as date,
  SUM(CASE WHEN pv_energy_wh > 0 THEN pv_energy_wh ELSE 0 END) / 1000 as pv_generation_kwh,
  SUM(CASE WHEN grid_import_wh > 0 THEN grid_import_wh ELSE 0 END) / 1000 as grid_import_kwh,
  SUM(CASE WHEN grid_export_wh > 0 THEN grid_export_wh ELSE 0 END) / 1000 as grid_export_kwh,
  SUM(CASE WHEN load_consumption_wh > 0 THEN load_consumption_wh ELSE 0 END) / 1000 as load_consumption_kwh
FROM energy_hours
WHERE DATE(timestamp) = CURDATE()
GROUP BY DATE(timestamp);

-- Latest system status
CREATE OR REPLACE VIEW v_current_status AS
SELECT 
  timestamp,
  battery_soc,
  battery_power,
  battery_temperature,
  grid_power,
  pv_power,
  load_power
FROM energy_snapshots
ORDER BY timestamp DESC
LIMIT 1;