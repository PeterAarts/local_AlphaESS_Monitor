// server.js (UPDATED)
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './src/routes/index.js';
import dataCollector from './src/services/dataCollector.js';
import scheduler from './src/services/scheduler.js';
import { requestLogger } from './src/middleware/logger.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import appConfig from './src/config/app.js';
import { modbusConfig, collectionConfig } from './src/config/modbus.js';


dotenv.config();

const app = express();
const PORT = appConfig.port;

// Middleware
app.use(cors({
  origin: appConfig.corsOrigin,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// API Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Alpha ESS Local Monitor API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      status: '/api/alphaess/status',
      history: '/api/history',
      dispatch: '/api/dispatch',
      settings: '/api/settings'
    }
  });
});

// Error handling (must be last)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const server = app.listen(PORT, async () => {
  console.log('\n========================================');
  console.log('🔋 Alpha ESS Local Monitor API');
  console.log('========================================');
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Environment: ${appConfig.nodeEnv}`);
  console.log('========================================\n');

  // Start data collection
  try {
    if (!modbusConfig.ip || modbusConfig.ip === '192.168.1.100') {
      console.warn('⚠ ALPHA_ESS_IP not configured - set in .env file');
      console.warn('⚠ Data collection disabled\n');
    } else {
      await dataCollector.start(
        modbusConfig.ip,
        modbusConfig.port,
        modbusConfig.slaveId,
        collectionConfig.snapshotInterval
      );
      
      // Start scheduler
      await scheduler.start();
    }
  } catch (error) {
    console.error('❌ Failed to start services:', error.message);
  }
});

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down...`);
  
  server.close(async () => {
    console.log('✓ HTTP server closed');
    
    try {
      await scheduler.stop();
      await dataCollector.stop();
      console.log('✓ Services stopped');
    } catch (error) {
      console.error('❌ Error during shutdown:', error.message);
    }
    
    process.exit(0);
  });

  setTimeout(() => {
    console.error('⚠ Forced shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});