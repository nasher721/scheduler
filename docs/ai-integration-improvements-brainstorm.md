# AI Integration Improvements Brainstorm

> Generated using AI Agent Orchestrator skill patterns applied to the Neuro ICU Scheduler.

## Current State Analysis

### Existing AI Architecture
The current `ai-orchestrator.js` provides:
- **Provider abstraction**: OpenAI, Anthropic, Google Gemini support
- **Deterministic fallback**: Greedy solver when AI is unavailable
- **Rollout modes**: Shadow → Human Review → Auto-Apply progression
- **Policy profiles**: Balanced, Safety-first, Fairness-first weights
- **Metrics tracking**: Latency, cost, acceptance, rollback rates
- **Audit trail**: Apply history with rollback capability

### Current Limitations
1. **Monolithic design**: Single orchestrator handles all AI tasks
2. **No agent specialization**: Same prompt structure for all tasks
3. **Sequential processing**: Tasks execute one at a time
4. **Limited context sharing**: No shared memory between operations
5. **No workflow orchestration**: Complex multi-step tasks are hardcoded
6. **Static fallback**: Deterministic solver doesn't learn from AI outputs

---

## Proposed Multi-Agent Architecture

Based on AI Agent Orchestrator patterns, here's a redesigned system:

### 1. Specialized AI Agents

```typescript
// agents/scheduler-agents.ts

export const CoverageAgent = new Agent({
  name: 'coverage-optimizer',
  role: 'Coverage Optimization Specialist',
  systemPrompt: `You are a coverage optimization specialist for ICU scheduling.
Your job is to:
- Analyze critical staffing gaps and prioritize filling them
- Balance provider availability with shift requirements
- Consider skill matching (G20, H22, Akron, etc.)
- Respect time-off requests and credential expirations

When analyzing, provide:
1. Gap analysis with severity ratings
2. Prioritized list of slots to fill
3. Recommended provider assignments with rationale
4. Risk assessment for unfilled slots

Output format: JSON with structured recommendations.`,
  model: 'gpt-4-turbo-preview',
});

export const FairnessAgent = new Agent({
  name: 'fairness-auditor',
  role: 'Schedule Fairness Auditor',
  systemPrompt: `You are a fairness auditor for ICU scheduling.
Your job is to:
- Analyze workload distribution across providers
- Check for bias in shift assignments (weekend, night, holiday)
- Compare actual vs target shifts per provider
- Identify providers who are over/under-assigned

Provide fairness metrics:
- Standard deviation of assignments
- Gini coefficient for workload distribution
- Equity ratio by shift type
- Recommendations for rebalancing

Output format: JSON with fairness scores and recommendations.`,
  model: 'gpt-4-turbo-preview',
});

export const FatigueAgent = new Agent({
  name: 'fatigue-monitor',
  role: 'Provider Fatigue Risk Analyst',
  systemPrompt: `You are a fatigue risk analyst for healthcare scheduling.
Your job is to:
- Analyze consecutive night shifts
- Check for adequate rest periods between shifts
- Monitor provider-specific recovery needs
- Identify high-risk scheduling patterns

Evaluate against safety guidelines:
- Max consecutive nights (provider-specific)
- Min days off after night shifts
- Back-to-back assignments
- Weekly hour limits

Output format: JSON with risk scores and safety recommendations.`,
  model: 'gpt-4-turbo-preview',
});

export const ExplainabilityAgent = new Agent({
  name: 'decision-explainer',
  role: 'Schedule Decision Explainer',
  systemPrompt: `You are a decision explainer for AI-generated schedules.
Your job is to:
- Translate optimization outputs into human-readable explanations
- Explain why specific providers were assigned to specific shifts
- Clarify trade-offs made during optimization
- Provide context for policy profile decisions

Tone should be professional and accessible to schedulers.
Include:
- Primary reasoning for assignments
- Alternative options considered
- Policy considerations applied
- Any manual review needed

Output format: Natural language explanation + structured key points.`,
  model: 'gpt-3.5-turbo', // Lighter model for explanations
});

export const ConflictResolutionAgent = new Agent({
  name: 'conflict-resolver',
  role: 'Scheduling Conflict Resolver',
  systemPrompt: `You are a conflict resolution specialist for ICU schedules.
