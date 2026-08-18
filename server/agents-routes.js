/**
 * AI Agents API Routes
 * Endpoints for multi-agent scheduling operations
 */

import { getSchedulingOrchestrator } from './agents/index.js';
import { getSharedMemoryService } from './shared-memory-service.js';

export function registerAgentsRoutes(app) {
  const orchestrator = getSchedulingOrchestrator();
  const memory = getSharedMemoryService();

  /**
   * Run multi-agent optimization
   */
  app.post('/api/agents/optimize', async (req, res) => {
    try {
      const scheduleState = req.body?.scheduleState || req.body?.state || req.body;
      
      if (!scheduleState || typeof scheduleState !== 'object') {
        return res.status(400).json({
          ok: false,
          error: 'scheduleState object is required',
          code: 'INVALID_PARAMETERS',
        });
      }

      console.log('[Agents] Starting multi-agent optimization with state:', {
        providers: Array.isArray(scheduleState.providers) ? scheduleState.providers.length : 0,
        slots: Array.isArray(scheduleState.slots) ? scheduleState.slots.length : 0,
        startDate: scheduleState.startDate,
        numWeeks: scheduleState.numWeeks,
      });

      const result = await orchestrator.optimizeSchedule(scheduleState);
      
      console.log('[Agents] Optimization completed successfully:', {
        success: result.success,
        changes: Array.isArray(result.changes) ? result.changes.length : 0,
        objectiveScore: result.metrics?.objectiveScore,
        duration: result.duration,
      });

      res.json({
        ok: true,
        data: result,
        ...result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      console.error('[Agents] Multi-agent optimization failed:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      res.status(500).json({ 
        ok: false,
        error: 'Optimization failed', 
        message: error.message,
        code: 'OPTIMIZATION_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  });

  /**
   * Get optimization status
   */
  app.get('/api/agents/optimize/status', (req, res) => {
    try {
      const status = orchestrator.getStatus();
      res.json({
        ok: true,
        data: status,
        ...status,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error.message,
        code: 'STATUS_ERROR',
      });
    }
  });

  /**
   * Explain a scheduling decision
   */
  app.post('/api/agents/explain', async (req, res) => {
    try {
      // `slotId` is what the schedule model calls a shift; accept both spellings.
      const { scheduleState } = req.body || {};
      const shiftId = req.body?.shiftId || req.body?.slotId;

      if (!shiftId || !scheduleState) {
        return res.status(400).json({ 
          ok: false,
          error: 'shiftId (or slotId) and scheduleState are required',
          code: 'INVALID_PARAMETERS',
        });
      }

      const explanation = await orchestrator.explainDecision(shiftId, scheduleState);
      res.json({
        ok: true,
        data: explanation,
        ...explanation,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      console.error('Decision explanation failed:', error);
      res.status(500).json({ 
        ok: false,
        error: 'Explanation failed', 
        message: error.message,
        code: 'EXPLAIN_ERROR',
      });
    }
  });

  /**
   * Get agent results from last optimization
   */
  app.get('/api/agents/results/:agentName', (req, res) => {
    const { agentName } = req.params;
    const result = memory.get(`scheduling:agent:${agentName}:result`);
    
    if (!result) {
      return res.status(404).json({
        ok: false,
        error: `No results found for agent '${agentName}'`,
        code: 'NOT_FOUND',
      });
    }
    
    res.json({
      ok: true,
      data: result,
      ...result,
      meta: { timestamp: new Date().toISOString() },
    });
  });

  /**
   * Get all agent results
   */
  app.get('/api/agents/results', (req, res) => {
    const agents = ['coverage', 'fairness', 'preference', 'compliance', 'director'];
    const results = {};
    
    for (const agent of agents) {
      const result = memory.get(`scheduling:agent:${agent}:result`);
      if (result) {
        results[agent] = result;
      }
    }
    
    res.json({
      ok: true,
      data: results,
      ...results,
      meta: { timestamp: new Date().toISOString() },
    });
  });

  /**
   * Stream optimization progress via SSE
   */
  app.get('/api/agents/optimize/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write('retry: 3000\n\n');

    const sendEvent = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Subscribe to orchestrator events
    const onStart = (data) => sendEvent('optimization:start', data);
    const onAgentStart = (data) => sendEvent('agent:start', data);
    const onAgentComplete = (data) => sendEvent('agent:complete', data);
    const onComplete = (data) => {
      sendEvent('optimization:complete', data);
      res.end();
    };
    const onError = (error) => {
      sendEvent('optimization:error', { message: error.message });
      res.end();
    };

    orchestrator.on('optimization:start', onStart);
    orchestrator.on('agent:start', onAgentStart);
    orchestrator.on('agent:complete', onAgentComplete);
    orchestrator.on('optimization:complete', onComplete);
    orchestrator.on('optimization:error', onError);

    // Keepalive ping
    const keepalive = setInterval(() => {
      res.write(': ping\n\n');
    }, 25000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(keepalive);
      orchestrator.off('optimization:start', onStart);
      orchestrator.off('agent:start', onAgentStart);
      orchestrator.off('agent:complete', onAgentComplete);
      orchestrator.off('optimization:complete', onComplete);
      orchestrator.off('optimization:error', onError);
    });

    // Send initial status
    sendEvent('connected', { status: orchestrator.getStatus() });
  });

  console.log('[Agents] Routes registered');
}

export default registerAgentsRoutes;
