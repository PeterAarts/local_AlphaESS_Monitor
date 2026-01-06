// src/services/scheduler.js
import pool from '../config/database.js';
import dataCollector from './dataCollector.js';

class Scheduler {
  constructor() {
    this.schedules = [];
    this.checkInterval = null;
  }

  async start() {
    console.log('⏰ Starting scheduler...');
    await this.loadSchedules();
    
    // Check every minute
    this.checkInterval = setInterval(() => {
      this.checkSchedules();
    }, 60000);
    
    console.log('✓ Scheduler started');
  }

  async loadSchedules() {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM scheduled_dispatch WHERE enabled = TRUE'
      );
      this.schedules = rows;
      console.log(`✓ Loaded ${rows.length} active schedules`);
    } catch (error) {
      console.error('Error loading schedules:', error.message);
    }
  }

  async checkSchedules() {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];

    for (const schedule of this.schedules) {
      // Check if schedule should run
      const startTime = schedule.start_time.substring(0, 5); // HH:MM
      const daysOfWeek = schedule.days_of_week.split(',');

      if (currentTime === startTime && daysOfWeek.includes(currentDay)) {
        console.log(`⏰ Triggering scheduled task: ${schedule.name}`);
        await this.executeSchedule(schedule);
      }
    }
  }

  async executeSchedule(schedule) {
    try {
      const duration = schedule.duration || 3600; // Default 1 hour

      if (schedule.mode === 'charge_from_grid') {
        await dataCollector.chargeFromGrid(
          schedule.target_power,
          schedule.target_soc,
          duration / 3600,
          'schedule'
        );
      } else if (schedule.mode === 'discharge_to_grid') {
        await dataCollector.dischargeToGrid(
          schedule.target_power,
          schedule.target_soc,
          duration / 3600,
          'schedule'
        );
      }

      console.log(`✓ Executed schedule: ${schedule.name}`);
    } catch (error) {
      console.error(`Error executing schedule ${schedule.name}:`, error.message);
    }
  }

  async stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      console.log('✓ Scheduler stopped');
    }
  }
}

export default new Scheduler();