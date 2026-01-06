// scripts/init-database.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

const DB_NAME = process.env.DB_NAME || 'alpha_ess';

async function initDatabase() {
  let connection;

  try {
    console.log('========================================');
    console.log('🔧 Alpha ESS Database Initialization');
    console.log('========================================\n');

    // Connect to MySQL server (without database)
    console.log(`Connecting to MySQL at ${DB_CONFIG.host}:${DB_CONFIG.port}...`);
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✓ Connected to MySQL\n');

    // Create database if it doesn't exist
    console.log(`Creating database '${DB_NAME}'...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${DB_NAME}`);
    console.log(`✓ Database '${DB_NAME}' ready\n`);

    // Use the database
    await connection.query(`USE ${DB_NAME}`);

    // Read and execute SQL schema
    console.log('Creating tables...');
    const sqlPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(sqlPath, 'utf8');

    // Split by semicolon and execute each statement
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        await connection.query(statement);
      } catch (error) {
        // Ignore "table already exists" errors
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }

    console.log('✓ All tables created\n');

    // Insert default configuration if not exists
    console.log('Inserting default configuration...');
    await connection.query(`
      INSERT IGNORE INTO system_config (config_key, config_value, description, data_type) VALUES
      ('alpha_ess_ip', '${process.env.ALPHA_ESS_IP || '192.168.1.XXX'}', 'Alpha ESS inverter IP address', 'string'),
      ('alpha_ess_port', '${process.env.ALPHA_ESS_PORT || '502'}', 'Modbus TCP port', 'number'),
      ('alpha_ess_slave_id', '${process.env.ALPHA_ESS_SLAVE_ID || '85'}', 'Modbus slave ID', 'number'),
      ('snapshot_interval_seconds', '10', 'Data collection interval', 'number'),
      ('battery_capacity_kwh', '10.1', 'Total battery capacity', 'number'),
      ('battery_usable_capacity_kwh', '9.7', 'Usable battery capacity', 'number'),
      ('pv_capacity_kwp', '3.0', 'PV system capacity', 'number'),
      ('inverter_max_power_w', '5000', 'Inverter maximum power', 'number'),
      ('aggregation_enabled', 'true', 'Enable automatic data aggregation', 'boolean'),
      ('cleanup_snapshots_days', '7', 'Days to keep detailed snapshots', 'number'),
      ('default_currency', 'EUR', 'Currency for financial calculations', 'string'),
      ('timezone', 'Europe/Amsterdam', 'System timezone', 'string')
    `);
    console.log('✓ Default configuration inserted\n');

    // Insert sample tariffs
    console.log('Inserting sample electricity tariffs...');
    await connection.query(`
      INSERT IGNORE INTO electricity_tariffs (name, start_time, end_time, import_rate, export_rate, days_of_week, active) VALUES
      ('Night Rate', '23:00:00', '07:00:00', 0.15, 0.05, 'mon,tue,wed,thu,fri,sat,sun', TRUE),
      ('Peak Rate', '17:00:00', '21:00:00', 0.35, 0.08, 'mon,tue,wed,thu,fri', TRUE),
      ('Standard Rate', '07:00:00', '17:00:00', 0.25, 0.06, 'mon,tue,wed,thu,fri,sat,sun', TRUE),
      ('Weekend Rate', '00:00:00', '23:59:59', 0.20, 0.06, 'sat,sun', TRUE)
    `);
    console.log('✓ Sample tariffs inserted\n');

    // Check tables
    const [tables] = await connection.query('SHOW TABLES');
    console.log('✓ Database initialized successfully!');
    console.log(`\nCreated ${tables.length} tables:`);
    tables.forEach(table => {
      console.log(`  - ${Object.values(table)[0]}`);
    });

    console.log('\n========================================');
    console.log('✓ Initialization Complete!');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ Database initialization failed:');
    console.error(error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initDatabase();