/**
 * Predictive Demand Forecasting Service
 * Forecasts ICU staffing needs based on historical patterns and external factors
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSharedMemoryService } from '../shared-memory-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Demand Forecast Service
 */
export class DemandForecastService {
  constructor(options = {}) {
    this.memory = getSharedMemoryService();
    this.dataDir = options.dataDir || path.join(__dirname, '../../data');
    this.predictionHorizon = options.predictionHorizon || 14; // days
    this.enableLogging = options.enableLogging || true;
    
    // Historical patterns cache
    this.patterns = null;
    this.lastPatternUpdate = null;
  }

  log(...args) {
    if (this.enableLogging) {
      console.log('[DemandForecast]', ...args);
    }
  }

  /**
   * Generate demand forecast for upcoming period
   */
  async generateForecast(startDate, days = 14) {
    this.log(`Generating forecast from ${startDate} for ${days} days`);
    
    const patterns = await this.loadHistoricalPatterns();
    const externalFactors = await this.getExternalFactors(startDate, days);
    const forecast = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Base prediction from historical patterns
      const dayOfWeek = date.getDay();
      const month = date.getMonth();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      const basePrediction = this.calculateBaseDemand(dateStr, patterns, {
        dayOfWeek,
        month,
        isWeekend,
      });

      // Apply external factors
      const adjustedPrediction = this.applyExternalFactors(
        basePrediction,
        externalFactors[dateStr] || {}
      );

      forecast.push({
        date: dateStr,
        dayOfWeek,
        isWeekend,
        ...adjustedPrediction,
        confidence: this.calculateConfidence(adjustedPrediction, patterns),
        factors: externalFactors[dateStr],
      });
    }

    // Store forecast in shared memory
    const forecastKey = `forecast:${startDate}:${days}`;
    this.memory.set(forecastKey, {
      generatedAt: Date.now(),
      startDate,
      days,
      forecast,
    });

