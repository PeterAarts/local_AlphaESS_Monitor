// src/routes/alphaess.js
import express from 'express';
import dataCollector from '../services/dataCollector.js';

const router = express.Router();

// Error handler middleware
const handleModbusError = (error, res) => {
  if (error.code === 'MODBUS_NOT_CONNECTED') {
    return res.status(503).json({
      error: 'ModBus connection not available',
      message: error.message,
      connected: false,
      details: error.details,
      suggestion: 'Please check that the AlphaESS inverter is powered on and network accessible'
    });
  }
  
  // Generic error
  return res.status(500).json({ 
    error: error.message,
    connected: false
  });
};

// Get current system status
router.get('/status', async (req, res) => {
  try {
    const status = await dataCollector.getCompleteStatus();
    res.json(status);
  } catch (error) {
    handleModbusError(error, res);
  }
});

// Get complete status (same as above, for compatibility)
router.get('/complete-status', async (req, res) => {
  try {
    const status = await dataCollector.getCompleteStatus();
    res.json(status);
  } catch (error) {
    handleModbusError(error, res);
  }
});

// Get PV details
router.get('/pv-details', async (req, res) => {
  try {
    const pvDetails = await dataCollector.getPVDetails();
    res.json(pvDetails);
  } catch (error) {
    handleModbusError(error, res);
  }
});

// Get dispatch status
router.get('/dispatch-status', async (req, res) => {
  try {
    const dispatchStatus = await dataCollector.getDispatchConfig();
    res.json(dispatchStatus);
  } catch (error) {
    handleModbusError(error, res);
  }
});

// Get data collector status (this one always works, even without ModBus)
router.get('/collector-status', (req, res) => {
  try {
    const status = dataCollector.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Charge from grid
router.post('/charge', async (req, res) => {
  try {
    const { watts, targetSOC, durationHours } = req.body;

    // Validation
    if (!watts || !targetSOC || !durationHours) {
      return res.status(400).json({ 
        error: 'Missing required fields: watts, targetSOC, durationHours' 
      });
    }

    if (watts < 0 || watts > 5000) {
      return res.status(400).json({ error: 'Watts must be between 0 and 5000' });
    }

    if (targetSOC < 0 || targetSOC > 100) {
      return res.status(400).json({ error: 'Target SOC must be between 0 and 100' });
    }

    const result = await dataCollector.chargeFromGrid(watts, targetSOC, durationHours);
    res.json(result);
  } catch (error) {
    handleModbusError(error, res);
  }
});

// Discharge to grid
router.post('/discharge', async (req, res) => {
  try {
    const { watts, minimumSOC, durationHours } = req.body;

    // Validation
    if (!watts || minimumSOC === undefined || !durationHours) {
      return res.status(400).json({ 
        error: 'Missing required fields: watts, minimumSOC, durationHours' 
      });
    }

    if (watts < 0 || watts > 5000) {
      return res.status(400).json({ error: 'Watts must be between 0 and 5000' });
    }

    if (minimumSOC < 0 || minimumSOC > 100) {
      return res.status(400).json({ error: 'Minimum SOC must be between 0 and 100' });
    }

    const result = await dataCollector.dischargeToGrid(watts, minimumSOC, durationHours);
    res.json(result);
  } catch (error) {
    handleModbusError(error, res);
  }
});

// Prevent discharge
router.post('/prevent-discharge', async (req, res) => {
  try {
    const result = await dataCollector.preventDischarge();
    res.json(result);
  } catch (error) {
    handleModbusError(error, res);
  }
});

// Normal operation
router.post('/normal', async (req, res) => {
  try {
    const result = await dataCollector.normalOperation();
    res.json(result);
  } catch (error) {
    handleModbusError(error, res);
  }
});

// Stop dispatch
router.post('/stop', async (req, res) => {
  try {
    const result = await dataCollector.stopDispatch();
    res.json(result);
  } catch (error) {
    handleModbusError(error, res);
  }
});

export default router;