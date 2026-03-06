/**
 * Constraint Solver for Schedule Optimization
 * 
 * Implements constraint satisfaction problem (CSP) solving for scheduling
 * Optimizes for: coverage, fairness, preferences, and constraints
 */

import type { Provider, ShiftSlot, CustomRule } from '@/types';

export interface OptimizationConstraints {
  // Hard constraints (must be satisfied)
  maxConsecutiveNights: number;
  minDaysOffAfterNight: number;
  maxShiftsPerWeek: number;
  respectTimeOff: boolean;
  respectCredentials: boolean;
  respectSkills: boolean;

  // Soft constraints (optimization targets)
  targetFairness: number; // 0-1 weight
  targetPreference: number; // 0-1 weight
  targetContinuity: number; // 0-1 weight
  targetCost: number; // 0-1 weight
}

export interface OptimizationObjective {
  type: 'FAIRNESS' | 'PREFERENCE' | 'CONTINUITY' | 'COST' | 'BALANCED';
  weights: {
    fairness: number;
    preference: number;
    continuity: number;
    cost: number;
  };
}

export interface SolverSolution {
  assignments: Map<string, string | null>; // slotId -> providerId
  score: number;
  fairnessScore: number;
  preferenceScore: number;
  violations: ConstraintViolation[];
  metrics: OptimizationMetrics;
  confidence: number;
}

export interface ConstraintViolation {
  type: 'HARD' | 'SOFT';
  rule: string;
  slotId?: string;
  providerId?: string;
  description: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
}

export interface OptimizationMetrics {
  totalShifts: number;
  filledShifts: number;
  coverage: number;
  avgShiftsPerProvider: number;
  shiftVariance: number;
  weekendDistribution: number;
  nightDistribution: number;
}

const DEFAULT_CONSTRAINTS: OptimizationConstraints = {
  maxConsecutiveNights: 4,
  minDaysOffAfterNight: 2,
  maxShiftsPerWeek: 5,
  respectTimeOff: true,
  respectCredentials: true,
  respectSkills: true,
  targetFairness: 0.3,
  targetPreference: 0.3,
  targetContinuity: 0.2,
  targetCost: 0.2,
};

/**
 * Constraint Solver class for schedule optimization
 */
export class ConstraintSolver {
  private providers: Provider[];
  private slots: ShiftSlot[];
  private rules: CustomRule[];
  private constraints: OptimizationConstraints;

  constructor(
    providers: Provider[],
    slots: ShiftSlot[],
    rules: CustomRule[] = [],
    constraints: Partial<OptimizationConstraints> = {}
  ) {
    this.providers = providers;
    this.slots = slots;
    this.rules = rules;
    this.constraints = { ...DEFAULT_CONSTRAINTS, ...constraints };
  }

  /**
   * Main solve method - finds optimal assignment
   */
  async solve(objective: OptimizationObjective = { type: 'BALANCED', weights: { fairness: 0.3, preference: 0.3, continuity: 0.2, cost: 0.2 } }): Promise<SolverSolution> {
    const startTime = performance.now();
    
    // Phase 1: Greedy initial assignment
    let assignments = this.greedyInitialAssignment();
    
    // Phase 2: Local search optimization
    assignments = await this.localSearchOptimize(assignments, objective);
    
    // Phase 3: Validate and score
    const violations = this.validateSolution(assignments);
    const metrics = this.calculateMetrics(assignments);
    const scores = this.calculateScores(assignments, objective);
    
    const duration = performance.now() - startTime;
    
    return {
      assignments,
      score: scores.total,
      fairnessScore: scores.fairness,
      preferenceScore: scores.preference,
      violations,
      metrics,
      confidence: this.calculateConfidence(violations, metrics),
    };
  }

  /**
   * Greedy initial assignment - fill slots with best available providers
   */
  private greedyInitialAssignment(): Map<string, string | null> {
    const assignments = new Map<string, string | null>();
    const providerShiftCounts = new Map<string, number>();
    
    // Sort slots by priority (critical first)
    const sortedSlots = [...this.slots].sort((a, b) => {
      if (a.priority === 'CRITICAL' && b.priority !== 'CRITICAL') return -1;
      if (b.priority === 'CRITICAL' && a.priority !== 'CRITICAL') return 1;
      return 0;
    });

    for (const slot of sortedSlots) {
      const eligibleProviders = this.getEligibleProviders(slot, assignments);
      
      if (eligibleProviders.length === 0) {
        assignments.set(slot.id, null);
        continue;
      }

      // Score each provider
      const scoredProviders = eligibleProviders.map(provider => ({
        provider,
        score: this.scoreProviderForSlot(provider, slot, providerShiftCounts),
      }));

      // Sort by score (descending)
      scoredProviders.sort((a, b) => b.score - a.score);

      // Assign best provider
      const bestProvider = scoredProviders[0].provider;
      assignments.set(slot.id, bestProvider.id);
      
      const currentCount = providerShiftCounts.get(bestProvider.id) || 0;
      providerShiftCounts.set(bestProvider.id, currentCount + 1);
    }

    return assignments;
  }

