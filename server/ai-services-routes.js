/**
 * AI Services API Routes
 * Unified endpoints for all AI enhancement features
 */

import { 
  getSchedulingOrchestrator,
  getDemandForecastService,
  getNLPAssistant,
  getPreferenceLearningService,
  getAnomalyDetectionService,
} from './ai-services/index.js';

export function registerAIServicesRoutes(app) {
  
  // ============ MULTI-AGENT OPTIMIZATION ============
  
  /**
   * Run multi-agent optimization
   */
  app.post('/api/ai/agents/optimize', async (req, res) => {
    try {
      const { scheduleState } = req.body;
      const orchestrator = getSchedulingOrchestrator();
      const result = await orchestrator.optimizeSchedule(scheduleState);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Get last optimization result (shared memory; for polling after async runs)
   */
  app.get('/api/ai/agents/optimize/result', (req, res) => {
    try {
      const orchestrator = getSchedulingOrchestrator();
      const result = orchestrator.getLastResult();
      if (!result) {
        return res.status(404).json({ error: 'No optimization result available. Run POST /api/ai/agents/optimize first.' });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Stream optimization progress
   */
  app.get('/api/ai/agents/optimize/stream', (req, res) => {
    const orchestrator = getSchedulingOrchestrator();
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const onStart = (data) => res.write(`data: ${JSON.stringify({ event: 'start', data })}\n\n`);
    const onAgentStart = (data) => res.write(`data: ${JSON.stringify({ event: 'agent-start', data })}\n\n`);
    const onAgentComplete = (data) => res.write(`data: ${JSON.stringify({ event: 'agent-complete', data })}\n\n`);
    const onComplete = (data) => {
      res.write(`data: ${JSON.stringify({ event: 'complete', data })}\n\n`);
      res.end();
    };

    orchestrator.on('optimization:start', onStart);
    orchestrator.on('agent:start', onAgentStart);
    orchestrator.on('agent:complete', onAgentComplete);
    orchestrator.on('optimization:complete', onComplete);

    req.on('close', () => {
      orchestrator.off('optimization:start', onStart);
      orchestrator.off('agent:start', onAgentStart);
      orchestrator.off('agent:complete', onAgentComplete);
      orchestrator.off('optimization:complete', onComplete);
    });
  });

  // ============ DEMAND FORECASTING ============

  /**
   * Generate demand forecast
   */
  app.post('/api/ai/forecast', async (req, res) => {
    try {
      const { startDate, days } = req.body;
      const service = getDemandForecastService();
      const forecast = await service.generateForecast(startDate, days);
      res.json({ forecast });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Get forecast for date range
   */
  app.get('/api/ai/forecast', async (req, res) => {
    try {
      const { startDate, days = 14 } = req.query;
      const service = getDemandForecastService();
      const forecast = await service.generateForecast(startDate, parseInt(days));
      res.json({ forecast });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Update demand patterns from schedule data
   */
  app.post('/api/ai/forecast/learn', async (req, res) => {
    try {
      const { scheduleData } = req.body;
      const service = getDemandForecastService();
      await service.updatePatterns(scheduleData);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ NLP ASSISTANT ============

  /**
   * Process natural language query
   */
  app.post('/api/ai/assistant/chat', async (req, res) => {
    try {
      const { message, userId, context } = req.body;
      const assistant = getNLPAssistant();
      const result = await assistant.processInput(userId, message, context);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Get conversation history
   */
  app.get('/api/ai/assistant/history/:userId', (req, res) => {
    const assistant = getNLPAssistant();
    const history = assistant.getHistory(req.params.userId);
    res.json({ history });
  });

  /**
   * Clear conversation history
   */
  app.delete('/api/ai/assistant/history/:userId', (req, res) => {
    const assistant = getNLPAssistant();
    assistant.clearHistory(req.params.userId);
    res.json({ success: true });
  });

  // ============ PREFERENCE LEARNING ============

  /**
   * Learn preferences for a provider
   */
  app.post('/api/ai/preferences/learn/:providerId', async (req, res) => {
    try {
      const { historicalData } = req.body;
      const service = getPreferenceLearningService();
      const model = await service.learnProviderPreferences(req.params.providerId, historicalData);
      res.json({ model });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Learn preferences for all providers
   */
  app.post('/api/ai/preferences/learn-all', async (req, res) => {
    try {
      const { scheduleState } = req.body;
      const service = getPreferenceLearningService();
      const results = await service.learnAllProviders(scheduleState);
      res.json({ results });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Get preference model for provider
   */
  app.get('/api/ai/preferences/:providerId', (req, res) => {
    const service = getPreferenceLearningService();
    const model = service.models.get(req.params.providerId);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    res.json({ model });
  });

  /**
   * Get all preference models
   */
  app.get('/api/ai/preferences', (req, res) => {
    const service = getPreferenceLearningService();
    const models = service.getAllModels();
    res.json({ models });
  });

  /**
   * Get shift recommendation based on preferences
   */
  app.post('/api/ai/preferences/recommend/:providerId', (req, res) => {
    const { shift } = req.body;
    const service = getPreferenceLearningService();
    const recommendation = service.getShiftRecommendation(req.params.providerId, shift);
    res.json({ recommendation });
  });

  // ============ ANOMALY DETECTION ============

  /**
   * Start anomaly detection
   */
  app.post('/api/ai/anomalies/start', (req, res) => {
    const service = getAnomalyDetectionService();
    service.start();
    res.json({ status: 'started' });
  });

  /**
   * Stop anomaly detection
   */
  app.post('/api/ai/anomalies/stop', (req, res) => {
    const service = getAnomalyDetectionService();
    service.stop();
    res.json({ status: 'stopped' });
  });

  /**
   * Run detection cycle manually
   */
  app.post('/api/ai/anomalies/detect', async (req, res) => {
    try {
      const service = getAnomalyDetectionService();
      await service.runDetection();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Get active alerts
   */
  app.get('/api/ai/anomalies/alerts', (req, res) => {
    const { severity } = req.query;
    const service = getAnomalyDetectionService();
    const alerts = service.getActiveAlerts(severity);
    res.json({ alerts, count: alerts.length });
  });

  /**
   * Get alert history
   */
  app.get('/api/ai/anomalies/history', (req, res) => {
    const { limit } = req.query;
    const service = getAnomalyDetectionService();
    const history = service.getAlertHistory(parseInt(limit) || 100);
    res.json({ history });
  });

  /**
   * Resolve an alert
   */
  app.post('/api/ai/anomalies/alerts/:alertId/resolve', (req, res) => {
    const { resolution } = req.body;
    const service = getAnomalyDetectionService();
    const success = service.resolveAlert(req.params.alertId, resolution);
    res.json({ success });
  });

  /**
   * Subscribe to alerts via SSE
   */
  app.get('/api/ai/anomalies/stream', (req, res) => {
    const service = getAnomalyDetectionService();
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const onAnomaly = (alert) => {
      res.write(`data: ${JSON.stringify({ event: 'anomaly', alert })}\n\n`);
    };

    const onCritical = (alert) => {
      res.write(`data: ${JSON.stringify({ event: 'critical', alert })}\n\n`);
    };

    service.on('anomaly:detected', onAnomaly);
    service.on('anomaly:critical', onCritical);

    req.on('close', () => {
      service.off('anomaly:detected', onAnomaly);
      service.off('anomaly:critical', onCritical);
    });

    res.write(`data: ${JSON.stringify({ event: 'connected' })}\n\n`);
  });

  // ============ UNIFIED STATUS ============

  /**
   * Get all AI services status
   */
  app.get('/api/ai/status', async (req, res) => {
    const { getAIServicesStatus } = await import('./ai-services/index.js');
    const status = getAIServicesStatus();
    res.json(status);
  });

  console.log('[AI Services] Routes registered');
}

export default registerAIServicesRoutes;
