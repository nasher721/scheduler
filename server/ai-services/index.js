/**
 * AI Services Module
 * Unified exports for all AI enhancement services
 */

// Import singleton getters
import { getSchedulingOrchestrator } from '../agents/scheduling-orchestrator.js';
import { getDemandForecastService } from './demand-forecast.js';
import { getNLPAssistant } from './nlp-assistant.js';
import { getPreferenceLearningService } from './preference-learning.js';
import { getAnomalyDetectionService } from './anomaly-detector.js';

// Multi-agent system
export { 
  CoverageAgent, 
  FairnessAgent, 
  PreferenceAgent, 
  ComplianceAgent, 
  SchedulingDirectorAgent 
} from '../agents/scheduling-agents.js';
export { SchedulingOrchestrator, getSchedulingOrchestrator } from '../agents/scheduling-orchestrator.js';

// Demand forecasting
export { DemandForecastService, getDemandForecastService } from './demand-forecast.js';

// NLP assistant
export { NLPAssistant, getNLPAssistant } from './nlp-assistant.js';

// Preference learning
export { PreferenceLearningService, getPreferenceLearningService } from './preference-learning.js';

// Anomaly detection
export { AnomalyDetectionService, getAnomalyDetectionService } from './anomaly-detector.js';

/**
 * Initialize all AI services
 */
export async function initializeAIServices(options = {}) {
  console.log('[AI Services] Initializing...');

  try {
    const services = {
      // Multi-agent orchestrator
      orchestrator: getSchedulingOrchestrator(options.orchestrator),
      
      // Demand forecasting
      demandForecast: getDemandForecastService(options.demandForecast),
      
      // NLP assistant
      nlpAssistant: getNLPAssistant(options.nlpAssistant),
      
      // Preference learning
      preferenceLearning: getPreferenceLearningService(options.preferenceLearning),
      
      // Anomaly detection
      anomalyDetection: getAnomalyDetectionService(options.anomalyDetection),
    };

    // Start anomaly detection monitoring
    if (options.startAnomalyDetection !== false) {
      services.anomalyDetection.start();
    }

    console.log('[AI Services] All services initialized');
    return services;
  } catch (error) {
    console.error('[AI Services] Initialization failed:', error);
    throw error;
  }
}

/**
 * Get all AI services status
 */
export async function getAIServicesStatus() {
  try {
    const { getSharedMemoryService } = await import('../shared-memory-service.js');
    const memory = getSharedMemoryService();

    return {
      multiAgent: {
        status: memory.get('scheduling:optimization:status')?.status || 'idle',
      },
      anomalyDetection: {
        status: getAnomalyDetectionService().isRunning ? 'running' : 'stopped',
        lastCheck: memory.get('anomaly:status')?.lastCheck,
        activeAlerts: getAnomalyDetectionService().getActiveAlerts().length,
      },
      preferenceLearning: {
        modelsCount: Object.keys(getPreferenceLearningService().getAllModels()).length,
      },
      demandForecast: {
        lastForecast: memory.keys('forecast:*').length,
      },
    };
  } catch (error) {
    console.error('[AI Services] Failed to get status:', error);
    return {
      multiAgent: { status: 'error' },
      anomalyDetection: { status: 'error', activeAlerts: 0 },
      preferenceLearning: { modelsCount: 0 },
      demandForecast: { lastForecast: 0 },
    };
  }
}
