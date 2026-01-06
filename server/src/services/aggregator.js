// src/services/aggregator.js
import db from './database.js';

class Aggregator {
  async runMinuteAggregation() {
    console.log('📊 Aggregating to minutes...');
    await db.aggregateToMinutes();
  }

  async runHourlyAggregation() {
    console.log('📊 Aggregating to hours...');
    await db.aggregateToHours();
  }

  async runDailyAggregation() {
    console.log('📊 Aggregating to daily...');
    await db.aggregateToDaily();
  }

  async runAllAggregations() {
    await this.runMinuteAggregation();
    await this.runHourlyAggregation();
  }
}

export default new Aggregator();