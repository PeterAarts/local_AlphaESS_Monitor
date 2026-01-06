// src/routes/settings.js
import express from 'express';
import settingsController from '../controllers/settingsController.js';

const router = express.Router();

// System configuration
router.get('/config', settingsController.getConfig.bind(settingsController));
router.put('/config', settingsController.updateConfig.bind(settingsController));

// Tariffs
router.get('/tariffs', settingsController.getTariffs.bind(settingsController));
router.post('/tariffs', settingsController.createTariff.bind(settingsController));
router.put('/tariffs/:id', settingsController.updateTariff.bind(settingsController));
router.delete('/tariffs/:id', settingsController.deleteTariff.bind(settingsController));

export default router;