/**
 * Natural Language Scheduling Assistant
 * Conversational interface for scheduling operations
 */

import { callAIProvider } from './ai-adapter.js';
import { getSharedMemoryService } from '../shared-memory-service.js';

/**
 * NLP Scheduling Assistant
 */
export class NLPAssistant {
  constructor(options = {}) {
    this.memory = getSharedMemoryService();
    this.model = options.model || 'gpt-4-turbo-preview';
    this.enableLogging = options.enableLogging || true;
    this.conversationHistory = new Map(); // userId -> messages
  }

  log(...args) {
    if (this.enableLogging) {
      console.log('[NLPAssistant]', ...args);
    }
  }

  /**
   * Process natural language input
   */
  async processInput(userId, input, context = {}) {
    this.log(`Processing input from ${userId}: "${input}"`);

    // Step 1: Classify intent
    const intent = await this.classifyIntent(input);
    this.log(`Classified intent: ${intent.type}`);

    // Step 2: Extract entities
    const entities = await this.extractEntities(input, intent);
    this.log(`Extracted entities:`, entities);

    // Step 3: Execute action based on intent
    const result = await this.executeAction(intent, entities, context);

    // Step 4: Generate natural language response
    const response = await this.generateResponse(intent, entities, result);

    // Store in conversation history
    this.addToHistory(userId, { role: 'user', content: input });
    this.addToHistory(userId, { role: 'assistant', content: response });

    return {
      intent: intent.type,
      entities,
      result,
      response,
      requiresConfirmation: result.requiresConfirmation || false,
      suggestedActions: result.suggestedActions || [],
    };
  }

  /**
   * Classify user intent
   */
  async classifyIntent(input) {
    const prompt = `Classify the intent of this scheduling-related input into one of these categories:
- FIND_PROVIDER: "Who can cover...", "Find someone for..."
- ASSIGN_SHIFT: "Assign... to...", "Put... on..."
- CHECK_SCHEDULE: "What's the schedule...", "Who's working..."
- REQUEST_SWAP: "Can I swap...", "Trade shifts with..."
- CHECK_AVAILABILITY: "Is... available...", "When is... free"
- GET_STATS: "How many shifts...", "What's the coverage..."
- REQUEST_TIME_OFF: "I need off...", "Request PTO..."
- EXPLAIN_DECISION: "Why did you assign...", "How did you decide..."
- GENERAL_HELP: "Help", "What can you do"

Input: "${input}"

Respond with JSON:
{
  "type": "INTENT_TYPE",
  "confidence": 0.95,
  "subtype": "optional_more_specific_category"
}`;

    try {
      const response = await callAIProvider({
        provider: 'openai',
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });

      const parsed = JSON.parse(this.extractJson(response.content));
      return parsed;
    } catch (error) {
      this.log('Intent classification failed:', error);
      return { type: 'GENERAL_HELP', confidence: 0.5 };
    }
  }

  /**
   * Extract entities from input
   */
  async extractEntities(input, intent) {
    const prompt = `Extract scheduling-related entities from this input:
"${input}"

Intent: ${intent.type}

Extract:
- dates (ISO format)
- provider names or IDs
- shift types (DAY, NIGHT, NMET, etc.)
- skills (stroke, trauma, pediatrics)
- time ranges
- reasons or notes

Respond with JSON:
{
  "dates": ["2024-03-15"],
  "providers": [{"name": "Dr. Smith", "id": "optional"}],
  "shiftTypes": ["DAY", "NIGHT"],
  "skills": ["stroke"],
  "timeRange": {"start": "2024-03-15", "end": "2024-03-20"},
  "notes": "additional context"
}`;

    try {
      const response = await callAIProvider({
        provider: 'openai',
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });

      const parsed = JSON.parse(this.extractJson(response.content));
      return parsed;
    } catch (error) {
      this.log('Entity extraction failed:', error);
      return {};
    }
  }

  /**
   * Execute action based on intent
   */
  async executeAction(intent, entities, context) {
    const scheduleState = context.scheduleState || this.memory.get('schedule:state');
    
    switch (intent.type) {
      case 'FIND_PROVIDER':
        return this.findProvider(entities, scheduleState);
        
      case 'ASSIGN_SHIFT':
        return this.assignShift(entities, scheduleState);
        
      case 'CHECK_SCHEDULE':
        return this.checkSchedule(entities, scheduleState);
        
      case 'REQUEST_SWAP':
        return this.requestSwap(entities, scheduleState, context.userId);
        
      case 'CHECK_AVAILABILITY':
        return this.checkAvailability(entities, scheduleState);
        
      case 'GET_STATS':
        return this.getStats(entities, scheduleState);
        
      case 'REQUEST_TIME_OFF':
        return this.requestTimeOff(entities, context.userId);
        
      case 'EXPLAIN_DECISION':
        return this.explainDecision(entities, scheduleState);
        
      case 'GENERAL_HELP':
      default:
        return this.getGeneralHelp();
    }
  }

  /**
   * Find provider for shift
   */
  findProvider(entities, scheduleState) {
    const { dates, shiftTypes, skills } = entities;
    const date = dates?.[0];
    const shiftType = shiftTypes?.[0] || 'DAY';
    const requiredSkills = skills || [];

    if (!date) {
      return {
        success: false,
        message: 'I need a date to find a provider. Which date are you asking about?',
      };
    }

    // Find available providers
    const available = this.findAvailableProviders(
      date,
      shiftType,
      requiredSkills,
      scheduleState
    );

    if (available.length === 0) {
      return {
        success: false,
        message: `No providers available for ${shiftType.toLowerCase()} shift on ${date} with ${requiredSkills.join(', ')} skills.`,
        alternatives: this.suggestAlternatives(date, shiftType, scheduleState),
      };
    }

    // Score and rank providers
    const ranked = this.rankProviders(available, date, shiftType, scheduleState);

    return {
      success: true,
      candidates: ranked.slice(0, 3),
      message: `Found ${ranked.length} available providers for ${date} ${shiftType.toLowerCase()} shift.`,
      topRecommendation: ranked[0],
    };
  }

  /**
   * Assign shift to provider
   */
  assignShift(entities, scheduleState) {
    const { providers, dates, shiftTypes } = entities;
    
    if (!providers?.[0] || !dates?.[0]) {
      return {
        success: false,
        message: 'I need both a provider and a date to make an assignment.',
      };
    }

    const providerName = providers[0].name;
    const date = dates[0];
    const shiftType = shiftTypes?.[0] || 'DAY';

    // Find provider ID
    const provider = scheduleState.providers.find(
      p => p.name.toLowerCase().includes(providerName.toLowerCase())
    );

    if (!provider) {
      return {
        success: false,
        message: `Could not find provider "${providerName}".`,
      };
    }

    // Check constraints
    const validation = this.validateAssignment(provider, date, shiftType, scheduleState);

    if (!validation.valid) {
      return {
        success: false,
        message: `Cannot assign ${provider.name} to ${date} ${shiftType.toLowerCase()}: ${validation.reason}`,
        conflicts: validation.conflicts,
      };
    }

    return {
      success: true,
      requiresConfirmation: true,
      action: {
        type: 'ASSIGN',
        providerId: provider.id,
        providerName: provider.name,
        date,
        shiftType,
      },
      message: `Ready to assign ${provider.name} to ${date} ${shiftType.toLowerCase()} shift. Confirm?`,
    };
  }

  /**
   * Check schedule for date/provider
   */
  checkSchedule(entities, scheduleState) {
    const { dates, providers } = entities;

    // Check specific provider's schedule
    if (providers?.[0]) {
      const providerName = providers[0].name;
      const provider = scheduleState.providers.find(
        p => p.name.toLowerCase().includes(providerName.toLowerCase())
      );

      if (!provider) {
        return { success: false, message: `Provider "${providerName}" not found.` };
      }

      const providerShifts = scheduleState.slots.filter(
        s => s.providerId === provider.id
      );

      return {
        success: true,
        provider: provider.name,
        shifts: providerShifts.map(s => ({
          date: s.date,
          type: s.type,
          isWeekend: s.isWeekendLayout,
        })),
        totalShifts: providerShifts.length,
        message: `${provider.name} has ${providerShifts.length} scheduled shifts.`,
      };
    }

    // Check date range
    if (dates?.[0]) {
      const date = dates[0];
      const dayShifts = scheduleState.slots.filter(s => s.date === date);

      return {
        success: true,
        date,
        shifts: dayShifts.map(s => ({
          type: s.type,
          provider: scheduleState.providers.find(p => p.id === s.providerId)?.name || 'Unassigned',
          status: s.providerId ? 'assigned' : 'open',
        })),
        message: `Schedule for ${date}: ${dayShifts.filter(s => s.providerId).length}/${dayShifts.length} shifts assigned.`,
      };
    }

    return {
      success: false,
      message: 'I need a date or provider name to check the schedule.',
    };
  }

  /**
   * Request shift swap
   */
  requestSwap(entities, scheduleState, requesterId) {
    const { providers, dates, shiftTypes } = entities;

    // This would create a shift request in the system
    return {
      success: true,
      requiresConfirmation: true,
      action: {
        type: 'SWAP_REQUEST',
        requesterId,
        targetProvider: providers?.[0]?.name,
        date: dates?.[0],
        shiftType: shiftTypes?.[0],
      },
      message: 'I\'ll create a swap request. Would you like me to proceed?',
    };
  }

  /**
   * Check provider availability
   */
  checkAvailability(entities, scheduleState) {
    const { providers, dates } = entities;
    
    if (!providers?.[0]) {
      return { success: false, message: 'Which provider\'s availability would you like to check?' };
    }

    const providerName = providers[0].name;
    const provider = scheduleState.providers.find(
      p => p.name.toLowerCase().includes(providerName.toLowerCase())
    );

    if (!provider) {
      return { success: false, message: `Provider "${providerName}" not found.` };
    }

    // Check for time-off requests
    const timeOff = provider.timeOffRequests || [];
    const upcomingTimeOff = timeOff.filter(t => new Date(t.date) >= new Date());

    // Check current assignments
    const assignments = scheduleState.slots.filter(s => s.providerId === provider.id);

    return {
      success: true,
      provider: provider.name,
      isAvailable: upcomingTimeOff.length === 0,
      upcomingTimeOff: upcomingTimeOff.map(t => t.date),
      currentAssignments: assignments.length,
      targetMet: {
        weekDays: assignments.filter(s => s.type === 'DAY' && !s.isWeekendLayout).length >= provider.targetWeekDays,
        weekendDays: assignments.filter(s => s.type === 'DAY' && s.isWeekendLayout).length >= provider.targetWeekendDays,
      },
      message: `${provider.name} has ${upcomingTimeOff.length} upcoming time-off requests and ${assignments.length} current assignments.`,
    };
  }

  /**
   * Get schedule statistics
   */
  getStats(entities, scheduleState) {
    const totalSlots = scheduleState.slots.length;
    const assignedSlots = scheduleState.slots.filter(s => s.providerId).length;
    const coveragePercent = Math.round((assignedSlots / totalSlots) * 100);

    const providerStats = scheduleState.providers.map(p => {
      const shifts = scheduleState.slots.filter(s => s.providerId === p.id);
      return {
        name: p.name,
        totalShifts: shifts.length,
        weekDays: shifts.filter(s => s.type === 'DAY' && !s.isWeekendLayout).length,
        weekendDays: shifts.filter(s => s.type === 'DAY' && s.isWeekendLayout).length,
        nights: shifts.filter(s => s.type === 'NIGHT').length,
      };
    });

    return {
      success: true,
      summary: {
        totalShifts: totalSlots,
        assignedShifts: assignedSlots,
        coveragePercent,
        openShifts: totalSlots - assignedSlots,
      },
      providerStats: providerStats.sort((a, b) => b.totalShifts - a.totalShifts),
      message: `Current coverage: ${coveragePercent}% (${assignedSlots}/${totalSlots} shifts assigned).`,
    };
  }

  /**
   * Request time off
   */
  requestTimeOff(entities, userId) {
    const { dates, notes } = entities;

    if (!dates?.length) {
      return { success: false, message: 'Which dates do you need off?' };
    }

    return {
      success: true,
      requiresConfirmation: true,
      action: {
        type: 'TIME_OFF_REQUEST',
        requesterId: userId,
        dates,
        notes: notes || '',
      },
      message: `Requesting time off for ${dates.length} day(s): ${dates.join(', ')}. Confirm?`,
    };
  }

  /**
   * Explain a scheduling decision
   */
  async explainDecision(entities, scheduleState) {
    // Would integrate with the multi-agent system
    return {
      success: true,
      message: 'Decision explanation would be provided here by querying the multi-agent system.',
    };
  }

  /**
   * Get general help
   */
  getGeneralHelp() {
    return {
      success: true,
      message: `I can help you with scheduling tasks. Try asking me things like:

• "Who can cover Friday night shift?"
• "Assign Dr. Smith to March 15 day shift"
• "What's the schedule for next week?"
• "Is Dr. Jones available on Tuesday?"
• "How many shifts does each person have?"
• "I need March 20-22 off"

What would you like to do?`,
    };
  }

  /**
   * Generate natural language response
   */
  async generateResponse(intent, entities, result) {
    // If already have a message from the action, use it
    if (result.message) {
      return result.message;
    }

    // Otherwise generate one
    const prompt = `Generate a natural, helpful response for this scheduling query:

Intent: ${intent.type}
Result: ${JSON.stringify(result)}

Respond conversationally as a scheduling assistant.`;

    try {
      const response = await callAIProvider({
        provider: 'openai',
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      return response.content;
    } catch (error) {
      return 'I\'m sorry, I couldn\'t process that request. Can you try rephrasing?';
    }
  }

  /**
   * Helper: Find available providers
   */
  findAvailableProviders(date, shiftType, requiredSkills, scheduleState) {
    return scheduleState.providers.filter(provider => {
      // Check if already assigned that day
      const alreadyAssigned = scheduleState.slots.some(
        s => s.date === date && s.providerId === provider.id
      );
      if (alreadyAssigned) return false;

      // Check time-off requests
      const hasTimeOff = provider.timeOffRequests?.some(
        t => t.date === date
      );
      if (hasTimeOff) return false;

      // Check skills
      if (requiredSkills.length > 0) {
        const hasSkills = requiredSkills.every(skill => 
          provider.skills?.includes(skill)
        );
        if (!hasSkills) return false;
      }

      return true;
    });
  }

  /**
   * Helper: Rank providers by suitability
   */
  rankProviders(providers, date, shiftType, scheduleState) {
    return providers.map(provider => {
      let score = 0;
      const reasons = [];

      // Prefer providers under their target
      const currentShifts = scheduleState.slots.filter(
        s => s.providerId === provider.id && s.type === shiftType
      ).length;
      
      const target = shiftType === 'NIGHT' 
        ? provider.targetWeekNights 
        : provider.targetWeekDays;
      
      if (currentShifts < target) {
        score += 10;
        reasons.push('Under target shifts');
      }

      // Prefer providers with relevant skills
      if (provider.skills?.length > 0) {
        score += provider.skills.length * 2;
        reasons.push(`Skills: ${provider.skills.join(', ')}`);
      }

      // Prefer those who haven't worked recently
      const lastShift = scheduleState.slots
        .filter(s => s.providerId === provider.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      
      if (!lastShift || new Date(date) - new Date(lastShift.date) > 2 * 24 * 60 * 60 * 1000) {
        score += 5;
        reasons.push('Well rested');
      }

      return {
        provider,
        score,
        reasons,
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Helper: Validate assignment constraints
   */
  validateAssignment(provider, date, shiftType, scheduleState) {
    const conflicts = [];

    // Check if already assigned
    const existingAssignment = scheduleState.slots.find(
      s => s.date === date && s.providerId === provider.id
    );
    if (existingAssignment) {
      conflicts.push(`Already assigned to ${existingAssignment.type} shift`);
    }

    // Check time off
    const hasTimeOff = provider.timeOffRequests?.some(t => t.date === date);
    if (hasTimeOff) {
      conflicts.push('Has approved time-off request');
    }

    // Check consecutive shifts
    const dayBefore = scheduleState.slots.filter(
      s => s.providerId === provider.id && 
      new Date(s.date) >= new Date(date) - 24 * 60 * 60 * 1000 &&
      new Date(s.date) < new Date(date)
    );
    
    if (dayBefore.length > 0) {
      conflicts.push('Worked previous day');
    }

    return {
      valid: conflicts.length === 0,
      conflicts,
      reason: conflicts.join('; '),
    };
  }

  /**
   * Helper: Suggest alternatives
   */
  suggestAlternatives(date, shiftType, scheduleState) {
    return [
      'Consider splitting the shift into shorter blocks',
      'Check if a provider from another unit can float',
      'Post as open shift for premium pay',
    ];
  }

  /**
   * Helper: Extract JSON from response
   */
  extractJson(content) {
    const match = content.match(/\{[\s\S]*\}/);
    return match ? match[0] : content;
  }

  /**
   * Add to conversation history
   */
  addToHistory(userId, message) {
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, []);
    }
    const history = this.conversationHistory.get(userId);
    history.push(message);
    // Keep last 20 messages
    if (history.length > 20) {
      history.shift();
    }
  }

  /**
   * Get conversation history
   */
  getHistory(userId) {
    return this.conversationHistory.get(userId) || [];
  }

  /**
   * Clear conversation history
   */
  clearHistory(userId) {
    this.conversationHistory.delete(userId);
  }
}

// Singleton
let assistant = null;
export function getNLPAssistant(options) {
  if (!assistant) {
    assistant = new NLPAssistant(options);
  }
  return assistant;
}

export default NLPAssistant;
