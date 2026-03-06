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
      const { scheduleState } = req.body;
      
      if (!scheduleState) {
        return res.status(400).json({ error: 'scheduleState is required' });
      }

      const result = await orchestrator.optimizeSchedule(scheduleState);
      res.json(result);
    } catch (error) {
      console.error('Multi-agent optimization failed:', error);
      res.status(500).json({ 
        error: 'Optimization failed', 
        message: error.message 
      });
    }
  });

  /**
   * Get optimization status
   */
  app.get('/api/agents/optimize/status', (req, res) => {
    const status = orchestrator.getStatus();
    res.json(status);
  });

  /**
   * Explain a scheduling decision
   */
  app.post('/api/agents/explain', async (req, res) => {
    try {
      const { shiftId, scheduleState } = req.body;
      
      if (!shiftId || !scheduleState) {
        return res.status(400).json({ 
          error: 'shiftId and scheduleState are required' 
        });
      }

      const explanation = await orchestrator.explainDecision(shiftId, scheduleState);
      res.json(explanation);
    } catch (error) {
      console.error('Decision explanation failed:', error);
      res.status(500).json({ 
        error: 'Explanation failed', 
        message: error.message 
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
      return res.status(404).json({ error: 'No results found for this agent' });
    }
    
    res.json(result);
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
    
    res.json(results);
  });

  /**
   * Stream optimization progress via SSE
   */
  app.get('/api/agents/optimize/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

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

    // Clean up on client disconnect
    req.on('close', () => {
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
