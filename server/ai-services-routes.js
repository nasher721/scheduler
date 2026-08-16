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
      const scheduleState = req.body?.scheduleState || req.body?.state || req.body;
      if (!scheduleState || typeof scheduleState !== 'object') {
        return res.status(400).json({
          ok: false,
          error: 'Missing or invalid scheduleState payload',
          code: 'INVALID_PARAMETERS',
        });
      }

      const orchestrator = getSchedulingOrchestrator();
      const result = await orchestrator.optimizeSchedule(scheduleState);
      res.json({
        ok: true,
        data: result,
        ...result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      console.error('[AI Services] Optimize failed:', error);
      res.status(500).json({
        ok: false,
        error: error.message || 'Optimization failed',
        code: 'OPTIMIZATION_ERROR',
      });
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
        return res.status(404).json({
          ok: false,
          error: 'No optimization result available. Run POST /api/ai/agents/optimize first.',
          code: 'NOT_FOUND',
        });
      }
      res.json({
        ok: true,
        data: result,
        ...result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error.message,
        code: 'INTERNAL_ERROR',
      });
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
    res.write('retry: 3000\n\n');

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

    // Keepalive ping
    const keepalive = setInterval(() => {
      res.write(': ping\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(keepalive);
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
      const startDate = req.body?.startDate || new Date().toISOString().split('T')[0];
      const days = Math.max(1, Math.min(90, parseInt(req.body?.days, 10) || 14));
      const service = getDemandForecastService();
      const forecast = await service.generateForecast(startDate, days);
      res.json({
        ok: true,
        data: { forecast, startDate, days },
        forecast,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      console.error('[AI Services] Forecast POST error:', error);
      res.status(500).json({
        ok: false,
        error: error.message,
        code: 'FORECAST_ERROR',
      });
    }
  });

  /**
   * Get forecast for date range
   */
  app.get('/api/ai/forecast', async (req, res) => {
    try {
      const startDate = req.query.startDate || new Date().toISOString().split('T')[0];
      const days = Math.max(1, Math.min(90, parseInt(req.query.days, 10) || 14));
      const service = getDemandForecastService();
      const forecast = await service.generateForecast(startDate, days);
      res.json({
        ok: true,
        data: { forecast, startDate, days },
        forecast,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      console.error('[AI Services] Forecast GET error:', error);
      res.status(500).json({
        ok: false,
        error: error.message,
        code: 'FORECAST_ERROR',
      });
    }
  });

  /**
   * Update demand patterns from schedule data
   */
  app.post('/api/ai/forecast/learn', async (req, res) => {
    try {
      const { scheduleData } = req.body || {};
      if (!scheduleData) {
        return res.status(400).json({
          ok: false,
          error: 'scheduleData is required',
          code: 'INVALID_PARAMETERS',
        });
      }
      const service = getDemandForecastService();
      await service.updatePatterns(scheduleData);
      res.json({
        ok: true,
        success: true,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error.message,
        code: 'LEARN_ERROR',
      });
    }
  });

  // ============ NLP ASSISTANT ============

  /**
   * Process natural language query
   */
  app.post('/api/ai/assistant/chat', async (req, res) => {
    try {
      const { message, userId = 'default_user', context } = req.body || {};
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({
          ok: false,
          error: 'message string is required',
          code: 'INVALID_PARAMETERS',
        });
      }

      const assistant = getNLPAssistant();
      const result = await assistant.processInput(userId, message.trim(), context);
      res.json({
        ok: true,
        data: result,
        ...result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      console.error('[AI Assistant] Chat error:', error);
      res.status(500).json({
        ok: false,
        error: error.message,
        code: 'ASSISTANT_ERROR',
      });
    }
  });

  /**
   * Get conversation history
   */
  app.get('/api/ai/assistant/history/:userId', (req, res) => {
    try {
      const assistant = getNLPAssistant();
      const history = assistant.getHistory(req.params.userId);
      res.json({
        ok: true,
        data: { history },
        history,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error.message,
        code: 'HISTORY_ERROR',
      });
    }
  });

  /**
   * Clear conversation history
   */
  app.delete('/api/ai/assistant/history/:userId', (req, res) => {
    try {
      const assistant = getNLPAssistant();
      assistant.clearHistory(req.params.userId);
      res.json({
        ok: true,
        success: true,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error.message,
        code: 'HISTORY_ERROR',
      });
    }
  });

  // ============ PREFERENCE LEARNING ============

  /**
   * Learn preferences for a provider
   */
  app.post('/api/ai/preferences/learn/:providerId', async (req, res) => {
    try {
      const { historicalData } = req.body || {};
      const { providerId } = req.params;
      if (!providerId) {
        return res.status(400).json({
          ok: false,
          error: 'providerId is required',
          code: 'INVALID_PARAMETERS',
        });
      }

      const service = getPreferenceLearningService();
      const model = await service.learnProviderPreferences(providerId, historicalData || {});
      res.json({
        ok: true,
        data: { model },
        model,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      console.error('[AI Preferences] Learn error:', error);
      res.status(500).json({
        ok: false,
        error: error.message,
        code: 'LEARN_ERROR',
      });
    }
  });

  /**
   * Learn preferences for all providers
   */
  app.post('/api/ai/preferences/learn-all', async (req, res) => {
    try {
      const scheduleState = req.body?.scheduleState || req.body;
      const service = getPreferenceLearningService();
      const results = await service.learnAllProviders(scheduleState || {});
      res.json({
        ok: true,
        data: { results },
        results,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      console.error('[AI Preferences] Learn-all error:', error);
      res.status(500).json({
        ok: false,
        error: error.message,
        code: 'LEARN_ALL_ERROR',
      });
    }
  });

  /**
   * Get preference model for provider
   */
  app.get('/api/ai/preferences/:providerId', (req, res) => {
    const service = getPreferenceLearningService();
    const model = service.models.get(req.params.providerId);
    if (!model) {
      return res.status(404).json({
        ok: false,
        error: `Preference model not found for provider ${req.params.providerId}`,
        code: 'NOT_FOUND',
      });
    }
    res.json({
      ok: true,
      data: { model },
      model,
      meta: { timestamp: new Date().toISOString() },
    });
  });

  /**
   * Get all preference models
   */
  app.get('/api/ai/preferences', (req, res) => {
    const service = getPreferenceLearningService();
    const models = service.getAllModels();
    res.json({
      ok: true,
      data: { models },
      models,
      meta: { timestamp: new Date().toISOString() },
    });
  });

  /**
   * Get shift recommendation based on preferences
   */
  app.post('/api/ai/preferences/recommend/:providerId', (req, res) => {
    const { shift } = req.body || {};
    const service = getPreferenceLearningService();
    const recommendation = service.getShiftRecommendation(req.params.providerId, shift || {});
    res.json({
      ok: true,
      data: { recommendation },
      recommendation,
      meta: { timestamp: new Date().toISOString() },
    });
  });

  // ============ ANOMALY DETECTION ============

  /**
   * Start anomaly detection
   */
  app.post('/api/ai/anomalies/start', (req, res) => {
    const service = getAnomalyDetectionService();
    service.start();
    res.json({
      ok: true,
      status: 'started',
      meta: { timestamp: new Date().toISOString() },
    });
  });

  /**
   * Stop anomaly detection
   */
  app.post('/api/ai/anomalies/stop', (req, res) => {
    const service = getAnomalyDetectionService();
    service.stop();
    res.json({
      ok: true,
      status: 'stopped',
      meta: { timestamp: new Date().toISOString() },
    });
  });

  /**
   * Run detection cycle manually
   */
  app.post('/api/ai/anomalies/detect', async (req, res) => {
    try {
      const service = getAnomalyDetectionService();
      await service.runDetection();
      const active = service.getActiveAlerts();
      res.json({
        ok: true,
        success: true,
        count: active.length,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      console.error('[AI Anomalies] Run detection error:', error);
      res.status(500).json({
        ok: false,
        error: error.message,
        code: 'DETECTION_ERROR',
      });
    }
  });

  /**
   * Get active alerts
   */
  app.get('/api/ai/anomalies/alerts', (req, res) => {
    const { severity } = req.query;
    const service = getAnomalyDetectionService();
    const alerts = service.getActiveAlerts(severity);
    res.json({
      ok: true,
      data: { alerts, count: alerts.length },
      alerts,
      count: alerts.length,
      meta: { timestamp: new Date().toISOString() },
    });
  });

  /**
   * Get alert history
   */
  app.get('/api/ai/anomalies/history', (req, res) => {
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 100));
    const service = getAnomalyDetectionService();
    const history = service.getAlertHistory(limit);
    res.json({
      ok: true,
      data: { history, count: history.length },
      history,
      count: history.length,
      meta: { timestamp: new Date().toISOString() },
    });
  });

  /**
   * Resolve an alert
   */
  app.post('/api/ai/anomalies/alerts/:alertId/resolve', (req, res) => {
    const { resolution = 'Resolved by operator' } = req.body || {};
    const service = getAnomalyDetectionService();
    const success = service.resolveAlert(req.params.alertId, resolution);
    if (!success) {
      return res.status(404).json({
        ok: false,
        error: `Alert ${req.params.alertId} not found`,
        code: 'NOT_FOUND',
      });
    }
    res.json({
      ok: true,
      success: true,
      meta: { timestamp: new Date().toISOString() },
    });
  });

  /**
   * Subscribe to alerts via SSE
   */
  app.get('/api/ai/anomalies/stream', (req, res) => {
    const service = getAnomalyDetectionService();
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write('retry: 3000\n\n');

    const onAnomaly = (alert) => {
      res.write(`data: ${JSON.stringify({ event: 'anomaly', alert })}\n\n`);
    };

    const onCritical = (alert) => {
      res.write(`data: ${JSON.stringify({ event: 'critical', alert })}\n\n`);
    };

    service.on('anomaly:detected', onAnomaly);
    service.on('anomaly:critical', onCritical);

    // Keepalive ping
    const keepalive = setInterval(() => {
      res.write(': ping\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(keepalive);
      service.off('anomaly:detected', onAnomaly);
      service.off('anomaly:critical', onCritical);
    });

    res.write(`data: ${JSON.stringify({ event: 'connected', timestamp: Date.now() })}\n\n`);
  });

  // ============ UNIFIED STATUS ============

  /**
   * Get all AI services status
   */
  app.get('/api/ai/status', async (req, res) => {
    try {
      const { getAIServicesStatus } = await import('./ai-services/index.js');
      const status = await getAIServicesStatus();
      res.json({
        ok: true,
        data: status,
        ...status,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      console.error('[AI Status] Error:', error);
      res.status(500).json({
        ok: false,
        error: error.message,
        code: 'STATUS_ERROR',
      });
    }
  });

  console.log('[AI Services] Routes registered');
}

export default registerAIServicesRoutes;
