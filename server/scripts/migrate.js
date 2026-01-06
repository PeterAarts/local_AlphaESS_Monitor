// scripts/migrate.js
import pool from '../src/config/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function runMigrations() {
  console.log('🔄 Running database migrations...\n');

  try {
    // Example migration: Add new column to energy_daily
    console.log('Adding battery_cycles column...');
    await pool.execute(`
      ALTER TABLE energy_daily 
      ADD COLUMN IF NOT EXISTS battery_cycles DECIMAL(5,2) 
      AFTER battery_soc_avg
    `);
    console.log('✓ Migration complete\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigrations();