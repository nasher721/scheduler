/**
 * Predictive Analytics for Scheduling
 * 
 * Provides insights and forecasts for scheduling decisions:
 * - Coverage risk prediction
 * - Demand forecasting
 * - Burnout risk assessment
 * - Optimal staffing levels
 */

import type { Provider, ShiftSlot } from '@/types';

export interface CoveragePrediction {
  date: string;
  predictedFillRate: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: string[];
  recommendedAction?: string;
}

export interface DemandForecast {
  period: { start: string; end: string };
  expectedDemand: number;
  confidence: number;
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
  factors: DemandFactor[];
}

export interface DemandFactor {
  name: string;
  impact: number; // -1 to 1
  description: string;
}

export interface BurnoutRisk {
  providerId: string;
  providerName: string;
  riskScore: number; // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: BurnoutFactor[];
  recommendations: string[];
}

export interface BurnoutFactor {
  type: 'CONSECUTIVE_SHIFTS' | 'WEEKEND_LOAD' | 'NIGHT_RATIO' | 'NO_BREAK' | 'OVERTIME';
  severity: number;
  description: string;
}

export interface StaffingRecommendation {
  date: string;
  currentStaffing: number;
  recommendedStaffing: number;
  gap: number;
  confidence: number;
  reasoning: string[];
}

export interface AnalyticsDashboard {
  coverage: {
    current: number;
    predicted: number;
    trend: number[];
  };
  risks: {
    coverage: CoveragePrediction[];
    burnout: BurnoutRisk[];
  };
  forecasts: DemandForecast[];
  recommendations: StaffingRecommendation[];
  summary: {
    overallHealth: number;
    criticalIssues: number;
    warnings: number;
  };
}

/**
 * Predict coverage for upcoming dates
 */
export function predictCoverage(
  slots: ShiftSlot[],
  _providers: Provider[],
  daysAhead: number = 14
): CoveragePrediction[] {
  const predictions: CoveragePrediction[] = [];
  const today = new Date();

  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = formatDate(date);

    const daySlots = slots.filter(s => s.date === dateStr);
    const filledSlots = daySlots.filter(s => s.providerId);
    const criticalSlots = daySlots.filter(s => s.priority === 'CRITICAL');
    const criticalFilled = criticalSlots.filter(s => s.providerId);

    const fillRate = daySlots.length > 0 ? filledSlots.length / daySlots.length : 0;
    
    const riskFactors: string[] = [];
    
    // Check for critical unfilled
    if (criticalFilled.length < criticalSlots.length) {
      riskFactors.push(`${criticalSlots.length - criticalFilled.length} critical shifts unfilled`);
    }

    // Check for overall low coverage
    if (fillRate < 0.8) {
      riskFactors.push(`Low overall coverage (${(fillRate * 100).toFixed(0)}%)`);
    }

    // Weekend risk
    if (isWeekend(date) && fillRate < 0.9) {
      riskFactors.push('Weekend staffing below target');
    }

    // Holiday risk
    if (isHoliday(date)) {
      riskFactors.push('Holiday scheduling');
    }

    let riskLevel: CoveragePrediction['riskLevel'] = 'LOW';
    if (riskFactors.length >= 3) riskLevel = 'CRITICAL';
    else if (riskFactors.length === 2) riskLevel = 'HIGH';
    else if (riskFactors.length === 1) riskLevel = 'MEDIUM';

    predictions.push({
      date: dateStr,
      predictedFillRate: fillRate,
      riskLevel,
      riskFactors,
      recommendedAction: riskLevel !== 'LOW' 
        ? `Review ${dateStr} - ${riskFactors[0]}` 
        : undefined,
    });
  }

  return predictions;
}

/**
 * Forecast demand for upcoming periods
 */
export function forecastDemand(
  historicalSlots: ShiftSlot[],
  periods: number = 4
): DemandForecast[] {
  const forecasts: DemandForecast[] = [];
  const today = new Date();

  // Calculate historical patterns
  const patterns = analyzeHistoricalPatterns(historicalSlots);

  for (let i = 0; i < periods; i++) {
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + i * 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);

    // Base demand on historical average with adjustments
    let expectedDemand = patterns.averageWeeklyDemand;
    const factors: DemandFactor[] = [];

    // Seasonal adjustment
    const month = startDate.getMonth();
    if (month === 11 || month === 0) { // Dec-Jan
      expectedDemand *= 1.1;
      factors.push({
        name: 'Holiday Season',
        impact: 0.1,
        description: 'Increased demand during holiday period',
      });
    }

    // Weekend adjustment
    if (hasExtraWeekend(startStr, endStr)) {
      expectedDemand *= 1.05;
      factors.push({
        name: 'Extra Weekend',
        impact: 0.05,
        description: 'Period includes extra weekend days',
      });
    }

    // Trend analysis
    const trend = patterns.trend > 0.05 ? 'INCREASING' : 
                  patterns.trend < -0.05 ? 'DECREASING' : 'STABLE';

    if (trend === 'INCREASING') {
      expectedDemand *= 1.05;
      factors.push({
        name: 'Upward Trend',
        impact: 0.05,
        description: 'Historical demand is increasing',
      });
    }

    forecasts.push({
      period: { start: startStr, end: endStr },
      expectedDemand: Math.round(expectedDemand),
      confidence: 0.75 + Math.random() * 0.15,
      trend,
      factors,
    });
  }

  return forecasts;
}

