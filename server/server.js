// server.js (ENHANCED WITH WEBSOCKET)
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import routes from './src/routes/index.js';
import dataCollector from './src/services/dataCollector.js';
import scheduler from './src/services/scheduler.js';
import websocketServer from './src/websocket/websocket.js';
import { requestLogger } from './src/middleware/logger.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import appConfig from './src/config/app.js';
import { modbusConfig, collectionConfig } from './src/config/modbus.js';

dotenv.config();

const app = express();
const PORT = appConfig.port;

// Create HTTP server (needed for WebSocket)
const server = http.createServer(app);

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
      settings: '/api/settings',
      websocket: 'ws://localhost:' + PORT + '/ws/power-data'
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
server.listen(PORT, async () => {
  console.log('\n========================================');
  console.log('🔋 Alpha ESS Local Monitor API');
  console.log('========================================');
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Environment: ${appConfig.nodeEnv}`);
  console.log('========================================\n');

  // Initialize WebSocket server (shares same HTTP server)
  try {
    websocketServer.initialize(server);
    console.log('✅ WebSocket server initialized\n');
  } catch (error) {
    console.error('❌ Failed to start WebSocket server:', error.message);
  }

  // Start data collection
  try {
    if (!modbusConfig.ip || modbusConfig.ip === '192.168.1.100') {
      console.warn('⚠ ALPHA_ESS_IP not configured - set in .env file');
      
      // Check if Cloud API is configured
      if (process.env.ALPHAESS_APP_ID && process.env.ALPHAESS_APP_SECRET && process.env.ALPHAESS_SYSTEM_SN) {
        console.log('ℹ️  ModBus disabled, but Cloud API is available');
        console.log('ℹ️  Starting with Cloud API as data source...\n');
        
        await dataCollector.start({
          cloudAppId: process.env.ALPHAESS_APP_ID,
          cloudAppSecret: process.env.ALPHAESS_APP_SECRET,
          cloudSystemSn: process.env.ALPHAESS_SYSTEM_SN,
          primarySource: 'cloud',
          snapshotInterval: parseInt(process.env.CLOUD_POLL_INTERVAL) || 60000
        });
        
        await scheduler.start();
      } else {
        console.warn('⚠  No data sources configured - set either ALPHA_ESS_IP or Cloud API credentials\n');
      }
    } else {
      // ModBus is configured
      const config = {
        modbusIp: modbusConfig.ip,
        modbusPort: modbusConfig.port,
        modbusSlaveId: modbusConfig.slaveId,
        snapshotInterval: collectionConfig.snapshotInterval,
        primarySource: process.env.PRIMARY_DATA_SOURCE || 'cloud'
      };

      // Add Cloud API if configured
      if (process.env.ALPHAESS_APP_ID && process.env.ALPHAESS_APP_SECRET && process.env.ALPHAESS_SYSTEM_SN) {
        config.cloudAppId = process.env.ALPHAESS_APP_ID;
        config.cloudAppSecret = process.env.ALPHAESS_APP_SECRET;
        config.cloudSystemSn = process.env.ALPHAESS_SYSTEM_SN;
        console.log('✅ Both Cloud API and ModBus configured - dual-source mode enabled\n');
      } else {
        console.log('ℹ️  ModBus only mode - Cloud API not configured\n');
      }

      await dataCollector.start(config);
      await scheduler.start();
    }
  } catch (error) {
    console.error('❌ Failed to start services:', error.message);
    console.log('⚠  API will continue running without data collection');
    console.log('⚠  Check configuration and restart\n');
  }
});

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down...`);
  
  server.close(async () => {
    console.log('✓ HTTP server closed');
    
    try {
      // Close WebSocket server
      websocketServer.close();
      console.log('✓ WebSocket server closed');
      
      // Stop scheduler and data collector
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