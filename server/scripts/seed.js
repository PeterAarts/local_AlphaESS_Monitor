// scripts/seed.js
import pool from '../src/config/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function seedDatabase() {
  console.log('🌱 Seeding database...\n');

  try {
    // Seed sample tariffs
    console.log('Seeding electricity tariffs...');
    await pool.execute(`
      INSERT IGNORE INTO electricity_tariffs 
      (name, start_time, end_time, import_rate, export_rate, days_of_week, active) VALUES
      ('Night Rate', '23:00:00', '07:00:00', 0.15, 0.05, 'mon,tue,wed,thu,fri,sat,sun', TRUE),
      ('Peak Rate', '17:00:00', '21:00:00', 0.35, 0.08, 'mon,tue,wed,thu,fri', TRUE),
      ('Standard Rate', '07:00:00', '17:00:00', 0.25, 0.06, 'mon,tue,wed,thu,fri,sat,sun', TRUE)
    `);

    // Seed sample scheduled dispatch
    console.log('Seeding scheduled dispatch...');
    await pool.execute(`
      INSERT IGNORE INTO scheduled_dispatch 
      (name, enabled, mode, start_time, duration, target_power, target_soc, days_of_week) VALUES
      ('Night Charging', FALSE, 'charge_from_grid', '23:00:00', 28800, 3000, 100, 'mon,tue,wed,thu,fri,sat,sun')
    `);

    console.log('✓ Seeding complete\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

seedDatabase();