Your job is to:
- Detect double-bookings, skill mismatches, time-off violations
- Propose specific fixes for each conflict
- Prioritize conflicts by severity (patient safety first)
- Suggest alternative assignments

For each conflict:
1. Identify root cause
2. Propose 2-3 resolution options
3. Rate each option by impact and feasibility
4. Recommend best option with rationale

Output format: JSON with conflict list and resolution plan.`,
  model: 'gpt-4-turbo-preview',
});

export const ScenarioPlannerAgent = new Agent({
  name: 'scenario-planner',
  role: 'What-If Scenario Analyst',
  systemPrompt: `You are a scenario planning analyst for ICU staffing.
Your job is to:
- Model the impact of provider absences
- Analyze census surge scenarios
- Evaluate "what-if" schedule changes
- Predict staffing bottlenecks

Provide projections for:
- Coverage percentage under different scenarios
- Risk areas that may need float pool
- Cost implications of different staffing strategies
- Confidence intervals for predictions

Output format: JSON with scenario results and risk assessment.`,
  model: 'gpt-4-turbo-preview',
});
```

### 2. Supervisor Orchestrator

```typescript
// orchestrator/scheduler-supervisor.ts

interface SchedulingTask {
  type: 'optimize' | 'analyze' | 'explain' | 'simulate' | 'audit';
  state: ScheduleState;
  policyProfile: string;
  priority: 'critical' | 'standard' | 'low';
}

export class SchedulerSupervisor {
  private agents: Map<string, Agent> = new Map();
  private sharedMemory: SharedMemory;
  private maxIterations = 5;

  constructor(sessionId: string) {
    this.sharedMemory = new SharedMemory(sessionId);
    this.registerAgents();
  }

  private registerAgents() {
    this.agents.set('coverage', CoverageAgent);
    this.agents.set('fairness', FairnessAgent);
    this.agents.set('fatigue', FatigueAgent);
    this.agents.set('explainer', ExplainabilityAgent);
    this.agents.set('conflict', ConflictResolutionAgent);
    this.agents.set('scenario', ScenarioPlannerAgent);
  }

  async executeOptimization(task: SchedulingTask): Promise<OptimizationResult> {
    const context = await this.gatherContext(task);
    
    // Phase 1: Parallel analysis
    const analysisResults = await this.executeParallel([
      { agent: 'coverage', task: 'Analyze coverage gaps', context },
      { agent: 'fairness', task: 'Audit current fairness', context },
      { agent: 'fatigue', task: 'Check fatigue risks', context },
      { agent: 'conflict', task: 'Detect conflicts', context },
    ]);

    // Phase 2: Store intermediate results
    await this.sharedMemory.set('phase1-analysis', analysisResults);

    // Phase 3: Supervisor synthesis
    const synthesis = await this.synthesizeAnalyses(analysisResults, task);

    // Phase 4: Generate optimized assignments
    const optimization = await this.generateOptimization(synthesis, task);

    // Phase 5: Generate explanation
    const explanation = await this.agents.get('explainer')!.execute(
      `Explain this optimization: ${JSON.stringify(optimization)}`,
      context
    );

    return {
      ...optimization,
      explanation: explanation.content,
      agentMetadata: {
        agentsInvoked: ['coverage', 'fairness', 'fatigue', 'conflict', 'explainer'],
        iterations: 1,
        parallelExecutions: 4,
      },
    };
  }

  async executeSimulation(task: SchedulingTask, scenario: ScenarioConfig): Promise<SimulationResult> {
    // Fan-out: Run multiple scenarios in parallel
    const scenarios = this.generateScenarioVariants(scenario);
    
    const scenarioResults = await Promise.all(
      scenarios.map(async (variant) => {
        const result = await this.agents.get('scenario')!.execute(
          `Simulate scenario: ${JSON.stringify(variant)}`,
          { state: task.state, policyProfile: task.policyProfile }
        );
        return { variant, result: result.content };
      })
    );

    // Fan-in: Aggregate and synthesize
    const aggregation = await this.aggregateScenarioResults(scenarioResults);
    
    return {
      baseline: aggregation.baseline,
      projections: aggregation.projections,
      confidenceIntervals: aggregation.confidenceIntervals,
      recommendations: aggregation.recommendations,
      scenarioCount: scenarios.length,
    };
  }

  private async executeParallel(
    tasks: Array<{ agent: string; task: string; context: any }>
  ): Promise<Map<string, AgentResponse>> {
    const results = new Map<string, AgentResponse>();
    
    await Promise.all(
      tasks.map(async ({ agent, task, context }) => {
        const agentInstance = this.agents.get(agent);
        if (!agentInstance) throw new Error(`Agent ${agent} not found`);
        
        const result = await agentInstance.execute(task, context);
        results.set(agent, result);
        
        // Store in shared memory
        await this.sharedMemory.setAgentOutput(agent, result.content);
      })
    );

    return results;
  }

  private async synthesizeAnalyses(
    results: Map<string, AgentResponse>,
    task: SchedulingTask
  ): Promise<SynthesisResult> {
    const synthesisPrompt = `As the supervisor, synthesize these analysis results into an optimization strategy:

Coverage Analysis: ${results.get('coverage')?.content}
Fairness Analysis: ${results.get('fairness')?.content}
Fatigue Analysis: ${results.get('fatigue')?.content}
Conflict Analysis: ${results.get('conflict')?.content}

Policy Profile: ${task.policyProfile}
Priority: ${task.priority}

Provide a synthesis that balances all factors according to the policy profile.`;

    // Use a dedicated synthesis agent or the supervisor's own LLM
    const synthesisAgent = new Agent({
      name: 'synthesizer',
      role: 'Strategy Synthesizer',
      systemPrompt: 'You synthesize multiple analyses into a coherent optimization strategy.',
    });

    const response = await synthesisAgent.execute(synthesisPrompt);
    return JSON.parse(response.content);
  }
}
```

### 3. Shared Memory System

```typescript
// memory/scheduler-memory.ts

interface SchedulingContext {
  sessionId: string;
  state: ScheduleState;
  analyses: Record<string, any>;
  decisions: DecisionLogEntry[];
  providerPreferences: Map<string, ProviderPreferences>;
  historicalPatterns: HistoricalPattern[];
}

export class SchedulerMemory {
  private redis: Redis;
  private sessionId: string;

  constructor(sessionId: string) {
    this.redis = new Redis(process.env.REDIS_URL!);
    this.sessionId = `scheduler:${sessionId}`;
  }

  async cacheState(state: ScheduleState, ttl: number = 3600): Promise<void> {
    await this.redis.setex(
      `${this.sessionId}:state`,
      ttl,
      JSON.stringify(state)
    );
  }

  async getState(): Promise<ScheduleState | null> {
    const data = await this.redis.get(`${this.sessionId}:state`);
    return data ? JSON.parse(data) : null;
  }

  async appendDecision(decision: DecisionLogEntry): Promise<void> {
    const key = `${this.sessionId}:decisions`;
    await this.redis.lpush(key, JSON.stringify(decision));
    await this.redis.ltrim(key, 0, 999); // Keep last 1000 decisions
  }

  async getDecisionHistory(limit: number = 100): Promise<DecisionLogEntry[]> {
    const key = `${this.sessionId}:decisions`;
    const entries = await this.redis.lrange(key, 0, limit - 1);
    return entries.map(e => JSON.parse(e));
  }

  async cacheAgentOutput(agent: string, output: string, ttl: number = 1800): Promise<void> {
    await this.redis.setex(
      `${this.sessionId}:agent:${agent}`,
      ttl,
      output
    );
  }

  async getAgentOutput(agent: string): Promise<string | null> {
    return this.redis.get(`${this.sessionId}:agent:${agent}`);
  }

  async learnFromFeedback(decisionId: string, feedback: FeedbackData): Promise<void> {
    // Store feedback for continuous learning
    const key = `${this.sessionId}:feedback:${decisionId}`;
    await this.redis.set(key, JSON.stringify(feedback));
    
    // Update provider preference models
    if (feedback.providerId) {
      await this.updateProviderModel(feedback.providerId, feedback);
    }
  }

  private async updateProviderModel(providerId: string, feedback: FeedbackData): Promise<void> {
    // Aggregate feedback to improve future recommendations
    const key = `${this.sessionId}:provider-model:${providerId}`;
    const existing = await this.redis.get(key);
    const model = existing ? JSON.parse(existing) : { feedbacks: [], patterns: {} };
    
    model.feedbacks.push(feedback);
    // Simple pattern learning
    if (feedback.shiftType) {
      model.patterns[feedback.shiftType] = (model.patterns[feedback.shiftType] || 0) + 
        (feedback.accepted ? 1 : -1);
    }
    
    await this.redis.setex(key, 86400 * 30, JSON.stringify(model)); // 30 day retention
  }
}
```

