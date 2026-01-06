// src/routes/index.js - ADD THIS IMPORT AND ROUTE
import express from 'express';
import alphaessRoutes from './alphaess.js';
import historyRoutes from './history.js';
import dispatchRoutes from './dispatch.js';
import settingsRoutes from './settings.js';
import systemRoutes from './system.js'; // ADD THIS LINE

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Mount routes
router.use('/alphaess', alphaessRoutes);
router.use('/history', historyRoutes);
router.use('/dispatch', dispatchRoutes);
router.use('/settings', settingsRoutes);
router.use('/system', systemRoutes); // ADD THIS LINE

export default router;