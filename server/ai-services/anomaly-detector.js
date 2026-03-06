/**
 * Real-time Anomaly Detection & Alerts Service
 * Monitors schedule continuously for issues and risks
 */

import { EventEmitter } from 'events';
import { getSharedMemoryService } from '../shared-memory-service.js';
import { callAIProvider } from './ai-adapter.js';

/**
 * Anomaly Detection Service
 */
export class AnomalyDetectionService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.memory = getSharedMemoryService();
    this.checkInterval = options.checkInterval || 5 * 60 * 1000; // 5 minutes
    this.enableLogging = options.enableLogging || true;
    this.isRunning = false;
    this.intervalId = null;
    
    // Alert history
    this.alertHistory = [];
    this.maxHistorySize = options.maxHistorySize || 1000;
    
    // Alert rules
    this.rules = this.initializeRules();
  }

  log(...args) {
    if (this.enableLogging) {
      console.log('[AnomalyDetector]', ...args);
    }
  }

  /**
   * Initialize default detection rules
   */
  initializeRules() {
    return {
      // Coverage rules
      coverageGaps: {
        enabled: true,
        severity: 'CRITICAL',
        check: (schedule) => this.checkCoverageGaps(schedule),
      },
      skillGaps: {
        enabled: true,
        severity: 'CRITICAL',
        check: (schedule) => this.checkSkillGaps(schedule),
      },
      
      // Compliance rules
      acgmeViolation: {
        enabled: true,
        severity: 'CRITICAL',
        check: (schedule) => this.checkACGMECompliance(schedule),
      },
      consecutiveShifts: {
        enabled: true,
        severity: 'HIGH',
        check: (schedule) => this.checkConsecutiveShifts(schedule),
      },
      
      // Fairness rules
      workloadImbalance: {
        enabled: true,
        severity: 'MEDIUM',
        check: (schedule) => this.checkWorkloadImbalance(schedule),
      },
      weekendImbalance: {
        enabled: true,
        severity: 'MEDIUM',
        check: (schedule) => this.checkWeekendImbalance(schedule),
      },
      
      // Burnout risk rules
      burnoutRisk: {
        enabled: true,
        severity: 'HIGH',
        check: (schedule) => this.checkBurnoutRisk(schedule),
      },
      
      // Pattern anomaly rules
      patternAnomaly: {
        enabled: true,
        severity: 'MEDIUM',
        check: (schedule) => this.checkPatternAnomalies(schedule),
      },
    };
  }

  /**
   * Start continuous monitoring
   */
  start() {
    if (this.isRunning) return;
    
    this.log('Starting anomaly detection service');
    this.isRunning = true;
    
    // Run initial check
    this.runDetection();
    
    // Set up interval
    this.intervalId = setInterval(() => {
      this.runDetection();
    }, this.checkInterval);
    
    this.emit('started');
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isRunning) return;
    
    this.log('Stopping anomaly detection service');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.emit('stopped');
  }

  /**
   * Run detection cycle
   */
  async runDetection() {
    const scheduleState = this.memory.get('schedule:state');
    if (!scheduleState) {
      this.log('No schedule state available for detection');
      return;
    }

    this.log('Running anomaly detection cycle');
    
    const alerts = [];
    
    // Run all enabled rules
    for (const [ruleName, rule] of Object.entries(this.rules)) {
      if (!rule.enabled) continue;
      
      try {
        const findings = await rule.check(scheduleState);
        if (findings && findings.length > 0) {
          for (const finding of findings) {
            alerts.push({
              id: `${ruleName}-${Date.now()}-${Math.random()}`,
              rule: ruleName,
              severity: finding.severity || rule.severity,
              category: this.getCategory(ruleName),
              title: finding.title,
              description: finding.description,
              affectedProviders: finding.affectedProviders || [],
              affectedShifts: finding.affectedShifts || [],
              timestamp: Date.now(),
              suggestedAction: finding.suggestedAction,
              autoResolvable: finding.autoResolvable || false,
            });
          }
        }
      } catch (error) {
        this.log(`Error running rule ${ruleName}:`, error);
      }
    }

    // Filter duplicates and store new alerts
    const newAlerts = this.filterDuplicateAlerts(alerts);
    
    if (newAlerts.length > 0) {
      this.log(`Detected ${newAlerts.length} new anomalies`);
      
      // Store alerts
      for (const alert of newAlerts) {
        this.addAlert(alert);
      }
      
      // Publish to shared memory
      this.memory.set('anomaly:alerts:recent', newAlerts);
      this.memory.set('anomaly:alerts:all', this.alertHistory.slice(-100));
      
      // Emit events
      for (const alert of newAlerts) {
        this.emit('anomaly:detected', alert);
        this.emit(`anomaly:${alert.severity.toLowerCase()}`, alert);
      }
    }

    // Update status
    this.memory.set('anomaly:status', {
      lastCheck: Date.now(),
      totalAlerts: this.alertHistory.length,
      activeAlerts: this.alertHistory.filter(a => !a.resolved).length,
    });
  }

  /**
   * Check for coverage gaps
   */
  checkCoverageGaps(schedule) {
    const gaps = [];
    const byDate = {};
    
    // Group by date
    for (const slot of schedule.slots) {
      if (!byDate[slot.date]) {
        byDate[slot.date] = [];
      }
      byDate[slot.date].push(slot);
    }

    // Check each date
    for (const [date, slots] of Object.entries(byDate)) {
      const unassigned = slots.filter(s => !s.providerId);
      
      if (unassigned.length > 0) {
        // Check if critical shifts are unassigned
        const criticalUnassigned = unassigned.filter(s => s.priority === 'CRITICAL');
        
        if (criticalUnassigned.length > 0) {
          gaps.push({
            title: 'Critical Coverage Gap',
            description: `${criticalUnassigned.length} critical shift(s) on ${date} have no assigned provider`,
            severity: 'CRITICAL',
            affectedShifts: criticalUnassigned.map(s => s.id),
            suggestedAction: 'Find provider with required skills or contact off-duty staff',
          });
        } else if (unassigned.length >= 2) {
          gaps.push({
            title: 'Multiple Coverage Gaps',
            description: `${unassigned.length} shifts on ${date} are unassigned`,
            severity: 'HIGH',
            affectedShifts: unassigned.map(s => s.id),
            suggestedAction: 'Review schedule and assign available providers',
          });
        }
      }
    }

    return gaps;
  }

  /**
   * Check for skill gaps
   */
  checkSkillGaps(schedule) {
    const gaps = [];
    
    for (const slot of schedule.slots) {
      if (!slot.providerId) continue;
      
      const provider = schedule.providers.find(p => p.id === slot.providerId);
      if (!provider) continue;
      
      // Check if provider has required skill
      if (slot.requiredSkill && !provider.skills?.includes(slot.requiredSkill)) {
        gaps.push({
          title: 'Skill Mismatch',
          description: `${provider.name} assigned to ${slot.type} shift on ${slot.date} but lacks ${slot.requiredSkill} certification`,
          severity: 'CRITICAL',
          affectedProviders: [provider.id],
          affectedShifts: [slot.id],
          suggestedAction: `Reassign to provider with ${slot.requiredSkill} certification`,
        });
      }
    }

    return gaps;
  }

  /**
   * Check ACGME compliance
   */
  checkACGMECompliance(schedule) {
    const violations = [];
    
    // Group shifts by provider and week
    const byProviderWeek = {};
    
    for (const slot of schedule.slots) {
      if (!slot.providerId) continue;
      
      const date = new Date(slot.date);
      const week = `${date.getFullYear()}-W${this.getWeekNumber(date)}`;
      const key = `${slot.providerId}-${week}`;
      
      if (!byProviderWeek[key]) {
        byProviderWeek[key] = {
          providerId: slot.providerId,
          week,
          shifts: [],
          totalHours: 0,
        };
      }
      
      byProviderWeek[key].shifts.push(slot);
      byProviderWeek[key].totalHours += slot.type === 'NIGHT' ? 12 : 12; // Assume 12-hour shifts
    }

    // Check each provider's weekly hours
    for (const data of Object.values(byProviderWeek)) {
      // ACGME 80-hour limit
      if (data.totalHours > 80) {
        const provider = schedule.providers.find(p => p.id === data.providerId);
        violations.push({
          title: 'ACGME Duty Hour Violation',
          description: `${provider?.name} scheduled for ${data.totalHours} hours in week ${data.week} (limit: 80)`,
          severity: 'CRITICAL',
          affectedProviders: [data.providerId],
          affectedShifts: data.shifts.map(s => s.id),
          suggestedAction: 'Reduce shifts or redistribute to other providers',
        });
      }

      // Check consecutive shifts
      const consecutive = this.findConsecutiveShifts(data.shifts);
      if (consecutive > 6) {
        const provider = schedule.providers.find(p => p.id === data.providerId);
        violations.push({
          title: 'Consecutive Shift Limit',
          description: `${provider?.name} scheduled for ${consecutive} consecutive shifts`,
          severity: 'CRITICAL',
          affectedProviders: [data.providerId],
          affectedShifts: data.shifts.map(s => s.id),
          suggestedAction: 'Insert mandatory rest day',
        });
      }
    }

    return violations;
  }

  /**
   * Check for excessive consecutive shifts
   */
  checkConsecutiveShifts(schedule) {
    const warnings = [];
    
    const byProvider = {};
    for (const slot of schedule.slots) {
      if (!slot.providerId) continue;
      if (!byProvider[slot.providerId]) {
        byProvider[slot.providerId] = [];
      }
      byProvider[slot.providerId].push(slot);
    }

    for (const [providerId, shifts] of Object.entries(byProvider)) {
      const sorted = shifts.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      let consecutive = 1;
      let maxConsecutive = 1;
      
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1].date);
        const curr = new Date(sorted[i].date);
        const diff = (curr - prev) / (1000 * 60 * 60 * 24);
        
        if (diff === 1) {
          consecutive++;
          maxConsecutive = Math.max(maxConsecutive, consecutive);
        } else {
          consecutive = 1;
        }
      }

      if (maxConsecutive >= 5) {
        const provider = schedule.providers.find(p => p.id === providerId);
        warnings.push({
          title: 'Excessive Consecutive Shifts',
          description: `${provider?.name} has ${maxConsecutive} consecutive shifts scheduled`,
          severity: maxConsecutive >= 7 ? 'HIGH' : 'MEDIUM',
          affectedProviders: [providerId],
          suggestedAction: 'Consider redistributing shifts to prevent burnout',
        });
      }
    }

    return warnings;
  }

  /**
   * Check workload imbalance
   */
  checkWorkloadImbalance(schedule) {
    const imbalances = [];
    
    // Calculate workload per provider
    const workload = {};
    for (const provider of schedule.providers) {
      workload[provider.id] = {
        provider,
        totalShifts: 0,
        weekendShifts: 0,
        nightShifts: 0,
      };
    }

    for (const slot of schedule.slots) {
      if (!slot.providerId) continue;
      
      workload[slot.providerId].totalShifts++;
      if (slot.isWeekendLayout) {
        workload[slot.providerId].weekendShifts++;
      }
      if (slot.type === 'NIGHT') {
        workload[slot.providerId].nightShifts++;
      }
    }

    // Calculate averages
    const values = Object.values(workload);
    const avgTotal = values.reduce((sum, w) => sum + w.totalShifts, 0) / values.length;
    const avgWeekend = values.reduce((sum, w) => sum + w.weekendShifts, 0) / values.length;

    // Find imbalances
    for (const data of values) {
      // Check total shifts
      if (data.totalShifts > avgTotal * 1.5) {
        imbalances.push({
          title: 'Workload Imbalance',
          description: `${data.provider.name} has ${data.totalShifts} shifts vs team average of ${avgTotal.toFixed(1)}`,
          severity: data.totalShifts > avgTotal * 2 ? 'HIGH' : 'MEDIUM',
          affectedProviders: [data.provider.id],
          suggestedAction: 'Redistribute shifts to underutilized providers',
        });
      }

      // Check weekend distribution
      if (data.weekendShifts > avgWeekend + 2) {
        imbalances.push({
          title: 'Weekend Imbalance',
          description: `${data.provider.name} has ${data.weekendShifts} weekend shifts vs average of ${avgWeekend.toFixed(1)}`,
          severity: 'MEDIUM',
          affectedProviders: [data.provider.id],
          suggestedAction: 'Balance weekend assignments across team',
        });
      }
    }

    return imbalances;
  }

  /**
   * Check weekend imbalance
   */
  checkWeekendImbalance(schedule) {
    // Similar to workload but focused on weekends
    return this.checkWorkloadImbalance(schedule).filter(i => 
      i.title === 'Weekend Imbalance'
    );
  }

  /**
   * Check burnout risk
   */
  checkBurnoutRisk(schedule) {
    const risks = [];
    
    for (const provider of schedule.providers) {
      const providerShifts = schedule.slots.filter(s => s.providerId === provider.id);
      
      // Count nights
      const nightCount = providerShifts.filter(s => s.type === 'NIGHT').length;
      if (nightCount > provider.targetWeekNights * 1.5) {
        risks.push({
          title: 'Burnout Risk: Excessive Nights',
          description: `${provider.name} scheduled for ${nightCount} nights (target: ${provider.targetWeekNights})`,
          severity: 'HIGH',
          affectedProviders: [provider.id],
          suggestedAction: 'Reduce night shifts or provide extended rest period',
        });
      }

      // Check for insufficient rest
      const sorted = providerShifts.sort((a, b) => new Date(a.date) - new Date(b.date));
      let minRest = Infinity;
      
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1].date);
        const curr = new Date(sorted[i].date);
        const rest = (curr - prev) / (1000 * 60 * 60 * 24) - 1;
        minRest = Math.min(minRest, rest);
      }

      if (minRest < 1) {
        risks.push({
          title: 'Burnout Risk: Insufficient Rest',
          description: `${provider.name} has shifts with no rest days in between`,
          severity: 'HIGH',
          affectedProviders: [provider.id],
          suggestedAction: 'Insert mandatory rest day between shifts',
        });
      }
    }

    return risks;
  }

  /**
   * Check for pattern anomalies using AI
   */
  async checkPatternAnomalies(schedule) {
    const anomalies = [];

    // Use AI to detect unusual patterns
    try {
      const prompt = `Analyze this schedule for unusual patterns that might indicate errors or risks:
${JSON.stringify({
  providerCount: schedule.providers.length,
  totalShifts: schedule.slots.length,
  shiftsByType: this.getShiftsByType(schedule),
  shiftsByDay: this.getShiftsByDay(schedule),
}, null, 2)}

Identify any patterns that deviate significantly from normal scheduling practices.
Respond with JSON array of anomalies found, or empty array if none.`;

      const response = await callAIProvider({
        provider: 'openai',
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      const parsed = JSON.parse(this.extractJson(response.content));
      if (Array.isArray(parsed)) {
        return parsed.map(a => ({
          title: a.title || 'Pattern Anomaly',
          description: a.description,
          severity: a.severity || 'MEDIUM',
          affectedProviders: a.affectedProviders || [],
          suggestedAction: a.suggestedAction,
        }));
      }
    } catch (error) {
      this.log('AI pattern analysis failed:', error);
    }

    return anomalies;
  }

  /**
   * Filter duplicate alerts
   */
  filterDuplicateAlerts(newAlerts) {
    return newAlerts.filter(alert => {
      // Check if similar alert exists in recent history
      const isDuplicate = this.alertHistory.some(existing => 
        existing.rule === alert.rule &&
        existing.title === alert.title &&
        existing.timestamp > Date.now() - 3600000 && // Within last hour
        JSON.stringify(existing.affectedShifts) === JSON.stringify(alert.affectedShifts)
      );
      return !isDuplicate;
    });
  }

  /**
   * Add alert to history
   */
  addAlert(alert) {
    this.alertHistory.push(alert);
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory.shift();
    }
  }

  /**
   * Get alert category
   */
  getCategory(ruleName) {
    const categories = {
      coverageGaps: 'COVERAGE',
      skillGaps: 'COVERAGE',
      acgmeViolation: 'COMPLIANCE',
      consecutiveShifts: 'COMPLIANCE',
      workloadImbalance: 'FAIRNESS',
      weekendImbalance: 'FAIRNESS',
      burnoutRisk: 'RISK',
      patternAnomaly: 'PATTERN',
    };
    return categories[ruleName] || 'OTHER';
  }

  /**
   * Get week number
   */
  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Find consecutive shifts
   */
  findConsecutiveShifts(shifts) {
    const sorted = shifts.sort((a, b) => new Date(a.date) - new Date(b.date));
    let maxConsecutive = 1;
    let current = 1;
    
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].date);
      const curr = new Date(sorted[i].date);
      const diff = (curr - prev) / (1000 * 60 * 60 * 24);
      
      if (diff === 1) {
        current++;
        maxConsecutive = Math.max(maxConsecutive, current);
      } else {
        current = 1;
      }
    }
    
    return maxConsecutive;
  }

  /**
   * Get shifts by type
   */
  getShiftsByType(schedule) {
    const counts = {};
    for (const slot of schedule.slots) {
      counts[slot.type] = (counts[slot.type] || 0) + 1;
    }
    return counts;
  }

  /**
   * Get shifts by day of week
   */
  getShiftsByDay(schedule) {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const slot of schedule.slots) {
      const dow = new Date(slot.date).getDay();
      counts[dow]++;
    }
    return counts;
  }

  /**
   * Extract JSON from response
   */
  extractJson(content) {
    const match = content.match(/\[[\s\S]*\]/);
    return match ? match[0] : '[]';
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId, resolution) {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      alert.resolution = resolution;
      this.emit('alert:resolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(severity) {
    let alerts = this.alertHistory.filter(a => !a.resolved);
    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }
    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 100) {
    return this.alertHistory.slice(-limit).reverse();
  }
}

// Singleton
let service = null;
export function getAnomalyDetectionService(options) {
  if (!service) {
    service = new AnomalyDetectionService(options);
  }
  return service;
}

export default AnomalyDetectionService;