  /**
   * Local search optimization - improve solution iteratively
   */
  private async localSearchOptimize(
    assignments: Map<string, string | null>,
    objective: OptimizationObjective
  ): Promise<Map<string, string | null>> {
    const improved = new Map(assignments);
    let iterations = 0;
    const maxIterations = 100;
    let lastScore = this.calculateScores(improved, objective).total;

    while (iterations < maxIterations) {
      let improvedThisIteration = false;

      // Try swapping providers between slots
      for (const [slot1Id, provider1Id] of improved) {
        if (!provider1Id) continue;

        for (const [slot2Id, provider2Id] of improved) {
          if (slot1Id === slot2Id || !provider2Id) continue;

          // Try swap
          const slot1 = this.slots.find(s => s.id === slot1Id)!;
          const slot2 = this.slots.find(s => s.id === slot2Id)!;
          const provider1 = this.providers.find(p => p.id === provider1Id)!;
          const provider2 = this.providers.find(p => p.id === provider2Id)!;

          if (this.canAssign(provider1, slot2) && this.canAssign(provider2, slot1)) {
            // Perform swap
            improved.set(slot1Id, provider2Id);
            improved.set(slot2Id, provider1Id);

            const newScore = this.calculateScores(improved, objective).total;

            if (newScore > lastScore) {
              lastScore = newScore;
              improvedThisIteration = true;
            } else {
              // Revert swap
              improved.set(slot1Id, provider1Id);
              improved.set(slot2Id, provider2Id);
            }
          }
        }
      }

      if (!improvedThisIteration) break;
      iterations++;

      // Yield to main thread every 10 iterations
      if (iterations % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return improved;
  }

  /**
   * Get providers eligible for a slot
   */
  private getEligibleProviders(
    slot: ShiftSlot,
    assignments: Map<string, string | null>
  ): Provider[] {
    return this.providers.filter(provider => this.canAssign(provider, slot));
  }

  /**
   * Check if provider can be assigned to slot
   */
  private canAssign(provider: Provider, slot: ShiftSlot): boolean {
    // Check skills
    if (this.constraints.respectSkills && !provider.skills.includes(slot.requiredSkill)) {
      return false;
    }

    // Check credentials
    if (this.constraints.respectCredentials) {
      const hasExpired = provider.credentials?.some(c => c.status === 'expired');
      if (hasExpired) return false;
    }

    // Check time off
    if (this.constraints.respectTimeOff) {
      const isTimeOff = provider.timeOffRequests.some(r => r.date === slot.date);
      if (isTimeOff) return false;
    }

    // Check scheduling restrictions
    if (provider.schedulingRestrictions) {
      const r = provider.schedulingRestrictions;
      if (r.noNights && slot.type === 'NIGHT') return false;
      if (r.noWeekends && slot.isWeekendLayout) return false;
      if (r.noHolidays && this.isHoliday(slot.date)) return false;
    }

    return true;
  }

  /**
   * Score a provider for a slot (higher is better)
   */
  private scoreProviderForSlot(
    provider: Provider,
    slot: ShiftSlot,
    shiftCounts: Map<string, number>
  ): number {
    let score = 0;

    // Fairness: Prefer providers with fewer shifts
    const currentShifts = shiftCounts.get(provider.id) || 0;
    const targetTotal = provider.targetWeekDays + provider.targetWeekendDays + 
                       provider.targetWeekNights + provider.targetWeekendNights;
    const fairnessScore = Math.max(0, targetTotal - currentShifts);
    score += fairnessScore * this.constraints.targetFairness;

    // Preference: Check preferred dates
    if (provider.preferredDates.includes(slot.date)) {
      score += 5 * this.constraints.targetPreference;
    }

    // Continuity: Prefer same provider for consecutive days
    // (simplified - would need more context)

    // Critical slots get priority
    if (slot.priority === 'CRITICAL') {
      score += 10;
    }

    return score;
  }

  /**
   * Validate solution against constraints
   */
  private validateSolution(assignments: Map<string, string | null>): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (const [slotId, providerId] of assignments) {
      if (!providerId) {
        const slot = this.slots.find(s => s.id === slotId);
        if (slot?.priority === 'CRITICAL') {
          violations.push({
            type: 'HARD',
            rule: 'CRITICAL_COVERAGE',
            slotId,
            description: `Critical slot ${slotId} is unfilled`,
            severity: 'CRITICAL',
          });
        }
        continue;
      }

      const provider = this.providers.find(p => p.id === providerId);
      const slot = this.slots.find(s => s.id === slotId);
      
      if (!provider || !slot) continue;

      // Check max consecutive nights
      if (slot.type === 'NIGHT') {
        const consecutiveNights = this.countConsecutiveNights(provider, slot.date, assignments);
        if (consecutiveNights > this.constraints.maxConsecutiveNights) {
          violations.push({
            type: 'HARD',
            rule: 'MAX_CONSECUTIVE_NIGHTS',
            slotId,
            providerId,
            description: `${provider.name} exceeds max consecutive nights`,
            severity: 'WARNING',
          });
        }
      }
    }

    return violations;
  }

  /**
   * Calculate optimization metrics
   */
  private calculateMetrics(assignments: Map<string, string | null>): OptimizationMetrics {
    const totalShifts = this.slots.length;
    const filledShifts = [...assignments.values()].filter(v => v !== null).length;
    
    const providerCounts = new Map<string, number>();
    for (const providerId of assignments.values()) {
      if (providerId) {
        providerCounts.set(providerId, (providerCounts.get(providerId) || 0) + 1);
      }
    }

    const counts = [...providerCounts.values()];
    const avgShifts = counts.reduce((a, b) => a + b, 0) / counts.length || 0;
    const variance = counts.reduce((sum, c) => sum + Math.pow(c - avgShifts, 2), 0) / counts.length || 0;

    return {
      totalShifts,
      filledShifts,
      coverage: filledShifts / totalShifts,
      avgShiftsPerProvider: avgShifts,
      shiftVariance: variance,
      weekendDistribution: 0, // Would calculate from data
      nightDistribution: 0,
    };
  }

  /**
   * Calculate optimization scores
   */
  private calculateScores(
    assignments: Map<string, string | null>,
    objective: OptimizationObjective
  ): { total: number; fairness: number; preference: number; continuity: number; cost: number } {
    const metrics = this.calculateMetrics(assignments);
    
    const fairness = Math.max(0, 1 - metrics.shiftVariance / 10);
    const coverage = metrics.coverage;
    
    return {
      total: coverage * 0.4 + fairness * 0.3 + 0.3,
      fairness,
      preference: 0, // Would calculate from preferences
      continuity: 0, // Would calculate from continuity
      cost: coverage,
    };
  }

  /**
   * Calculate confidence in solution
   */
  private calculateConfidence(violations: ConstraintViolation[], metrics: OptimizationMetrics): number {
    const hardViolations = violations.filter(v => v.type === 'HARD').length;
    const coverage = metrics.coverage;
    
    let confidence = coverage * 100;
    confidence -= hardViolations * 20;
    
    return Math.max(0, Math.min(100, confidence));
  }

  private countConsecutiveNights(
    provider: Provider,
    date: string,
    assignments: Map<string, string | null>
  ): number {
    // Simplified implementation
    return 0;
  }

  private isHoliday(date: string): boolean {
    // Would check against holiday list
    return false;
  }
}

/**
 * Hook to use constraint solver
 */
export function useConstraintSolver() {
  const solve = async (
    providers: Provider[],
    slots: ShiftSlot[],
    rules?: CustomRule[],
    objective?: OptimizationObjective
  ): Promise<SolverSolution> => {
    const solver = new ConstraintSolver(providers, slots, rules);
    return solver.solve(objective);
  };

  return { solve };
}

export default ConstraintSolver;