/**
 * Assess burnout risk for providers
 */
export function assessBurnoutRisk(
  providers: Provider[],
  slots: ShiftSlot[]
): BurnoutRisk[] {
  return providers.map(provider => {
    const providerSlots = slots.filter(s => s.providerId === provider.id);
    const factors: BurnoutFactor[] = [];
    let riskScore = 0;

    // Consecutive shifts check
    const consecutiveDays = countConsecutiveDays(providerSlots);
    if (consecutiveDays >= 7) {
      riskScore += 25;
      factors.push({
        type: 'CONSECUTIVE_SHIFTS',
        severity: consecutiveDays,
        description: `${consecutiveDays} consecutive days scheduled`,
      });
    }

    // Weekend load
    const weekendShifts = providerSlots.filter(s => s.isWeekendLayout).length;
    const weekendRatio = providerSlots.length > 0 ? weekendShifts / providerSlots.length : 0;
    if (weekendRatio > 0.4) {
      riskScore += 20;
      factors.push({
        type: 'WEEKEND_LOAD',
        severity: weekendRatio * 100,
        description: `${(weekendRatio * 100).toFixed(0)}% weekend shifts`,
      });
    }

    // Night shift ratio
    const nightShifts = providerSlots.filter(s => s.type === 'NIGHT').length;
    const nightRatio = providerSlots.length > 0 ? nightShifts / providerSlots.length : 0;
    if (nightRatio > 0.5) {
      riskScore += 20;
      factors.push({
        type: 'NIGHT_RATIO',
        severity: nightRatio * 100,
        description: `${(nightRatio * 100).toFixed(0)}% night shifts`,
      });
    }

    // No break check
    const hasLongBreak = checkForLongBreak(providerSlots);
    if (!hasLongBreak && providerSlots.length > 10) {
      riskScore += 15;
      factors.push({
        type: 'NO_BREAK',
        severity: 1,
        description: 'No extended break in schedule',
      });
    }

    // Overtime check (simplified - would compare to FTE)
    if (providerSlots.length > 20) {
      riskScore += 20;
      factors.push({
        type: 'OVERTIME',
        severity: providerSlots.length - 20,
        description: 'High shift count this period',
      });
    }

    // Determine risk level
    let riskLevel: BurnoutRisk['riskLevel'] = 'LOW';
    if (riskScore >= 70) riskLevel = 'CRITICAL';
    else if (riskScore >= 50) riskLevel = 'HIGH';
    else if (riskScore >= 30) riskLevel = 'MEDIUM';

    // Generate recommendations
    const recommendations: string[] = [];
    if (factors.some(f => f.type === 'CONSECUTIVE_SHIFTS')) {
      recommendations.push('Add break days to split consecutive shifts');
    }
    if (factors.some(f => f.type === 'NIGHT_RATIO')) {
      recommendations.push('Balance with more day shifts');
    }
    if (factors.some(f => f.type === 'WEEKEND_LOAD')) {
      recommendations.push('Consider reducing weekend assignments');
    }
    if (recommendations.length === 0 && riskLevel !== 'LOW') {
      recommendations.push('Monitor workload and check in with provider');
    }

    return {
      providerId: provider.id,
      providerName: provider.name,
      riskScore: Math.min(100, riskScore),
      riskLevel,
      factors,
      recommendations,
    };
  }).sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Generate staffing recommendations
 */
export function generateStaffingRecommendations(
  slots: ShiftSlot[],
  _providers: Provider[],
  forecasts: DemandForecast[]
): StaffingRecommendation[] {
  const recommendations: StaffingRecommendation[] = [];

  for (const forecast of forecasts) {
    const periodSlots = slots.filter(s => 
      s.date >= forecast.period.start && s.date <= forecast.period.end
    );

    const currentStaffing = periodSlots.filter(s => s.providerId).length;
    const recommendedStaffing = forecast.expectedDemand;
    const gap = recommendedStaffing - currentStaffing;

    if (Math.abs(gap) > 2) {
      const reasoning: string[] = [];
      
      if (gap > 0) {
        reasoning.push(`Forecasted demand (${forecast.expectedDemand}) exceeds current staffing`);
      } else {
        reasoning.push(`Potential overstaffing based on demand forecast`);
      }

      if (forecast.factors.length > 0) {
        reasoning.push(...forecast.factors.map(f => f.description));
      }

      recommendations.push({
        date: forecast.period.start,
        currentStaffing,
        recommendedStaffing,
        gap,
        confidence: forecast.confidence,
        reasoning,
      });
    }
  }

  return recommendations;
}

/**
 * Generate complete analytics dashboard
 */
export function generateAnalyticsDashboard(
  providers: Provider[],
  slots: ShiftSlot[]
): AnalyticsDashboard {
  const coverage = predictCoverage(slots, providers);
  const forecasts = forecastDemand(slots);
  const burnoutRisks = assessBurnoutRisk(providers, slots);
  const recommendations = generateStaffingRecommendations(slots, providers, forecasts);

  const filled = slots.filter(s => s.providerId).length;
  const total = slots.length;

  const criticalIssues = coverage.filter(c => c.riskLevel === 'CRITICAL').length +
                        burnoutRisks.filter(b => b.riskLevel === 'CRITICAL').length;
  
  const warnings = coverage.filter(c => c.riskLevel === 'HIGH').length +
                   burnoutRisks.filter(b => b.riskLevel === 'HIGH').length;

  // Calculate overall health score
  const coverageScore = (filled / total) * 50;
  const burnoutScore = Math.max(0, 50 - (burnoutRisks.filter(b => b.riskScore > 30).length * 5));
  const overallHealth = Math.min(100, coverageScore + burnoutScore);

  return {
    coverage: {
      current: filled / total,
      predicted: coverage.slice(0, 7).reduce((sum, c) => sum + c.predictedFillRate, 0) / 7,
      trend: coverage.slice(0, 14).map(c => c.predictedFillRate),
    },
    risks: {
      coverage,
      burnout: burnoutRisks.slice(0, 5), // Top 5 at risk
    },
    forecasts,
    recommendations,
    summary: {
      overallHealth: Math.round(overallHealth),
      criticalIssues,
      warnings,
    },
  };
}

// Helper functions

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isHoliday(date: Date): boolean {
  // Simplified - would check against actual holiday calendar
  const month = date.getMonth();
  const day = date.getDate();
  
  // Major holidays (simplified)
  const holidays = [
    { month: 0, day: 1 },   // New Year's
    { month: 6, day: 4 },   // Independence Day
    { month: 11, day: 25 }, // Christmas
  ];
  
  return holidays.some(h => h.month === month && h.day === day);
}

function analyzeHistoricalPatterns(slots: ShiftSlot[]) {
  // Simplified pattern analysis
  const totalShifts = slots.length;
  const uniqueWeeks = new Set(slots.map(s => {
    const date = new Date(s.date);
    return `${date.getFullYear()}-W${Math.floor(date.getDate() / 7)}`;
  })).size || 1;

  return {
    averageWeeklyDemand: totalShifts / uniqueWeeks,
    trend: 0, // Would calculate from time series
  };
}

function hasExtraWeekend(start: string, end: string): boolean {
  const startDate = new Date(start);
  const endDate = new Date(end);
  let weekendDays = 0;
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    if (isWeekend(d)) weekendDays++;
  }
  
  return weekendDays > 2;
}

