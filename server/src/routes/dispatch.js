// src/routes/dispatch.js
import express from 'express';
import dataCollector from '../services/dataCollector.js';

const router = express.Router();

// Get dispatch status
router.get('/status', async (req, res) => {
  try {
    const status = await dataCollector.getDispatchConfig();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start charging
router.post('/charge', async (req, res) => {
  try {
    const { watts, targetSOC, durationHours } = req.body;
    const result = await dataCollector.chargeFromGrid(watts, targetSOC, durationHours);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start discharging
router.post('/discharge', async (req, res) => {
  try {
    const { watts, minimumSOC, durationHours } = req.body;
    const result = await dataCollector.dischargeToGrid(watts, minimumSOC, durationHours);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop dispatch
router.post('/stop', async (req, res) => {
  try {
    const result = await dataCollector.stopDispatch();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;