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
    const context = {
      scheduleState,
      providers: scheduleState.providers,
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
      // Phase 1: Parallel constraint checking
      this.log('Phase 1: Parallel constraint analysis');
      const parallelResults = await this.runParallelAnalysis(context);
      
      // Store individual agent results
      for (const [agentName, result] of Object.entries(parallelResults)) {
        this.memory.set(`scheduling:agent:${agentName}:result`, result);
      }

      // Phase 2: Director synthesis
      this.log('Phase 2: Director synthesis');
      const directorResult = await this.agents.director.execute(
        `Synthesize these analyses into a final schedule:\n${JSON.stringify(parallelResults, null, 2)}`,
        { ...context, parallelResults }
      );

      // Phase 3: Iterative refinement (if needed)
      let finalResult = directorResult;
      let iteration = 0;
      
      while (iteration < this.maxIterations && !this.isScheduleOptimal(finalResult)) {
        iteration++;
        this.log(`Phase 3: Iteration ${iteration}`);
        
        this.memory.set('scheduling:optimization:status', {
          status: 'refining',
          startedAt: startTime,
          iteration,
        });

        // Re-run compliance check on proposed changes
        const complianceRecheck = await this.agents.compliance.execute(
          `Verify this schedule is compliant:\n${directorResult.parsedContent?.finalSchedule || directorResult.content}`,
          context
        );

        if (complianceRecheck.parsedContent?.compliant === false) {
          // Compliance violations found, need director to fix
          finalResult = await this.agents.director.execute(
            `Fix these compliance violations:\n${JSON.stringify(complianceRecheck.parsedContent.violations)}`,
            { ...context, violations: complianceRecheck.parsedContent.violations }
          );
        } else {
          break; // Schedule is optimal
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Store final result
      const optimizationResult = {
        success: true,
        schedule: finalResult.parsedContent?.finalSchedule || scheduleState,
        decisions: finalResult.parsedContent?.decisions || [],
        metrics: finalResult.parsedContent?.metrics || {},
        agentResults: parallelResults,
        iterations: iteration,
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