    this.log(`Forecast generated with ${forecast.length} days`);
    return forecast;
  }

  /**
   * Calculate base demand from historical patterns
   */
  calculateBaseDemand(dateStr, patterns, context) {
    const { dayOfWeek, month, isWeekend } = context;
    
    // Day-of-week pattern
    const dowPattern = patterns.dayOfWeek[dayOfWeek] || { avgDemand: 3, stdDev: 0.5 };
    
    // Monthly/seasonal pattern
    const seasonalPattern = patterns.seasonal[month] || { multiplier: 1.0 };
    
    // Recent trend (last 4 weeks same day)
    const recentTrend = this.calculateRecentTrend(dateStr, dayOfWeek, patterns);

    // Base demand calculation
    const baseDayDemand = Math.round(
      (dowPattern.avgDemand * seasonalPattern.multiplier + recentTrend) / 2
    );

    return {
      dayShift: {
        required: baseDayDemand,
        optimal: baseDayDemand + 1,
        skills: ['general', 'stroke', 'trauma'],
      },
      nightShift: {
        required: Math.max(2, Math.round(baseDayDemand * 0.7)),
        optimal: Math.max(2, Math.round(baseDayDemand * 0.8)),
        skills: ['general', 'stroke'],
      },
      nmEtShift: {
        required: isWeekend ? 0 : 1,
        optimal: isWeekend ? 0 : 1,
        skills: ['general'],
      },
    };
  }

  /**
   * Apply external factors to base prediction
   */
  applyExternalFactors(basePrediction, factors) {
    let multiplier = 1.0;
    const appliedFactors = [];

    // Flu season impact
    if (factors.fluLevel === 'high') {
      multiplier += 0.3;
      appliedFactors.push('high_flu_activity');
    } else if (factors.fluLevel === 'medium') {
      multiplier += 0.15;
      appliedFactors.push('medium_flu_activity');
    }

    // Local events
    if (factors.localEvents?.length > 0) {
      for (const event of factors.localEvents) {
        if (event.type === 'sports' && event.expectedAttendance > 50000) {
          multiplier += 0.2;
          appliedFactors.push(`major_event_${event.name}`);
        } else if (event.type === 'weather' && event.severity === 'severe') {
          multiplier += 0.25;
          appliedFactors.push('severe_weather_expected');
        }
      }
    }

    // Holiday impact
    if (factors.isHoliday) {
      multiplier -= 0.2; // Lower elective admissions
      appliedFactors.push('holiday');
    }

    // Academic calendar
    if (factors.academicCalendar?.residentChangeover) {
      multiplier += 0.1; // Slight increase due to transitions
      appliedFactors.push('resident_changeover');
    }

    const adjusted = JSON.parse(JSON.stringify(basePrediction));
    
    for (const shiftType of Object.keys(adjusted)) {
      adjusted[shiftType].required = Math.round(adjusted[shiftType].required * multiplier);
      adjusted[shiftType].optimal = Math.round(adjusted[shiftType].optimal * multiplier);
      adjusted[shiftType].factors = appliedFactors;
    }

    return adjusted;
  }

  /**
   * Calculate confidence score for prediction
   */
  calculateConfidence(prediction, patterns) {
    // Higher confidence with more historical data
    const dataQuality = patterns.dataPoints > 90 ? 1.0 : patterns.dataPoints / 90;
    
    // Lower confidence for predictions further out
    const timeDecay = 0.95;
    
    // Confidence based on pattern stability
    const patternStability = 1 - (patterns.variance || 0.2);

    return Math.round((dataQuality * timeDecay * patternStability) * 100);
  }

  /**
   * Calculate recent trend from last 4 weeks
   */
  calculateRecentTrend(dateStr, dayOfWeek, patterns) {
    const recentData = patterns.recentFourWeeks?.[dayOfWeek] || [];
    if (recentData.length < 2) return 0;

    const trend = recentData.reduce((sum, val, idx, arr) => {
      if (idx === 0) return 0;
      return sum + (val - arr[idx - 1]);
    }, 0) / (recentData.length - 1);

    return trend;
  }

  /**
   * Load historical patterns from stored data
   */
  async loadHistoricalPatterns() {
    // Return cached patterns if recent
    if (this.patterns && this.lastPatternUpdate && 
        Date.now() - this.lastPatternUpdate < 3600000) {
      return this.patterns;
    }

    try {
      const patternsPath = path.join(this.dataDir, 'demand-patterns.json');
      const data = await fs.readFile(patternsPath, 'utf-8');
      this.patterns = JSON.parse(data);
      this.lastPatternUpdate = Date.now();
      return this.patterns;
    } catch (error) {
      this.log('Using default patterns');
      return this.getDefaultPatterns();
    }
  }

  /**
   * Get external factors for date range
   */
  async getExternalFactors(startDate, days) {
    const factors = {};
    
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      factors[dateStr] = {
        fluLevel: this.getFluLevel(date),
        isHoliday: this.isHoliday(date),
        localEvents: this.getLocalEvents(date),
        academicCalendar: this.getAcademicCalendar(date),
      };
    }

    return factors;
  }

  /**
   * Get flu activity level (placeholder - would integrate CDC data)
   */
  getFluLevel(date) {
    const month = date.getMonth();
    // Flu season typically Oct - March
    if (month >= 9 || month <= 2) {
      const levels = ['low', 'medium', 'high'];
      return levels[Math.floor(Math.random() * levels.length)];
    }
    return 'low';
  }

  /**
   * Check if date is a holiday
   */
  isHoliday(date) {
    const holidays = [
      '01-01', // New Year
      '07-04', // Independence Day
      '12-25', // Christmas
      '12-24', // Christmas Eve
    ];
    const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return holidays.includes(dateStr);
  }

  /**
   * Get local events (placeholder - would integrate event APIs)
   */
  getLocalEvents(date) {
    const events = [];
    const dayOfWeek = date.getDay();
    
    // Weekend events
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      if (Math.random() > 0.7) {
        events.push({
          type: 'sports',
          name: 'Football Game',
          expectedAttendance: 60000 + Math.floor(Math.random() * 20000),
        });
      }
    }

    return events;
  }

  /**
   * Get academic calendar info
   */
  getAcademicCalendar(date) {
    const month = date.getMonth();
    const day = date.getDate();
    
    // Resident changeover typically July 1
    const isChangeover = month === 6 && day <= 7;
    
    return {
      residentChangeover: isChangeover,
      academicYear: month >= 6 ? `${date.getFullYear()}-${date.getFullYear() + 1}` : `${date.getFullYear() - 1}-${date.getFullYear()}`,
    };
  }

  /**
   * Get default patterns when no historical data
   */
  getDefaultPatterns() {
    return {
      dayOfWeek: {
        0: { avgDemand: 3.5, stdDev: 0.8 }, // Sunday
        1: { avgDemand: 4.0, stdDev: 0.7 }, // Monday
        2: { avgDemand: 4.0, stdDev: 0.7 }, // Tuesday
        3: { avgDemand: 4.0, stdDev: 0.7 }, // Wednesday
        4: { avgDemand: 4.0, stdDev: 0.7 }, // Thursday
        5: { avgDemand: 4.5, stdDev: 0.9 }, // Friday
        6: { avgDemand: 4.5, stdDev: 0.9 }, // Saturday
      },
      seasonal: {
        0: { multiplier: 1.1 },  // January (flu season)
        1: { multiplier: 1.05 }, // February
        2: { multiplier: 1.0 },  // March
        3: { multiplier: 0.95 }, // April
        4: { multiplier: 0.95 }, // May
        5: { multiplier: 0.9 },  // June
        6: { multiplier: 0.9 },  // July
        7: { multiplier: 0.95 }, // August
        8: { multiplier: 1.0 },  // September
        9: { multiplier: 1.05 }, // October
        10: { multiplier: 1.1 }, // November
        11: { multiplier: 1.15 }, // December (holidays + flu)
      },
      recentFourWeeks: {},
      dataPoints: 0,
      variance: 0.2,
    };
  }

  /**
   * Update patterns from new schedule data
   */
  async updatePatterns(scheduleData) {
    this.log('Updating demand patterns from schedule data');
    
    const patterns = await this.loadHistoricalPatterns();
    
    // Analyze schedule data to update patterns
    for (const slot of scheduleData.slots || []) {
      const date = new Date(slot.date);
      const dayOfWeek = date.getDay();
      const month = date.getMonth();
      
      // Update day-of-week statistics
      if (!patterns.dayOfWeek[dayOfWeek]) {
        patterns.dayOfWeek[dayOfWeek] = { sum: 0, count: 0 };
      }
      patterns.dayOfWeek[dayOfWeek].sum += 1;
      patterns.dayOfWeek[dayOfWeek].count += 1;
      
      // Recalculate averages
      for (const dow of Object.keys(patterns.dayOfWeek)) {
        const data = patterns.dayOfWeek[dow];
        data.avgDemand = data.sum / data.count;
      }
    }

    patterns.dataPoints += scheduleData.slots?.length || 0;
    patterns.lastUpdated = Date.now();

    // Save updated patterns
    await this.savePatterns(patterns);
    this.patterns = patterns;
    this.lastPatternUpdate = Date.now();

    this.log('Patterns updated');
  }

  /**
   * Save patterns to disk
   */
  async savePatterns(patterns) {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      const patternsPath = path.join(this.dataDir, 'demand-patterns.json');
      await fs.writeFile(patternsPath, JSON.stringify(patterns, null, 2));
    } catch (error) {
      console.error('Failed to save patterns:', error);
    }
  }

  /**
   * Compare forecast vs actual for accuracy tracking
   */
  async analyzeAccuracy(forecastDate, actualData) {
    const forecast = this.memory.get(`forecast:${forecastDate}:14`);
    if (!forecast) return null;

    const analysis = {
      forecastDate,
      analyzedAt: Date.now(),
      dayByDay: [],
      overallAccuracy: 0,
    };

    for (const day of forecast.forecast) {
      const actual = actualData[day.date];
      if (!actual) continue;

      const accuracy = this.calculateDayAccuracy(day, actual);
      analysis.dayByDay.push({
        date: day.date,
        predicted: day.dayShift.required,
        actual: actual.dayStaffing,
        accuracy,
      });
    }

    // Calculate overall accuracy
    const totalAccuracy = analysis.dayByDay.reduce((sum, d) => sum + d.accuracy, 0);
    analysis.overallAccuracy = totalAccuracy / analysis.dayByDay.length;

    // Store accuracy analysis
    this.memory.set(`forecast:accuracy:${forecastDate}`, analysis);
    
    return analysis;
  }

  /**
   * Calculate accuracy for a single day
   */
  calculateDayAccuracy(predicted, actual) {
    const diff = Math.abs(predicted.dayShift.required - actual.dayStaffing);
    return Math.max(0, 1 - diff / predicted.dayShift.required);
  }
}

// Singleton
let service = null;
export function getDemandForecastService(options) {
  if (!service) {
    service = new DemandForecastService(options);
  }
  return service;
}

export default DemandForecastService;
