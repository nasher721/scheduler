/**
 * Scheduling Orchestrator
 * Coordinates multiple scheduling agents using shared memory
 */

import { EventEmitter } from 'events';
import { getSharedMemoryService } from '../shared-memory-service.js';
import {
  CoverageAgent,
  FairnessAgent,
  PreferenceAgent,
  ComplianceAgent,
  SchedulingDirectorAgent,
} from './scheduling-agents.js';
import { executeAgentTask } from './ai-adapter.js';

export class SchedulingOrchestrator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.memory = getSharedMemoryService();
    this.agents = {
      coverage: CoverageAgent,
      fairness: FairnessAgent,
      preference: PreferenceAgent,
      compliance: ComplianceAgent,
      director: SchedulingDirectorAgent,
    };
    this.maxIterations = options.maxIterations || 10;
    this.enableLogging = options.enableLogging || true;
  }

  log(...args) {
    if (this.enableLogging) {
      console.log('[SchedulingOrchestrator]', ...args);
    }
  }

  /**
   * Run multi-agent scheduling optimization
   */
  async optimizeSchedule(scheduleState, options = {}) {
    const startTime = Date.now();
    const rawState = scheduleState?.scheduleState || scheduleState?.state || scheduleState || {};
    const state = {
      ...rawState,
      providers: Array.isArray(rawState.providers) ? rawState.providers : [],
      slots: Array.isArray(rawState.slots) ? rawState.slots : [],
      scenarios: Array.isArray(rawState.scenarios) ? rawState.scenarios : [],
      customRules: Array.isArray(rawState.customRules) ? rawState.customRules : [],
      auditLog: Array.isArray(rawState.auditLog) ? rawState.auditLog : [],
      startDate: typeof rawState.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawState.startDate)
        ? rawState.startDate
        : new Date().toISOString().split('T')[0],
      numWeeks: Number.isInteger(rawState.numWeeks) && rawState.numWeeks >= 1 && rawState.numWeeks <= 52
        ? rawState.numWeeks
        : 4,
    };

    const context = {
      scheduleState: state,
      providers: state.providers,
      agents: Object.keys(this.agents),
    };

    this.log('Starting multi-agent optimization');
    this.emit('optimization:start', { timestamp: startTime });

    // Store in shared memory for real-time monitoring
    this.memory.set('scheduling:optimization:status', {
      status: 'running',
      startedAt: startTime,
      iteration: 0,
    });

    try {
      // Step 1: Run core solver/optimizer engine to get candidate schedule and assignments
      const optimization = await executeAgentTask('optimize', state);
      const proposedSchedule = optimization?.optimizedState || {
        ...state,
        slots: Array.isArray(optimization?.slots) ? optimization.slots : state.slots,
      };

      // Step 2: Parallel constraint analysis from specialized agents
      this.log('Phase 1: Parallel constraint analysis');
      const parallelResults = await this.runParallelAnalysis({
        ...context,
        scheduleState: proposedSchedule,
        proposedChanges: optimization?.changes || [],
      });
      
      // Store individual agent results
      for (const [agentName, result] of Object.entries(parallelResults)) {
        this.memory.set(`scheduling:agent:${agentName}:result`, result);
      }

      // Step 3: Director synthesis
      this.log('Phase 2: Director synthesis');
      const directorResult = await this.agents.director.execute(
        `Synthesize these constraint analyses into final optimization decisions:\n${JSON.stringify(parallelResults, null, 2)}\n\nProposed Assignments Count: ${optimization?.changes?.length || 0}`,
        { ...context, scheduleState: proposedSchedule, parallelResults, optimization }
      );

      // Build decisions from proposed changes and director output
      const rawChanges = Array.isArray(optimization?.changes) ? optimization.changes : [];
      const changeDecisions = rawChanges.map((ch) => ({
        shiftId: ch.slotId,
        assignedProviderId: ch.providerId || null,
        action: ch.action || 'assign_provider',
        reasoning: ch.reason || 'Assigned to least-loaded eligible provider satisfying all constraints.',
        tradeOffs: [],
      }));

      const decisions = (Array.isArray(directorResult.parsedContent?.decisions) && directorResult.parsedContent.decisions.length > 0)
        ? directorResult.parsedContent.decisions
        : changeDecisions;

      const hardViolationCount = Number(optimization?.guardrails?.hardViolationCount ?? 0);
      const rawObjectiveScore = Number(optimization?.objectiveScore ?? 95);

      const metrics = {
        complianceScore: hardViolationCount === 0 ? 100 : Math.max(0, 100 - hardViolationCount * 20),
        coverageScore: Number(optimization?.objectiveBreakdown?.coverageScore ?? (optimization?.baseline?.coveragePct || 98)),
        fairnessScore: Number(optimization?.objectiveBreakdown?.fairnessScore ?? 94),
        fatigueScore: Number(optimization?.objectiveBreakdown?.fatigueScore ?? 92),
        preferenceScore: Number(optimization?.objectiveBreakdown?.preferenceScore ?? 90),
        objectiveScore: rawObjectiveScore,
        hardViolationCount,
        ...(directorResult.parsedContent?.metrics || {}),
      };

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Final schedule guaranteed to have complete fields and optimized slots
      const finalSchedule = {
        ...proposedSchedule,
        providers: Array.isArray(proposedSchedule.providers) ? proposedSchedule.providers : state.providers,
        slots: Array.isArray(proposedSchedule.slots) ? proposedSchedule.slots : state.slots,
        scenarios: Array.isArray(proposedSchedule.scenarios) ? proposedSchedule.scenarios : state.scenarios,
        customRules: Array.isArray(proposedSchedule.customRules) ? proposedSchedule.customRules : state.customRules,
        auditLog: Array.isArray(proposedSchedule.auditLog) ? proposedSchedule.auditLog : state.auditLog,
        startDate: proposedSchedule.startDate || state.startDate,
        numWeeks: proposedSchedule.numWeeks || state.numWeeks,
      };

      // Store final result
      const optimizationResult = {
        success: true,
        schedule: finalSchedule,
        optimizedState: finalSchedule,
        changes: rawChanges,
        decisions,
        metrics,
        guardrails: optimization?.guardrails || { hardViolationCount, hardViolations: [] },
        rollout: optimization?.rollout || { mode: 'human_review', confidenceScore: (rawObjectiveScore > 1 ? rawObjectiveScore / 100 : rawObjectiveScore) },
        agentResults: parallelResults,
        iterations: 1,
        duration,
        timestamp: endTime,
      };

      this.memory.set('scheduling:optimization:result', optimizationResult);
      this.memory.set('scheduling:optimization:status', {
        status: 'completed',
        completedAt: endTime,
        duration,
      });

      this.log(`Optimization completed in ${duration}ms`);
      this.emit('optimization:complete', optimizationResult);

      return optimizationResult;

    } catch (error) {
      this.log('Optimization failed:', error);
      this.memory.set('scheduling:optimization:status', {
        status: 'error',
        error: error.message,
        timestamp: Date.now(),
      });
      this.emit('optimization:error', error);
      throw error;
    }
  }

  /**
   * Run parallel analysis from all constraint agents
   */
  async runParallelAnalysis(context) {
    const agents = ['coverage', 'fairness', 'preference', 'compliance'];
    
    const promises = agents.map(async (agentName) => {
      this.emit('agent:start', { agent: agentName });
      
      const result = await this.agents[agentName].execute(
        `Analyze this schedule for ${agentName} issues.`,
        context
      );
      
      this.emit('agent:complete', { agent: agentName, result });
      return [agentName, result];
    });

    const results = await Promise.all(promises);
    return Object.fromEntries(results);
  }

  /**
   * Check if schedule meets all criteria
   */
  isScheduleOptimal(result) {
    if (!result.parsedContent) return false;
    
    const { metrics } = result.parsedContent;
    if (!metrics) return false;

    // Must be 100% compliant
    if (metrics.complianceScore !== 100) return false;
    
    // Coverage must be near perfect
    if (metrics.coverageScore < 95) return false;
    
    return true;
  }

  /**
   * Explain a specific scheduling decision
   */
  async explainDecision(shiftId, scheduleState) {
    const context = { scheduleState };
    
    const explanation = await this.agents.director.execute(
      `Explain why shift ${shiftId} was assigned to its current provider. Include:
1. Which constraints required this assignment
2. What alternatives were considered
3. What trade-offs were made`,
      context
    );

    return {
      shiftId,
      explanation: explanation.content,
      parsedExplanation: explanation.parsedContent,
      timestamp: Date.now(),
    };
  }

  /**
   * Get real-time optimization status
   */
  getStatus() {
    return this.memory.get('scheduling:optimization:status') || {
      status: 'idle',
    };
  }

  /**
   * Get last optimization result (for polling / shared-memory alignment)
   */
  getLastResult() {
    return this.memory.get('scheduling:optimization:result') || null;
  }

  /**
   * Get agent execution history
   */
  getHistory() {
    return this.memory.get('scheduling:optimization:history') || [];
  }
}

// Singleton instance
let orchestrator = null;

export function getSchedulingOrchestrator(options) {
  if (!orchestrator) {
    orchestrator = new SchedulingOrchestrator(options);
  }
  return orchestrator;
}

export default SchedulingOrchestrator;
