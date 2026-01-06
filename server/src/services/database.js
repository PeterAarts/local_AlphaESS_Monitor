// src/services/database.js
import pool from '../config/database.js';

class DatabaseService {
  /**
   * Store real-time snapshot
   */
  async storeSnapshot(data) {
    const query = `
      INSERT INTO energy_snapshots (
        timestamp, 
        battery_soc, battery_voltage, battery_current, battery_power, battery_temperature,
        grid_power, grid_voltage_l1, grid_voltage_l2, grid_voltage_l3,
        grid_current_l1, grid_current_l2, grid_current_l3, grid_frequency,
        pv_power, pv_voltage_l1, pv_current_l1,
        load_power, inverter_power
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      data.timestamp,
      data.battery.soc,
      data.battery.voltage,
      data.battery.current,
      data.battery.power,
      data.battery.temperature,
      data.grid.power,
      data.grid.voltageL1,
      data.grid.voltageL2 || null,
      data.grid.voltageL3 || null,
      data.grid.currentL1 || null,
      data.grid.currentL2 || null,
      data.grid.currentL3 || null,
      data.grid.frequency,
      data.pv.power,
      data.pv.voltageL1 || null,
      data.pv.currentL1 || null,
      data.load.power,
      data.load.inverterPower,
    ];

    try {
      await pool.execute(query, values);
    } catch (error) {
      console.error('Error storing snapshot:', error.message);
      throw error;
    }
  }

  /**
   * Aggregate snapshots into minutes
   */
  async aggregateToMinutes() {
    const query = `
      INSERT INTO energy_minutes (
        timestamp, 
        battery_soc_avg, battery_power_avg, battery_temperature_avg,
        grid_power_avg, pv_power_avg, load_power_avg,
        battery_soc_min, battery_soc_max, pv_power_max,
        grid_power_min, grid_power_max
      )
      SELECT 
        DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:00') as minute,
        AVG(battery_soc) as battery_soc_avg,
        AVG(battery_power) as battery_power_avg,
        AVG(battery_temperature) as battery_temperature_avg,
        AVG(grid_power) as grid_power_avg,
        AVG(pv_power) as pv_power_avg,
        AVG(load_power) as load_power_avg,
        MIN(battery_soc) as battery_soc_min,
        MAX(battery_soc) as battery_soc_max,
        MAX(pv_power) as pv_power_max,
        MIN(grid_power) as grid_power_min,
        MAX(grid_power) as grid_power_max
      FROM energy_snapshots
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 2 MINUTE)
        AND timestamp < DATE_SUB(NOW(), INTERVAL 1 MINUTE)
      GROUP BY minute
      ON DUPLICATE KEY UPDATE
        battery_soc_avg = VALUES(battery_soc_avg),
        battery_power_avg = VALUES(battery_power_avg),
        battery_temperature_avg = VALUES(battery_temperature_avg),
        grid_power_avg = VALUES(grid_power_avg),
        pv_power_avg = VALUES(pv_power_avg),
        load_power_avg = VALUES(load_power_avg),
        battery_soc_min = VALUES(battery_soc_min),
        battery_soc_max = VALUES(battery_soc_max),
        pv_power_max = VALUES(pv_power_max),
        grid_power_min = VALUES(grid_power_min),
        grid_power_max = VALUES(grid_power_max)
    `;

    try {
      await pool.execute(query);
    } catch (error) {
      console.error('Error aggregating to minutes:', error.message);
    }
  }

  /**
   * Aggregate minutes into hours
   */
  async aggregateToHours() {
    const query = `
      INSERT INTO energy_hours (
        timestamp,
        battery_soc_avg, battery_power_avg, grid_power_avg, pv_power_avg, load_power_avg,
        pv_energy_wh, grid_import_wh, grid_export_wh,
        battery_charge_wh, battery_discharge_wh, load_consumption_wh
      )
      SELECT 
        DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00') as hour,
        AVG(battery_soc_avg) as battery_soc_avg,
        AVG(battery_power_avg) as battery_power_avg,
        AVG(grid_power_avg) as grid_power_avg,
        AVG(pv_power_avg) as pv_power_avg,
        AVG(load_power_avg) as load_power_avg,
        SUM(CASE WHEN pv_power_avg > 0 THEN pv_power_avg ELSE 0 END) / 60 as pv_energy_wh,
        SUM(CASE WHEN grid_power_avg > 0 THEN grid_power_avg ELSE 0 END) / 60 as grid_import_wh,
        SUM(CASE WHEN grid_power_avg < 0 THEN ABS(grid_power_avg) ELSE 0 END) / 60 as grid_export_wh,
        SUM(CASE WHEN battery_power_avg < 0 THEN ABS(battery_power_avg) ELSE 0 END) / 60 as battery_charge_wh,
        SUM(CASE WHEN battery_power_avg > 0 THEN battery_power_avg ELSE 0 END) / 60 as battery_discharge_wh,
        SUM(CASE WHEN load_power_avg > 0 THEN load_power_avg ELSE 0 END) / 60 as load_consumption_wh
      FROM energy_minutes
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 2 HOUR)
        AND timestamp < DATE_SUB(NOW(), INTERVAL 1 HOUR)
      GROUP BY hour
      ON DUPLICATE KEY UPDATE
        battery_soc_avg = VALUES(battery_soc_avg),
        battery_power_avg = VALUES(battery_power_avg),
        grid_power_avg = VALUES(grid_power_avg),
        pv_power_avg = VALUES(pv_power_avg),
        load_power_avg = VALUES(load_power_avg),
        pv_energy_wh = VALUES(pv_energy_wh),
        grid_import_wh = VALUES(grid_import_wh),
        grid_export_wh = VALUES(grid_export_wh),
        battery_charge_wh = VALUES(battery_charge_wh),
        battery_discharge_wh = VALUES(battery_discharge_wh),
        load_consumption_wh = VALUES(load_consumption_wh)
    `;

    try {
      await pool.execute(query);
    } catch (error) {
      console.error('Error aggregating to hours:', error.message);
    }
  }

  /**
   * Aggregate hours into daily
   */
  async aggregateToDaily() {
    const query = `
      INSERT INTO energy_daily (
        date,
        pv_generation_kwh, grid_import_kwh, grid_export_kwh,
        battery_charge_kwh, battery_discharge_kwh, load_consumption_kwh,
        self_consumption_rate, self_sufficiency_rate,
        battery_soc_min, battery_soc_max, battery_soc_avg,
        pv_peak_power
      )
      SELECT 
        DATE(timestamp) as date,
        SUM(pv_energy_wh) / 1000 as pv_generation_kwh,
        SUM(grid_import_wh) / 1000 as grid_import_kwh,
        SUM(grid_export_wh) / 1000 as grid_export_kwh,
        SUM(battery_charge_wh) / 1000 as battery_charge_kwh,
        SUM(battery_discharge_wh) / 1000 as battery_discharge_kwh,
        SUM(load_consumption_wh) / 1000 as load_consumption_kwh,
        CASE 
          WHEN SUM(pv_energy_wh) > 0 
          THEN ((SUM(pv_energy_wh) - SUM(grid_export_wh)) / SUM(pv_energy_wh) * 100)
          ELSE 0 
        END as self_consumption_rate,
        CASE 
          WHEN SUM(load_consumption_wh) > 0 
          THEN ((SUM(load_consumption_wh) - SUM(grid_import_wh)) / SUM(load_consumption_wh) * 100)
          ELSE 0 
        END as self_sufficiency_rate,
        (SELECT MIN(battery_soc_min) FROM energy_minutes WHERE DATE(timestamp) = DATE(eh.timestamp)) as battery_soc_min,
        (SELECT MAX(battery_soc_max) FROM energy_minutes WHERE DATE(timestamp) = DATE(eh.timestamp)) as battery_soc_max,
        AVG(battery_soc_avg) as battery_soc_avg,
        MAX(pv_power_avg) as pv_peak_power
      FROM energy_hours eh
      WHERE DATE(timestamp) = DATE(DATE_SUB(NOW(), INTERVAL 1 DAY))
      GROUP BY date
      ON DUPLICATE KEY UPDATE
        pv_generation_kwh = VALUES(pv_generation_kwh),
        grid_import_kwh = VALUES(grid_import_kwh),
        grid_export_kwh = VALUES(grid_export_kwh),
        battery_charge_kwh = VALUES(battery_charge_kwh),
        battery_discharge_kwh = VALUES(battery_discharge_kwh),
        load_consumption_kwh = VALUES(load_consumption_kwh),
        self_consumption_rate = VALUES(self_consumption_rate),
        self_sufficiency_rate = VALUES(self_sufficiency_rate),
        battery_soc_min = VALUES(battery_soc_min),
        battery_soc_max = VALUES(battery_soc_max),
        battery_soc_avg = VALUES(battery_soc_avg),
        pv_peak_power = VALUES(pv_peak_power)
    `;

    try {
      await pool.execute(query);
    } catch (error) {
      console.error('Error aggregating to daily:', error.message);
    }
  }

  /**
   * Get last 24 hours data
   */
  async getLast24Hours() {
    const query = `
      SELECT 
        timestamp,
        battery_soc_avg as battery_soc,
        battery_power_avg as battery_power,
        grid_power_avg as grid_power,
        pv_power_avg as pv_power,
        load_power_avg as load_power
      FROM energy_minutes
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY timestamp ASC
    `;

    try {
      const [rows] = await pool.execute(query);
      return rows;
    } catch (error) {
      console.error('Error getting 24h data:', error.message);
      throw error;
    }
  }

  /**
   * Get data for specific date
   */
  async getDateData(date) {
    const query = `
      SELECT 
        timestamp,
        battery_soc_avg as battery_soc,
        pv_energy_wh / 1000 as pv_energy_kwh,
        grid_import_wh / 1000 as grid_import_kwh,
        grid_export_wh / 1000 as grid_export_kwh,
        battery_charge_wh / 1000 as battery_charge_kwh,
        battery_discharge_wh / 1000 as battery_discharge_kwh,
        load_consumption_wh / 1000 as load_consumption_kwh
      FROM energy_hours
      WHERE DATE(timestamp) = ?
      ORDER BY timestamp ASC
    `;

    try {
      const [rows] = await pool.execute(query, [date]);
      return rows;
    } catch (error) {
      console.error('Error getting date data:', error.message);
      throw error;
    }
  }

  /**
   * Get daily summary
   */
  async getDailySummary(startDate, endDate) {
    const query = `
      SELECT 
        date,
        pv_generation_kwh,
        grid_import_kwh,
        grid_export_kwh,
        battery_charge_kwh,
        battery_discharge_kwh,
        load_consumption_kwh,
        self_consumption_rate,
        self_sufficiency_rate
      FROM energy_daily
      WHERE date >= ? AND date <= ?
      ORDER BY date ASC
    `;

    try {
      const [rows] = await pool.execute(query, [startDate, endDate]);
      return rows;
    } catch (error) {
      console.error('Error getting daily summary:', error.message);
      throw error;
    }
  }

  /**
   * Get today's summary
   */
  async getToday() {
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await this.getDailySummary(today, today);
    return rows[0] || {};
  }

  /**
   * Log system event
   */
  async logEvent(eventType, description, severity = 'info', data = null) {
    const query = `
      INSERT INTO system_events (timestamp, event_type, description, severity, data)
      VALUES (NOW(), ?, ?, ?, ?)
    `;

    try {
      await pool.execute(query, [
        eventType,
        description,
        severity,
        data ? JSON.stringify(data) : null,
      ]);
    } catch (error) {
      console.error('Error logging event:', error.message);
    }
  }

  /**
   * Log dispatch start
   */
  async logDispatchStart(mode, targetPower, targetSOC, plannedDuration, triggeredBy, notes = null) {
    const query = `
      INSERT INTO dispatch_history (start_time, mode, target_power, target_soc, planned_duration, triggered_by, notes)
      VALUES (NOW(), ?, ?, ?, ?, ?, ?)
    `;

    try {
      const [result] = await pool.execute(query, [
        mode,
        targetPower,
        targetSOC,
        plannedDuration,
        triggeredBy,
        notes,
      ]);
      return result.insertId;
    } catch (error) {
      console.error('Error logging dispatch start:', error.message);
      throw error;
    }
  }

  /**
   * Log dispatch end
   */
  async logDispatchEnd(dispatchId, energyTransferred) {
    const query = `
      UPDATE dispatch_history
      SET end_time = NOW(),
          actual_duration = TIMESTAMPDIFF(SECOND, start_time, NOW()),
          energy_transferred_wh = ?
      WHERE id = ?
    `;

    try {
      await pool.execute(query, [energyTransferred, dispatchId]);
    } catch (error) {
      console.error('Error logging dispatch end:', error.message);
    }
  }

  /**
   * Cleanup old snapshots
   */
  async cleanupOldSnapshots(daysToKeep = 7) {
    const query = `
      DELETE FROM energy_snapshots
      WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)
    `;

    try {
      const [result] = await pool.execute(query, [daysToKeep]);
      return result.affectedRows;
    } catch (error) {
      console.error('Error cleaning up snapshots:', error.message);
      return 0;
    }
  }
}

export default new DatabaseService();