/**
 * AI Adapter
 * Bridges the agent system with the existing ai-orchestrator.js
 */

import { 
  buildRecommendations,
  optimizeSchedule,
  explainDecision,
} from '../../ai-orchestrator.js';

/**
 * Call AI provider with messages format (OpenAI-style)
 * This adapter converts to the existing ai-orchestrator format
 */
export async function callAIProvider({ provider, model, messages, temperature = 0.3 }) {
  // Convert messages to a prompt
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const userMessages = messages.filter(m => m.role === 'user');
  const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';
  
  // Build context from message history
  const context = {
    systemPrompt: systemMessage,
    conversationHistory: messages.filter(m => m.role !== 'system'),
    temperature,
    requestedModel: model,
    requestedProvider: provider,
  };

  try {
    // Use the existing orchestrator's recommendation builder
    const result = await buildRecommendations({
      state: context,
      prompt: lastUserMessage,
    });

    // Normalize the response
    return {
      content: result?.text || result?.recommendations || '',
      provider: result?.provider || provider,
      model: result?.model || model,
    };
  } catch (error) {
    console.error('[AI Adapter] Error calling provider:', error);
    
    // Return fallback response
    return {
      content: JSON.stringify({
        error: 'AI service unavailable',
        fallback: true,
        timestamp: Date.now(),
      }),
      provider: 'fallback',
      model: 'none',
    };
  }
}

/**
 * Direct task execution using existing orchestrator
 */
export async function executeAgentTask(task, payload) {
  try {
    switch (task) {
      case 'optimize':
        return await optimizeSchedule(payload);
      case 'explain':
        return await explainDecision(payload);
      case 'recommend':
        return await buildRecommendations(payload);
      default:
        // Generic fallback
        return await buildRecommendations({
          state: payload,
          prompt: task,
        });
    }
  } catch (error) {
    console.error('[AI Adapter] Task execution failed:', error);
    throw error;
  }
}

export default { callAIProvider, executeAgentTask };
