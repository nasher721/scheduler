/**
 * Base Agent Class
 * Foundation for all scheduling domain agents
 */

import { callAIProvider } from './ai-adapter.js';

export class Agent {
  constructor(config) {
    this.name = config.name;
    this.role = config.role;
    this.systemPrompt = config.systemPrompt;
    this.tools = config.tools || [];
    this.model = config.model || 'gpt-4-turbo-preview';
    this.messageHistory = [];
  }

  async execute(input, context = {}) {
    const prompt = this.buildPrompt(input, context);
    
    try {
      const response = await callAIProvider({
        provider: 'openai',
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...this.messageHistory,
          { role: 'user', content: prompt }
        ],
        temperature: 0.3, // Lower temp for consistent structured output
      });

      const content = response.content;
      this.messageHistory.push({ role: 'user', content: prompt });
      this.messageHistory.push({ role: 'assistant', content });

      // Trim history to prevent context overflow
      if (this.messageHistory.length > 20) {
        this.messageHistory = this.messageHistory.slice(-20);
      }

      return {
        agentName: this.name,
        content,
        parsedContent: this.tryParseJson(content),
        completed: content.includes('[TASK_COMPLETE]') || content.includes('[FINAL_SCHEDULE_APPROVED]'),
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(`[Agent ${this.name}] Error:`, error);
      return {
        agentName: this.name,
        content: null,
        error: error.message,
        completed: false,
        timestamp: Date.now(),
      };
    }
  }

  buildPrompt(input, context) {
    let prompt = input;
    
    if (context.scheduleState) {
      prompt += `\n\nCurrent Schedule State:\n${JSON.stringify(context.scheduleState, null, 2)}`;
    }
    
    if (context.providers) {
      prompt += `\n\nProvider Information:\n${JSON.stringify(context.providers, null, 2)}`;
    }
    
    if (context.previousAgentOutput) {
      prompt += `\n\nInput from previous agent (${context.previousAgent}):\n${context.previousAgentOutput}`;
    }
    
    return prompt;
  }

  tryParseJson(content) {
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                        content.match(/```\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      
      // Try to find JSON object directly
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        return JSON.parse(content.slice(jsonStart, jsonEnd + 1));
      }
    } catch (e) {
      // Not valid JSON, return null
    }
    return null;
  }

  clearHistory() {
    this.messageHistory = [];
  }
}

export default Agent;