### 4. Workflow Definitions

```typescript
// workflows/scheduling-workflows.ts

export const OptimizationWorkflow: WorkflowDefinition = {
  name: 'schedule-optimization',
  description: 'Multi-agent schedule optimization with explainability',
  agents: ['coverage', 'fairness', 'fatigue', 'conflict', 'explainer'],
  steps: [
    {
      id: 'parallel-analysis',
      type: 'parallel',
      agents: ['coverage', 'fairness', 'fatigue', 'conflict'],
      input: '{state}',
      outputKey: 'analyses',
    },
    {
      id: 'synthesis',
      type: 'sequential',
      agent: 'synthesizer',
      input: 'Synthesize analyses: {analyses}',
      outputKey: 'strategy',
      dependsOn: ['parallel-analysis'],
    },
    {
      id: 'optimization',
      type: 'sequential',
      agent: 'coverage', // Reuse coverage agent with different prompt
      input: 'Generate assignments based on strategy: {strategy}',
      outputKey: 'assignments',
      dependsOn: ['synthesis'],
    },
    {
      id: 'explanation',
      type: 'sequential',
      agent: 'explainer',
      input: 'Explain assignments: {assignments} with strategy: {strategy}',
      outputKey: 'explanation',
      dependsOn: ['optimization'],
    },
    {
      id: 'validation',
      type: 'sequential',
      agent: 'conflict',
      input: 'Validate final assignments: {assignments}',
      outputKey: 'validation',
      dependsOn: ['optimization'],
      loop: {
        condition: 'validation.hasConflicts === true',
        maxIterations: 3,
        backTo: 'optimization',
      },
    },
  ],
  errorHandling: 'retry',
  maxRetries: 2,
};

export const WhatIfWorkflow: WorkflowDefinition = {
  name: 'what-if-analysis',
  description: 'Scenario planning with uncertainty quantification',
  agents: ['scenario', 'coverage', 'explainer'],
  steps: [
    {
      id: 'generate-scenarios',
      type: 'sequential',
      agent: 'scenario',
      input: 'Generate scenario variants for: {scenario}',
      outputKey: 'scenarios',
    },
    {
      id: 'parallel-simulation',
      type: 'parallel',
      agents: ['scenario'], // Same agent, different inputs
      iterateOver: '{scenarios}',
      outputKey: 'simulations',
      dependsOn: ['generate-scenarios'],
    },
    {
      id: 'aggregate',
      type: 'sequential',
      agent: 'scenario',
      input: 'Aggregate simulations: {simulations}',
      outputKey: 'projections',
      dependsOn: ['parallel-simulation'],
    },
    {
      id: 'explain',
      type: 'sequential',
      agent: 'explainer',
      input: 'Explain projections: {projections}',
      outputKey: 'explanation',
      dependsOn: ['aggregate'],
    },
  ],
  errorHandling: 'fallback',
};

export const AuditWorkflow: WorkflowDefinition = {
  name: 'schedule-audit',
  description: 'Comprehensive schedule audit with recommendations',
  agents: ['fairness', 'fatigue', 'conflict', 'explainer'],
  steps: [
    {
      id: 'fairness-audit',
      type: 'sequential',
      agent: 'fairness',
      input: 'Audit fairness of: {state}',
      outputKey: 'fairnessReport',
    },
    {
      id: 'fatigue-audit',
      type: 'sequential',
      agent: 'fatigue',
      input: 'Audit fatigue risks in: {state}',
      outputKey: 'fatigueReport',
      dependsOn: ['fairness-audit'], // Can run in parallel if desired
    },
    {
      id: 'conflict-check',
      type: 'sequential',
      agent: 'conflict',
      input: 'Check all conflicts in: {state}',
      outputKey: 'conflictReport',
    },
    {
      id: 'synthesize-audit',
      type: 'sequential',
      agent: 'explainer',
      input: 'Synthesize audit reports: {fairnessReport}, {fatigueReport}, {conflictReport}',
      outputKey: 'auditSummary',
      dependsOn: ['fairness-audit', 'fatigue-audit', 'conflict-check'],
    },
  ],
  errorHandling: 'abort',
};
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
1. **Set up shared memory infrastructure**
   - Redis integration for caching
   - Session management
   - Agent output persistence

2. **Create agent base classes**
   - Abstract Agent class
   - Message history management
   - Tool integration hooks

3. **Implement first specialized agent**
   - Start with CoverageAgent (highest impact)
   - A/B test against existing deterministic fallback

### Phase 2: Multi-Agent Core (Weeks 3-4)
1. **Implement parallel execution**
   - ParallelOrchestrator class
   - Fan-out/fan-in patterns

2. **Add 2-3 more specialized agents**
   - FairnessAgent
   - FatigueAgent
   - ConflictResolutionAgent

3. **Build supervisor orchestrator**
   - Task routing logic
   - Result synthesis
   - Iteration management

### Phase 3: Workflows & Integration (Weeks 5-6)
1. **Implement workflow engine**
   - Workflow definition parser
   - Step execution with dependency resolution
   - Loop and retry handling

2. **Migrate existing endpoints**
   - `/api/ai/optimize` → OptimizationWorkflow
   - `/api/ai/simulate` → WhatIfWorkflow
   - New `/api/ai/audit` → AuditWorkflow

3. **Add explainability**
   - ExplainabilityAgent integration
   - Natural language explanations for all outputs

### Phase 4: Advanced Features (Weeks 7-8)
1. **Learning & adaptation**
   - Feedback collection
   - Provider preference modeling
   - Continuous improvement loop

2. **Hybrid AI + Solver**
   - AI-guided constraint solving
   - Solver-verified AI suggestions
   - Best of both worlds approach

3. **Real-time collaboration**
   - Multi-user scheduling sessions
   - Agent-assisted conflict resolution
   - Live suggestion updates

---

## Expected Benefits

### 1. **Improved Schedule Quality**
- Specialized agents = deeper domain expertise
- Parallel analysis = more comprehensive coverage
- Iterative refinement = fewer conflicts

### 2. **Better Explainability**
- Natural language explanations for every decision
- Clear rationale for trade-offs
- Transparent policy application

### 3. **Enhanced Reliability**
- Graceful degradation per-agent
- Retry logic at workflow level
- Better error isolation

### 4. **Scalability**
- Parallel execution = faster processing
- Shared memory = efficient context reuse
- Modular agents = easy to extend

### 5. **Continuous Improvement**
- Feedback loops improve agent performance
- Provider preference learning
- Historical pattern recognition

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Increased complexity | Gradual migration, keep deterministic fallback |
| Higher latency | Parallel execution, caching, async processing |
| Cost increase | Smarter routing, model selection per task |
| Agent conflicts | Clear agent boundaries, supervisor mediation |
| Debugging difficulty | Comprehensive logging, agent activity traces |

---

## Success Metrics

1. **Schedule Quality Metrics**
   - Coverage percentage (target: >98%)
   - Fairness score improvement (target: +15%)
   - Fatigue risk reduction (target: -20%)

2. **System Performance**
   - End-to-end latency (target: <3s for optimization)
   - Fallback rate (target: <5%)
   - Cache hit rate (target: >60%)

3. **User Satisfaction**
   - Explanation helpfulness rating (target: >4/5)
   - Manual override rate (target: <10%)
   - Time to approve AI suggestions (target: -30%)

---

## Next Steps

1. **Review and prioritize** the proposed architecture
2. **Set up Redis** for shared memory (if not already)
3. **Implement Agent base class** as foundation
4. **Create first specialized agent** (CoverageAgent)
5. **A/B test** against current deterministic fallback
6. **Iterate** based on results

---

*This brainstorm applies AI Agent Orchestrator patterns to transform the monolithic AI integration into a scalable, multi-agent system with specialized expertise, parallel processing, and continuous learning capabilities.*
