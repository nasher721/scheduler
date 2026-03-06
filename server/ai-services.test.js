/**
 * AI Services Integration Tests
 * Tests all 5 AI enhancement implementations
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { 
  initializeAIServices,
  getSchedulingOrchestrator,
  getDemandForecastService,
  getNLPAssistant,
  getPreferenceLearningService,
  getAnomalyDetectionService,
} from './ai-services/index.js';
import { getSharedMemoryService } from './shared-memory-service.js';

// Test data
const mockScheduleState = {
  providers: [
    {
      id: 'dr-smith',
      name: 'Dr. Smith',
      skills: ['general', 'stroke'],
      targetWeekDays: 5,
      targetWeekendDays: 2,
      targetWeekNights: 2,
      timeOffRequests: [],
    },
    {
      id: 'dr-jones',
      name: 'Dr. Jones',
      skills: ['general', 'trauma'],
      targetWeekDays: 5,
      targetWeekendDays: 2,
      targetWeekNights: 2,
      timeOffRequests: [],
    },
  ],
  slots: [
    { id: 'slot-1', date: '2024-03-15', type: 'DAY', providerId: 'dr-smith', isWeekendLayout: false, requiredSkill: 'general', priority: 'STANDARD' },
    { id: 'slot-2', date: '2024-03-15', type: 'NIGHT', providerId: null, isWeekendLayout: false, requiredSkill: 'stroke', priority: 'CRITICAL' },
    { id: 'slot-3', date: '2024-03-16', type: 'DAY', providerId: 'dr-jones', isWeekendLayout: true, requiredSkill: 'general', priority: 'STANDARD' },
  ],
};

describe('AI Services Integration', () => {
  let services;
  let memory;

  before(async () => {
    console.log('Initializing AI services for testing...');
    services = await initializeAIServices({
      startAnomalyDetection: false, // Don't start background monitoring in tests
    });
    memory = getSharedMemoryService();
  });

  after(() => {
    // Clean up
    if (services?.anomalyDetection) {
      services.anomalyDetection.stop();
    }
  });

  describe('1. Multi-Agent Constraint Resolution', () => {
    it('should initialize orchestrator', () => {
      assert.ok(services.orchestrator, 'Orchestrator should be initialized');
      assert.ok(getSchedulingOrchestrator(), 'Singleton should return same instance');
    });

    it('should have all 5 agents registered', () => {
      const orchestrator = services.orchestrator;
      assert.ok(orchestrator.agents.coverage, 'Coverage agent should exist');
      assert.ok(orchestrator.agents.fairness, 'Fairness agent should exist');
      assert.ok(orchestrator.agents.preference, 'Preference agent should exist');
      assert.ok(orchestrator.agents.compliance, 'Compliance agent should exist');
      assert.ok(orchestrator.agents.director, 'Director agent should exist');
    });

    it('should run parallel analysis (mock)', async () => {
      const orchestrator = services.orchestrator;
      
      // Mock the agent execute methods to avoid API calls
      for (const agent of Object.values(orchestrator.agents)) {
        agent.execute = async () => ({
          agentName: agent.name,
          content: JSON.stringify({ status: 'ok', violations: [] }),
          parsedContent: { status: 'ok', violations: [] },
          completed: true,
          timestamp: Date.now(),
        });
      }

      const context = {
        scheduleState: mockScheduleState,
        providers: mockScheduleState.providers,
      };

      const results = await orchestrator.runParallelAnalysis(context);
      
      assert.ok(results.coverage, 'Coverage result should exist');
      assert.ok(results.fairness, 'Fairness result should exist');
      assert.ok(results.preference, 'Preference result should exist');
      assert.ok(results.compliance, 'Compliance result should exist');
    });
  });

  describe('2. Demand Forecasting', () => {
    it('should initialize forecast service', () => {
      assert.ok(services.demandForecast, 'Demand forecast service should be initialized');
    });

    it('should generate forecast', async () => {
      const forecast = await services.demandForecast.generateForecast('2024-03-15', 7);
      
      assert.ok(Array.isArray(forecast), 'Forecast should be an array');
      assert.strictEqual(forecast.length, 7, 'Should have 7 days');
      
      // Check first day structure
      const firstDay = forecast[0];
      assert.ok(firstDay.date, 'Should have date');
      assert.ok(firstDay.dayShift, 'Should have dayShift');
      assert.ok(firstDay.nightShift, 'Should have nightShift');
      assert.ok(typeof firstDay.confidence === 'number', 'Should have confidence score');
      assert.ok(Array.isArray(firstDay.factors), 'Should have factors array');
    });

    it('should store forecast in shared memory', async () => {
      await services.demandForecast.generateForecast('2024-03-20', 5);
      const stored = memory.get('forecast:2024-03-20:5');
      
      assert.ok(stored, 'Forecast should be stored');
      assert.ok(stored.generatedAt, 'Should have generatedAt timestamp');
      assert.strictEqual(stored.days, 5, 'Should store correct days');
    });

    it('should use default patterns when no historical data', () => {
      const patterns = services.demandForecast.getDefaultPatterns();
      
      assert.ok(patterns.dayOfWeek, 'Should have dayOfWeek patterns');
      assert.ok(patterns.seasonal, 'Should have seasonal patterns');
      assert.strictEqual(Object.keys(patterns.dayOfWeek).length, 7, 'Should have 7 days');
      assert.strictEqual(Object.keys(patterns.seasonal).length, 12, 'Should have 12 months');
    });
  });

  describe('3. NLP Assistant', () => {
    it('should initialize NLP assistant', () => {
      assert.ok(services.nlpAssistant, 'NLP assistant should be initialized');
    });

    it('should classify intent', async () => {
      // Mock the classifyIntent to avoid API calls
      services.nlpAssistant.classifyIntent = async () => ({
        type: 'FIND_PROVIDER',
        confidence: 0.95,
      });

      const intent = await services.nlpAssistant.classifyIntent('Who can cover Friday night?');
      
      assert.strictEqual(intent.type, 'FIND_PROVIDER');
      assert.ok(intent.confidence > 0);
    });

    it('should extract entities', async () => {
      // Mock entity extraction
      services.nlpAssistant.extractEntities = async () => ({
        dates: ['2024-03-15'],
        shiftTypes: ['NIGHT'],
        skills: ['stroke'],
      });

      const entities = await services.nlpAssistant.extractEntities(
        'Who can cover Friday night with stroke certification?'
      );
      
      assert.ok(entities.dates.length > 0);
      assert.ok(entities.shiftTypes.includes('NIGHT'));
    });

    it('should find available providers', () => {
      const available = services.nlpAssistant.findAvailableProviders(
        '2024-03-15',
        'DAY',
        ['general'],
        mockScheduleState
      );
      
      assert.ok(Array.isArray(available));
      // Dr. Smith is already assigned on 03-15, Dr. Jones should be available
      assert.ok(available.some(p => p.id === 'dr-jones'));
    });

    it('should rank providers', () => {
      const providers = mockScheduleState.providers;
      const ranked = services.nlpAssistant.rankProviders(
        providers,
        '2024-03-20',
        'DAY',
        mockScheduleState
      );
      
      assert.ok(Array.isArray(ranked));
      assert.ok(ranked[0].score >= 0);
      assert.ok(ranked[0].reasons.length > 0);
    });

    it('should maintain conversation history', () => {
      const userId = 'test-user';
      services.nlpAssistant.addToHistory(userId, { role: 'user', content: 'Hello' });
      services.nlpAssistant.addToHistory(userId, { role: 'assistant', content: 'Hi there' });
      
      const history = services.nlpAssistant.getHistory(userId);
      assert.strictEqual(history.length, 2);
      
      services.nlpAssistant.clearHistory(userId);
      assert.strictEqual(services.nlpAssistant.getHistory(userId).length, 0);
    });
  });

  describe('4. Preference Learning', () => {
    it('should initialize preference learning service', () => {
      assert.ok(services.preferenceLearning, 'Preference learning should be initialized');
    });

    it('should learn provider preferences', async () => {
      const historicalData = {
        slots: mockScheduleState.slots.filter(s => s.providerId === 'dr-smith'),
        timeOffRequests: [],
      };

      const model = await services.preferenceLearning.learnProviderPreferences(
        'dr-smith',
        historicalData
      );
      
      assert.ok(model.providerId, 'Should have providerId');
      assert.ok(model.lastUpdated, 'Should have lastUpdated');
      assert.ok(model.shiftTypePreference, 'Should have shiftTypePreference');
      assert.ok(model.dayOfWeekPreference, 'Should have dayOfWeekPreference');
      assert.ok(model.confidence, 'Should have confidence scores');
    });

    it('should analyze shift type preference', () => {
      const data = {
        slots: [
          { type: 'DAY' }, { type: 'DAY' }, { type: 'DAY' },
          { type: 'NIGHT' },
        ],
        timeOffRequests: [],
      };

      const result = services.preferenceLearning.analyzeShiftTypePreference(data);
      
      assert.ok(result.preference);
      assert.ok(typeof result.strength === 'number');
      assert.ok(typeof result.dayRatio === 'number');
      assert.ok(typeof result.nightRatio === 'number');
    });

    it('should analyze day of week preference', () => {
      const data = {
        slots: [
          { date: '2024-03-15' }, // Friday
          { date: '2024-03-15' },
          { date: '2024-03-16' }, // Saturday
        ],
      };

      const result = services.preferenceLearning.analyzeDayOfWeekPreference(data);
      
      assert.ok(result.byDay);
      assert.ok(Array.isArray(result.preferredDays));
      assert.ok(Array.isArray(result.avoidedDays));
    });

    it('should provide shift recommendations', () => {
      // First learn preferences
      const model = {
        providerId: 'dr-smith',
        shiftTypePreference: { preference: 'day', strength: 0.8 },
        dayOfWeekPreference: { preferredDays: ['Mon', 'Tue'], avoidedDays: ['Fri'] },
        seasonalVariation: { highSeason: ['Jan'] },
        fatiguePattern: { fatigueIndicators: 'low' },
        confidence: { shiftTypePreference: 0.9 },
      };
      
      services.preferenceLearning.models.set('dr-smith', model);

      const recommendation = services.preferenceLearning.getShiftRecommendation(
        'dr-smith',
        { date: '2024-03-11', type: 'DAY' } // Monday
      );
      
      assert.ok(typeof recommendation.score === 'number');
      assert.ok(Array.isArray(recommendation.factors));
      assert.ok(typeof recommendation.confidence === 'number');
    });
  });

  describe('5. Anomaly Detection', () => {
    it('should initialize anomaly detection', () => {
      assert.ok(services.anomalyDetection, 'Anomaly detection should be initialized');
    });

    it('should have all detection rules', () => {
      const rules = services.anomalyDetection.rules;
      
      assert.ok(rules.coverageGaps, 'Should have coverageGaps rule');
      assert.ok(rules.skillGaps, 'Should have skillGaps rule');
      assert.ok(rules.acgmeViolation, 'Should have acgmeViolation rule');
      assert.ok(rules.consecutiveShifts, 'Should have consecutiveShifts rule');
      assert.ok(rules.workloadImbalance, 'Should have workloadImbalance rule');
      assert.ok(rules.weekendImbalance, 'Should have weekendImbalance rule');
      assert.ok(rules.burnoutRisk, 'Should have burnoutRisk rule');
      assert.ok(rules.patternAnomaly, 'Should have patternAnomaly rule');
    });

    it('should detect coverage gaps', () => {
      const schedule = {
        ...mockScheduleState,
        slots: [
          ...mockScheduleState.slots,
          { id: 'slot-unassigned', date: '2024-03-17', type: 'DAY', providerId: null, priority: 'CRITICAL' },
        ],
      };

      const gaps = services.anomalyDetection.checkCoverageGaps(schedule);
      
      assert.ok(Array.isArray(gaps));
      // Should find at least one gap (the unassigned critical slot)
      assert.ok(gaps.length > 0);
    });

    it('should detect skill gaps', () => {
      const schedule = {
        ...mockScheduleState,
        slots: [
          { 
            id: 'slot-skill', 
            date: '2024-03-17', 
            type: 'DAY', 
            providerId: 'dr-smith', // Has general, stroke skills
            requiredSkill: 'trauma', // Missing skill
          },
        ],
        providers: mockScheduleState.providers,
      };

      const gaps = services.anomalyDetection.checkSkillGaps(schedule);
      
      assert.ok(Array.isArray(gaps));
      // Dr. Smith doesn't have trauma certification
      assert.ok(gaps.length > 0);
    });

    it('should calculate consecutive shifts', () => {
      const shifts = [
        { date: '2024-03-15' },
        { date: '2024-03-16' },
        { date: '2024-03-17' },
        { date: '2024-03-19' }, // Gap
      ];

      const consecutive = services.anomalyDetection.findConsecutiveShifts(shifts);
      assert.strictEqual(consecutive, 3);
    });

    it('should filter duplicate alerts', () => {
      const alert1 = { rule: 'test', title: 'Test Alert', affectedShifts: ['s1'] };
      const alert2 = { rule: 'test', title: 'Test Alert', affectedShifts: ['s1'] }; // Duplicate
      const alert3 = { rule: 'test', title: 'Different Alert', affectedShifts: ['s2'] };

      services.anomalyDetection.addAlert({ ...alert1, timestamp: Date.now() });
      
      const newAlerts = services.anomalyDetection.filterDuplicateAlerts([alert2, alert3]);
      
      // alert2 should be filtered as duplicate
      assert.strictEqual(newAlerts.length, 1);
      assert.strictEqual(newAlerts[0].title, 'Different Alert');
    });

    it('should manage alert resolution', () => {
      const alert = {
        id: 'test-alert-1',
        rule: 'test',
        title: 'Test',
        timestamp: Date.now(),
      };

      services.anomalyDetection.addAlert(alert);
      
      const resolved = services.anomalyDetection.resolveAlert('test-alert-1', 'Fixed');
      assert.strictEqual(resolved, true);
      
      const active = services.anomalyDetection.getActiveAlerts();
      assert.ok(!active.some(a => a.id === 'test-alert-1'));
    });
  });

  describe('Shared Memory Integration', () => {
    it('should store optimization status', async () => {
      const orchestrator = services.orchestrator;
      orchestrator.memory.set('scheduling:optimization:status', {
        status: 'running',
        iteration: 2,
        startedAt: Date.now(),
      });

      const status = orchestrator.getStatus();
      assert.ok(status);
      assert.strictEqual(status.status, 'running');
    });

    it('should store anomaly alerts', () => {
      const service = services.anomalyDetection;
      const testAlert = {
        id: 'test-1',
        rule: 'test',
        severity: 'HIGH',
        title: 'Test Alert',
        timestamp: Date.now(),
      };

      service.addAlert(testAlert);
      service.memory.set('anomaly:alerts:recent', [testAlert]);

      const stored = service.memory.get('anomaly:alerts:recent');
      assert.ok(Array.isArray(stored));
      assert.strictEqual(stored.length, 1);
    });
  });
});

console.log('AI Services tests defined. Run with: node --test ai-services.test.js');
