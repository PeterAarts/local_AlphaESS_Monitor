// src/controllers/settingsController.js
import pool from '../config/database.js';

class SettingsController {
  async getConfig(req, res) {
    try {
      const [rows] = await pool.execute(
        'SELECT config_key, config_value, description, data_type FROM system_config'
      );
      
      const config = {};
      rows.forEach(row => {
        let value = row.config_value;
        
        // Parse based on data type
        if (row.data_type === 'number') {
          value = parseFloat(value);
        } else if (row.data_type === 'boolean') {
          value = value === 'true';
        } else if (row.data_type === 'json') {
          value = JSON.parse(value);
        }
        
        config[row.config_key] = {
          value,
          description: row.description,
          type: row.data_type
        };
      });
      
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateConfig(req, res) {
    try {
      const { key, value } = req.body;
      
      if (!key || value === undefined) {
        return res.status(400).json({ 
          error: 'Missing key or value' 
        });
      }
      
      // Convert value to string for storage
      const stringValue = typeof value === 'object' 
        ? JSON.stringify(value) 
        : String(value);
      
      await pool.execute(
        'UPDATE system_config SET config_value = ? WHERE config_key = ?',
        [stringValue, key]
      );
      
      res.json({ success: true, key, value });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getTariffs(req, res) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM electricity_tariffs WHERE active = TRUE ORDER BY start_time'
      );
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async createTariff(req, res) {
    try {
      const { name, start_time, end_time, import_rate, export_rate, days_of_week } = req.body;
      
      const [result] = await pool.execute(
        `INSERT INTO electricity_tariffs 
        (name, start_time, end_time, import_rate, export_rate, days_of_week) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [name, start_time, end_time, import_rate, export_rate, days_of_week]
      );
      
      res.json({ success: true, id: result.insertId });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateTariff(req, res) {
    try {
      const { id } = req.params;
      const { name, start_time, end_time, import_rate, export_rate, days_of_week } = req.body;
      
      await pool.execute(
        `UPDATE electricity_tariffs 
        SET name = ?, start_time = ?, end_time = ?, 
            import_rate = ?, export_rate = ?, days_of_week = ?
        WHERE id = ?`,
        [name, start_time, end_time, import_rate, export_rate, days_of_week, id]
      );
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async deleteTariff(req, res) {
    try {
      const { id } = req.params;
      
      await pool.execute(
        'UPDATE electricity_tariffs SET active = FALSE WHERE id = ?',
        [id]
      );
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new SettingsController();