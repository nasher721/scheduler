/**
 * Personalized Preference Learning Service
 * Learns provider preferences from historical behavior
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSharedMemoryService } from '../shared-memory-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Preference Learning Service
 */
export class PreferenceLearningService {
  constructor(options = {}) {
    this.memory = getSharedMemoryService();
    this.dataDir = options.dataDir || path.join(__dirname, '../../data');
    this.enableLogging = options.enableLogging || true;
    this.models = new Map(); // providerId -> learned model
  }

  log(...args) {
    if (this.enableLogging) {
      console.log('[PreferenceLearning]', ...args);
    }
  }

  /**
   * Learn preferences for a provider from historical data
   */
  async learnProviderPreferences(providerId, historicalData) {
    this.log(`Learning preferences for provider ${providerId}`);

    const model = {
      providerId,
      lastUpdated: Date.now(),
      // Learned patterns
      shiftTypePreference: this.analyzeShiftTypePreference(historicalData),
      dayOfWeekPreference: this.analyzeDayOfWeekPreference(historicalData),
      seasonalVariation: this.analyzeSeasonalVariation(historicalData),
      pairingPreferences: this.analyzePairingPreferences(historicalData),
      fatiguePattern: this.analyzeFatiguePattern(historicalData),
      requestPatterns: this.analyzeRequestPatterns(historicalData),
      acceptancePatterns: this.analyzeAcceptancePatterns(historicalData),
      // Confidence scores
      confidence: {},
    };

    // Calculate confidence for each preference
    for (const [key, value] of Object.entries(model)) {
      if (typeof value === 'object' && value?.dataPoints) {
        model.confidence[key] = Math.min(1, value.dataPoints / 30); // 30 data points = high confidence
      }
    }

    this.models.set(providerId, model);
    
    // Store in shared memory
    this.memory.set(`preference:model:${providerId}`, model);
    
    // Persist to disk
    await this.saveModel(providerId, model);

    this.log(`Preference model created for ${providerId} with confidence scores:`, model.confidence);
    return model;
  }

  /**
   * Analyze shift type preferences (day vs night)
   */
  analyzeShiftTypePreference(data) {
    const shifts = data.slots || [];
    const requests = data.timeOffRequests || [];
    
    const dayShifts = shifts.filter(s => s.type === 'DAY').length;
    const nightShifts = shifts.filter(s => s.type === 'NIGHT').length;
    const total = dayShifts + nightShifts;

    if (total === 0) return { preference: 'unknown', strength: 0, dataPoints: 0 };

    // Calculate ratio
    const dayRatio = dayShifts / total;
    const nightRatio = nightShifts / total;

    // Analyze requests (requesting off night shifts suggests day preference)
    const nightTimeOff = requests.filter(r => {
      // Check if request was for a night shift
      const shiftOnThatDay = shifts.find(s => s.date === r.date);
      return shiftOnThatDay?.type === 'NIGHT';
    }).length;

    // Adjust preference based on requests
    let preference = 'neutral';
    let strength = 0;

    if (dayRatio > 0.7 && nightTimeOff > 2) {
      preference = 'day';
      strength = Math.min(1, (dayRatio - 0.5) * 2 + nightTimeOff * 0.1);
    } else if (nightRatio > 0.7) {
      preference = 'night';
      strength = Math.min(1, (nightRatio - 0.5) * 2);
    }

    return {
      preference,
      strength: Math.round(strength * 100) / 100,
      dayRatio: Math.round(dayRatio * 100) / 100,
      nightRatio: Math.round(nightRatio * 100) / 2,
      dataPoints: total,
    };
  }

  /**
   * Analyze day-of-week preferences
   */
  analyzeDayOfWeekPreference(data) {
    const shifts = data.slots || [];
    const byDayOfWeek = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    
    for (const shift of shifts) {
      const date = new Date(shift.date);
      const dow = date.getDay();
      byDayOfWeek[dow]++;
    }

    const total = shifts.length;
    const avg = total / 7;

    // Find preferred days (above average)
    const preferences = byDayOfWeek.map((count, dow) => {
      const preference = count > avg * 1.2 ? 'preferred' : 
                        count < avg * 0.5 ? 'avoided' : 'neutral';
      return {
        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow],
        count,
        preference,
        deviation: Math.round(((count - avg) / avg) * 100),
      };
    });

