// src/controllers/historyController.js
import db from '../services/database.js';

class HistoryController {
  async getLast24Hours(req, res) {
    try {
      const data = await db.getLast24Hours();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getDateData(req, res) {
    try {
      const { date } = req.params;
      
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ 
          error: 'Invalid date format. Use YYYY-MM-DD' 
        });
      }
      
      const data = await db.getDateData(date);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getDailySummary(req, res) {
    try {
      const { start, end } = req.query;
      
      if (!start || !end) {
        return res.status(400).json({ 
          error: 'Missing start or end date' 
        });
      }
      
      const data = await db.getDailySummary(start, end);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getToday(req, res) {
    try {
      const data = await db.getToday();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getMonthlySummary(req, res) {
    try {
      const { year } = req.params;
      
      if (!/^\d{4}$/.test(year)) {
        return res.status(400).json({ error: 'Invalid year format' });
      }
      
      // TODO: Implement in database service
      res.json([]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new HistoryController();