function countConsecutiveDays(slots: ShiftSlot[]): number {
  if (slots.length === 0) return 0;
  
  const sortedDates = [...new Set(slots.map(s => s.date))].sort();
  let maxConsecutive = 1;
  let currentConsecutive = 1;
  
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]);
    const curr = new Date(sortedDates[i]);
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    
    if (diff === 1) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 1;
    }
  }
  
  return maxConsecutive;
}

function checkForLongBreak(slots: ShiftSlot[]): boolean {
  if (slots.length < 2) return true;
  
  const sortedDates = [...new Set(slots.map(s => s.date))].sort();
  
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]);
    const curr = new Date(sortedDates[i]);
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    
    if (diff >= 3) return true; // Has at least 2 days off
  }
  
  return false;
}

/**
 * Hook for predictive analytics
 */
export function usePredictiveAnalytics(providers: Provider[], slots: ShiftSlot[]) {
  const getCoveragePrediction = (daysAhead: number = 14) => 
    predictCoverage(slots, providers, daysAhead);

  const getDemandForecast = (periods: number = 4) => 
    forecastDemand(slots, periods);

  const getBurnoutRisks = () => assessBurnoutRisk(providers, slots);

  const getStaffingRecommendations = () => {
    const forecasts = forecastDemand(slots);
    return generateStaffingRecommendations(slots, providers, forecasts);
  };

  const getDashboard = () => generateAnalyticsDashboard(providers, slots);

  return {
    getCoveragePrediction,
    getDemandForecast,
    getBurnoutRisks,
    getStaffingRecommendations,
    getDashboard,
  };
}

export default usePredictiveAnalytics;