    return {
      byDay: preferences,
      preferredDays: preferences.filter(p => p.preference === 'preferred').map(p => p.day),
      avoidedDays: preferences.filter(p => p.preference === 'avoided').map(p => p.day),
      dataPoints: total,
    };
  }

  /**
   * Analyze seasonal variation
   */
  analyzeSeasonalVariation(data) {
    const shifts = data.slots || [];
    const byMonth = new Array(12).fill(0);
    
    for (const shift of shifts) {
      const month = new Date(shift.date).getMonth();
      byMonth[month]++;
    }

    const total = shifts.length;
    const avgPerMonth = total / 12;

    const monthlyPatterns = byMonth.map((count, month) => ({
      month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month],
      count,
      likelihood: count > 0 ? Math.round((count / avgPerMonth) * 100) / 100 : 0,
    }));

    return {
      byMonth: monthlyPatterns,
      highSeason: monthlyPatterns.filter(m => m.likelihood > 1.2).map(m => m.month),
      lowSeason: monthlyPatterns.filter(m => m.likelihood < 0.5).map(m => m.month),
      dataPoints: total,
    };
  }

  /**
   * Analyze pairing preferences (who they like working with)
   */
  analyzePairingPreferences(data) {
    const shifts = data.slots || [];
    const pairings = {};

    // Group shifts by date to find co-workers
    const byDate = {};
    for (const shift of shifts) {
      if (!byDate[shift.date]) byDate[shift.date] = [];
      byDate[shift.date].push(shift);
    }

    // Count pairings
    for (const [date, dayShifts] of Object.entries(byDate)) {
      if (dayShifts.length < 2) continue;
      
      for (let i = 0; i < dayShifts.length; i++) {
        for (let j = i + 1; j < dayShifts.length; j++) {
          const pair = [dayShifts[i].providerId, dayShifts[j].providerId].sort().join('-');
          pairings[pair] = (pairings[pair] || 0) + 1;
        }
      }
    }

    // Convert to sorted list
    const sorted = Object.entries(pairings)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pair, count]) => ({ pair, count }));

    return {
      frequentPairs: sorted,
      totalPairings: Object.values(pairings).reduce((a, b) => a + b, 0),
      dataPoints: shifts.length,
    };
  }

  /**
   * Analyze fatigue patterns
   */
  analyzeFatiguePattern(data) {
    const shifts = data.slots || [];
    
    // Sort by date
    const sorted = shifts.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Find consecutive shifts
    let maxConsecutive = 0;
    let currentConsecutive = 0;
    const fatigueMarkers = [];

    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) {
        currentConsecutive = 1;
        continue;
      }

      const prevDate = new Date(sorted[i - 1].date);
      const currDate = new Date(sorted[i].date);
      const diffDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);

      if (diffDays <= 1) {
        currentConsecutive++;
      } else {
        if (currentConsecutive > maxConsecutive) {
          maxConsecutive = currentConsecutive;
        }
        // Check if this was followed by a request off
        const nextShift = sorted[i];
        if (diffDays > 2) {
          fatigueMarkers.push({
            afterConsecutive: currentConsecutive,
            restDays: diffDays - 1,
          });
        }
        currentConsecutive = 1;
      }
    }

    // Analyze if provider requests time off after long stretches
    const avgRestAfterLong = fatigueMarkers
      .filter(m => m.afterConsecutive >= 4)
      .reduce((sum, m) => sum + m.restDays, 0) / 
      fatigueMarkers.filter(m => m.afterConsecutive >= 4).length || 0;

    return {
      maxConsecutiveShifts: maxConsecutive,
      avgRestAfterLongStretch: Math.round(avgRestAfterLong * 10) / 10,
      fatigueIndicators: avgRestAfterLong > 2 ? 'high' : avgRestAfterLong > 1 ? 'medium' : 'low',
      recommendedMaxConsecutive: Math.max(3, maxConsecutive - 1),
      dataPoints: shifts.length,
    };
  }

  /**
   * Analyze time-off request patterns
   */
  analyzeRequestPatterns(data) {
    const requests = data.timeOffRequests || [];
    
    const byMonth = new Array(12).fill(0);
    const byDayOfWeek = [0, 0, 0, 0, 0, 0, 0];
    
    for (const request of requests) {
      const date = new Date(request.date);
      byMonth[date.getMonth()]++;
      byDayOfWeek[date.getDay()]++;
    }

    // Find patterns
    const totalRequests = requests.length;
    const avgPerMonth = totalRequests / 12;

    const highRequestMonths = byMonth
      .map((count, idx) => ({ month: idx, count }))
      .filter(m => m.count > avgPerMonth * 1.5)
      .map(m => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m.month]);

    const preferredDaysOff = byDayOfWeek
      .map((count, idx) => ({ day: idx, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.day]);

    return {
      totalRequests,
      byMonth,
      byDayOfWeek,
      highRequestMonths,
      preferredDaysOff,
      avgNoticeDays: this.calculateAvgNoticeDays(requests),
      dataPoints: totalRequests,
    };
  }

  /**
   * Calculate average notice days for requests
   */
  calculateAvgNoticeDays(requests) {
    if (requests.length === 0) return 0;
    
    const noticeDays = requests.map(r => {
      const requestDate = new Date(r.requestedAt || r.date);
      const targetDate = new Date(r.date);
      return (targetDate - requestDate) / (1000 * 60 * 60 * 24);
    });

    return Math.round(noticeDays.reduce((a, b) => a + b, 0) / noticeDays.length);
  }

  /**
   * Analyze acceptance patterns (open shifts, swaps)
   */
  analyzeAcceptancePatterns(data) {
    const acceptances = data.acceptedShifts || [];
    const offers = data.offeredShifts || [];

    if (offers.length === 0) {
      return { acceptanceRate: 0, dataPoints: 0 };
    }

    const acceptanceRate = acceptances.length / offers.length;

    // Analyze by shift type
    const byShiftType = {};
    for (const offer of offers) {
      const accepted = acceptances.some(a => a.shiftId === offer.shiftId);
      if (!byShiftType[offer.type]) {
        byShiftType[offer.type] = { offered: 0, accepted: 0 };
      }
      byShiftType[offer.type].offered++;
      if (accepted) byShiftType[offer.type].accepted++;
    }

    // Calculate rates
    for (const type of Object.keys(byShiftType)) {
      byShiftType[type].rate = Math.round(
        (byShiftType[type].accepted / byShiftType[type].offered) * 100
      ) / 100;
    }

    return {
      overallAcceptanceRate: Math.round(acceptanceRate * 100) / 100,
      byShiftType,
      responsiveness: acceptanceRate > 0.7 ? 'high' : acceptanceRate > 0.4 ? 'medium' : 'low',
      dataPoints: offers.length,
    };
  }

  /**
   * Get personalized recommendation for a shift
   */
  getShiftRecommendation(providerId, shift) {
    const model = this.models.get(providerId) || this.memory.get(`preference:model:${providerId}`);
    
    if (!model) {
      return { score: 0.5, reason: 'No preference data available' };
    }

    let score = 0.5;
    const factors = [];

    // Shift type preference
    if (model.shiftTypePreference.preference !== 'unknown') {
      const matchesPreference = 
        (shift.type === 'DAY' && model.shiftTypePreference.preference === 'day') ||
        (shift.type === 'NIGHT' && model.shiftTypePreference.preference === 'night');
      
      if (matchesPreference) {
        score += 0.2 * model.shiftTypePreference.strength;
        factors.push('Matches shift type preference');
      } else {
        score -= 0.15 * model.shiftTypePreference.strength;
        factors.push('Contradicts shift type preference');
      }
    }

    // Day of week preference
    const shiftDow = new Date(shift.date).getDay();
    const dowName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][shiftDow];
    
    if (model.dayOfWeekPreference.preferredDays?.includes(dowName)) {
      score += 0.15;
      factors.push(`Prefers ${dowName}`);
    } else if (model.dayOfWeekPreference.avoidedDays?.includes(dowName)) {
      score -= 0.1;
      factors.push(`Usually avoids ${dowName}`);
    }

    // Seasonal variation
    const shiftMonth = new Date(shift.date).getMonth();
    const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][shiftMonth];
    
    if (model.seasonalVariation.highSeason?.includes(monthName)) {
      score += 0.1;
      factors.push(`High availability in ${monthName}`);
    }

    // Fatigue considerations
    if (model.fatiguePattern.fatigueIndicators === 'high') {
      score -= 0.1;
      factors.push('Shows fatigue patterns - monitor workload');
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      factors,
      confidence: Object.values(model.confidence).reduce((a, b) => a + b, 0) / Object.values(model.confidence).length,
    };
  }

  /**
   * Get all providers' preference models
   */
  getAllModels() {
    const models = {};
    for (const [providerId, model] of this.models) {
      models[providerId] = model;
    }
    return models;
  }

  /**
   * Save model to disk
   */
  async saveModel(providerId, model) {
    try {
      const modelsDir = path.join(this.dataDir, 'preference-models');
      await fs.mkdir(modelsDir, { recursive: true });
      
      const filePath = path.join(modelsDir, `${providerId}.json`);
      await fs.writeFile(filePath, JSON.stringify(model, null, 2));
    } catch (error) {
      console.error('Failed to save preference model:', error);
    }
  }

  /**
   * Load model from disk
   */
  async loadModel(providerId) {
    try {
      const filePath = path.join(this.dataDir, 'preference-models', `${providerId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const model = JSON.parse(data);
      this.models.set(providerId, model);
      this.memory.set(`preference:model:${providerId}`, model);
      return model;
    } catch (error) {
      return null;
    }
  }

  /**
   * Batch learn all providers
   */
  async learnAllProviders(scheduleState) {
    this.log('Starting batch preference learning for all providers');
    
    const results = [];
    
    for (const provider of scheduleState.providers) {
      const historicalData = {
        slots: scheduleState.slots.filter(s => s.providerId === provider.id),
        timeOffRequests: provider.timeOffRequests || [],
      };

      const model = await this.learnProviderPreferences(provider.id, historicalData);
      results.push({
        providerId: provider.id,
        name: provider.name,
        confidence: model.confidence,
      });
    }

    this.log(`Batch learning complete for ${results.length} providers`);
    return results;
  }
}

// Singleton
let service = null;
export function getPreferenceLearningService(options) {
  if (!service) {
    service = new PreferenceLearningService(options);
  }
  return service;
}

export default PreferenceLearningService;
