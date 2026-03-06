/**
 * Natural Language Query Processor
 * 
 * Processes user queries in natural language to extract scheduling intents
 * Examples:
 * - "Who's working next Friday?"
 * - "Show me Dr. Smith's schedule"
 * - "When is the next night shift?"
 * - "Who has the most shifts this month?"
 */

import type { Provider, ShiftSlot } from '@/types';

export type QueryIntent = 
  | 'FIND_PROVIDER_SCHEDULE'
  | 'FIND_DATE_SCHEDULE'
  | 'FIND_NEXT_SHIFT'
  | 'FIND_SHIFT_TYPE'
  | 'COUNT_SHIFTS'
  | 'CHECK_AVAILABILITY'
  | 'FIND_UNFILLED'
  | 'SHOW_STATISTICS'
  | 'COMPARE_PROVIDERS'
  | 'UNKNOWN';

export interface ParsedQuery {
  intent: QueryIntent;
  confidence: number;
  entities: {
    providerName?: string;
    providerId?: string;
    date?: string;
    dateRange?: { start: string; end: string };
    shiftType?: string;
    location?: string;
  };
  filters: {
    shiftTypes?: string[];
    dateRange?: { start: string; end: string };
    providers?: string[];
  };
  originalQuery: string;
}

export interface QueryResult {
  type: 'SCHEDULE' | 'LIST' | 'COUNT' | 'AVAILABILITY' | 'COMPARISON' | 'ERROR';
  data: unknown;
  summary: string;
  details?: string;
}

// Common date patterns
const DATE_PATTERNS = {
  today: /today|tonight/,
  tomorrow: /tomorrow/,
  yesterday: /yesterday/,
  nextWeek: /next week/,
  thisWeek: /this week/,
  nextMonth: /next month/,
  weekend: /weekend/,
  weekday: /weekday|week day/,
};

// Shift type patterns
const SHIFT_PATTERNS = {
  day: /day shift|daytime|days/,
  night: /night shift|nights|overnight/,
  nmet: /nmet|neuro met|airway/,
  consults: /consults|consultation/,
  jeopardy: /jeopardy|backup/,
};

/**
 * Parse natural language query
 */
export function parseQuery(query: string, providers: Provider[]): ParsedQuery {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Extract provider name
  const providerName = extractProviderName(normalizedQuery, providers);
  const providerId = providerName 
    ? providers.find(p => p.name.toLowerCase().includes(providerName.toLowerCase()))?.id 
    : undefined;

  // Extract date
  const date = extractDate(normalizedQuery);
  const dateRange = extractDateRange(normalizedQuery);

  // Extract shift type
  const shiftType = extractShiftType(normalizedQuery);

  // Determine intent
  const { intent, confidence } = determineIntent(normalizedQuery);

  return {
    intent,
    confidence,
    entities: {
      providerName,
      providerId,
      date,
      dateRange,
      shiftType,
    },
    filters: {
      shiftTypes: shiftType ? [shiftType] : undefined,
      dateRange,
      providers: providerId ? [providerId] : undefined,
    },
    originalQuery: query,
  };
}

/**
 * Execute parsed query against schedule data
 */
export function executeQuery(
  parsedQuery: ParsedQuery,
  providers: Provider[],
  slots: ShiftSlot[]
): QueryResult {
  const { intent, entities } = parsedQuery;

  switch (intent) {
    case 'FIND_PROVIDER_SCHEDULE':
      return findProviderSchedule(entities.providerId, providers, slots);
    
    case 'FIND_DATE_SCHEDULE':
      return findDateSchedule(entities.date || entities.dateRange, slots);
    
    case 'FIND_NEXT_SHIFT':
      return findNextShift(entities.providerId, entities.shiftType, slots);
    
    case 'FIND_SHIFT_TYPE':
      return findShiftType(entities.shiftType, entities.dateRange, slots);
    
    case 'COUNT_SHIFTS':
      return countShifts(entities.providerId, entities.dateRange, slots);
    
    case 'CHECK_AVAILABILITY':
      return checkAvailability(entities.providerId, entities.date, slots);
    
    case 'FIND_UNFILLED':
      return findUnfilledShifts(slots);
    
    case 'SHOW_STATISTICS':
      return showStatistics(providers, slots);
    
    case 'COMPARE_PROVIDERS':
      return compareProviders(providers, slots);
    
    default:
      return {
        type: 'ERROR',
        data: null,
        summary: "I didn't understand that query. Try asking about a provider's schedule or a specific date.",
      };
  }
}

/**
 * Extract provider name from query
 */
function extractProviderName(query: string, providers: Provider[]): string | undefined {
  // Look for "Dr. Name" or just "Name"
  const drMatch = query.match(/dr\.?\s+(\w+)/i);
  if (drMatch) {
    const name = drMatch[1];
    const provider = providers.find(p => 
      p.name.toLowerCase().includes(name.toLowerCase())
    );
    if (provider) return provider.name;
  }

  // Look for any provider name
  for (const provider of providers) {
    const lastName = provider.name.split(' ').pop()?.toLowerCase();
    if (lastName && query.includes(lastName)) {
      return provider.name;
    }
  }

  return undefined;
}

/**
 * Extract date from query
 */
function extractDate(query: string): string | undefined {
  const today = new Date();
  
  if (DATE_PATTERNS.today.test(query)) {
    return formatDate(today);
  }
  
  if (DATE_PATTERNS.tomorrow.test(query)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDate(tomorrow);
  }
  
  if (DATE_PATTERNS.yesterday.test(query)) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDate(yesterday);
  }

  // Look for specific date patterns
  const dateMatch = query.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1]) - 1;
    const day = parseInt(dateMatch[2]);
    const year = dateMatch[3] ? parseInt(dateMatch[3]) : today.getFullYear();
    const date = new Date(year, month, day);
    return formatDate(date);
  }

  // Look for day names
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    if (query.includes(days[i])) {
      const targetDate = new Date(today);
      const currentDay = today.getDay();
      const diff = i - currentDay;
      targetDate.setDate(today.getDate() + diff + (diff <= 0 ? 7 : 0));
      return formatDate(targetDate);
    }
  }

  return undefined;
}

/**
 * Extract date range from query
 */
function extractDateRange(query: string): { start: string; end: string } | undefined {
  const today = new Date();

  if (DATE_PATTERNS.thisWeek.test(query)) {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: formatDate(start), end: formatDate(end) };
  }

  if (DATE_PATTERNS.nextWeek.test(query)) {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() + 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: formatDate(start), end: formatDate(end) };
  }

  if (DATE_PATTERNS.nextMonth.test(query)) {
    const start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    return { start: formatDate(start), end: formatDate(end) };
  }

  return undefined;
}

/**
 * Extract shift type from query
 */
function extractShiftType(query: string): string | undefined {
  if (SHIFT_PATTERNS.day.test(query)) return 'DAY';
  if (SHIFT_PATTERNS.night.test(query)) return 'NIGHT';
  if (SHIFT_PATTERNS.nmet.test(query)) return 'NMET';
  if (SHIFT_PATTERNS.consults.test(query)) return 'CONSULTS';
  if (SHIFT_PATTERNS.jeopardy.test(query)) return 'JEOPARDY';
  return undefined;
}

/**
 * Determine query intent
 */
function determineIntent(query: string): { intent: QueryIntent; confidence: number } {
  // Find provider schedule
  if (/who('s| is)? (working|scheduled|on call)/.test(query) || 
      /show me.*schedule/.test(query) ||
      /when (is|does).*work/.test(query)) {
    return { intent: 'FIND_PROVIDER_SCHEDULE', confidence: 0.9 };
  }

  // Find date schedule
  if (/what('s| is)? (happening|scheduled|on)/.test(query) ||
      /who('s| is)? (on|working)/.test(query)) {
    return { intent: 'FIND_DATE_SCHEDULE', confidence: 0.85 };
  }

  // Find next shift
  if (/next (shift|night|day)/.test(query) ||
      /when is the next/.test(query)) {
    return { intent: 'FIND_NEXT_SHIFT', confidence: 0.9 };
  }

  // Count shifts
  if (/how many shifts/.test(query) ||
      /count.*shifts/.test(query) ||
      /shift count/.test(query)) {
    return { intent: 'COUNT_SHIFTS', confidence: 0.9 };
  }

  // Check availability
  if (/available/.test(query) ||
      /free/.test(query) ||
      /can.*work/.test(query)) {
    return { intent: 'CHECK_AVAILABILITY', confidence: 0.8 };
  }

  // Find unfilled
  if (/unfilled|empty|open|needs coverage/.test(query)) {
    return { intent: 'FIND_UNFILLED', confidence: 0.9 };
  }

  // Statistics
  if (/statistics|stats|metrics|coverage/.test(query)) {
    return { intent: 'SHOW_STATISTICS', confidence: 0.85 };
  }

  // Compare
  if (/compare|who has (more|less|most|least)/.test(query)) {
    return { intent: 'COMPARE_PROVIDERS', confidence: 0.85 };
  }

  return { intent: 'UNKNOWN', confidence: 0 };
}

// Query execution functions

function findProviderSchedule(
  providerId: string | undefined,
  providers: Provider[],
  slots: ShiftSlot[]
): QueryResult {
  if (!providerId) {
    return {
      type: 'ERROR',
      data: null,
      summary: 'Please specify a provider name.',
    };
  }

  const provider = providers.find(p => p.id === providerId);
  const providerSlots = slots.filter(s => s.providerId === providerId);

  return {
    type: 'SCHEDULE',
    data: providerSlots,
    summary: `${provider?.name || 'Provider'} has ${providerSlots.length} scheduled shifts.`,
    details: providerSlots.map(s => `${s.date}: ${s.type} at ${s.location}`).join('\n'),
  };
}

function findDateSchedule(
  date: string | { start: string; end: string } | undefined,
  slots: ShiftSlot[]
): QueryResult {
  if (!date) {
    return {
      type: 'ERROR',
      data: null,
      summary: 'Please specify a date.',
    };
  }

  let dateSlots: ShiftSlot[];
  
  if (typeof date === 'string') {
    dateSlots = slots.filter(s => s.date === date);
  } else {
    dateSlots = slots.filter(s => s.date >= date.start && s.date <= date.end);
  }

  const filled = dateSlots.filter(s => s.providerId);
  const unfilled = dateSlots.filter(s => !s.providerId);

  return {
    type: 'LIST',
    data: dateSlots,
    summary: `${filled.length} shifts filled, ${unfilled.length} unfilled.`,
  };
}

function findNextShift(
  providerId: string | undefined,
  shiftType: string | undefined,
  slots: ShiftSlot[]
): QueryResult {
  const today = formatDate(new Date());
  let futureSlots = slots.filter(s => s.date >= today);

  if (providerId) {
    futureSlots = futureSlots.filter(s => s.providerId === providerId);
  }

  if (shiftType) {
    futureSlots = futureSlots.filter(s => s.type === shiftType);
  }

  futureSlots.sort((a, b) => a.date.localeCompare(b.date));

  const nextShift = futureSlots[0];

  if (!nextShift) {
    return {
      type: 'ERROR',
      data: null,
      summary: 'No upcoming shifts found.',
    };
  }

  return {
    type: 'SCHEDULE',
    data: nextShift,
    summary: `Next ${shiftType || ''} shift is on ${nextShift.date} at ${nextShift.location}.`,
  };
}

function findShiftType(
  shiftType: string | undefined,
  dateRange: { start: string; end: string } | undefined,
  slots: ShiftSlot[]
): QueryResult {
  let filteredSlots = slots;

  if (shiftType) {
    filteredSlots = filteredSlots.filter(s => s.type === shiftType);
  }

  if (dateRange) {
    filteredSlots = filteredSlots.filter(s => 
      s.date >= dateRange.start && s.date <= dateRange.end
    );
  }

  return {
    type: 'LIST',
    data: filteredSlots,
    summary: `Found ${filteredSlots.length} ${shiftType || ''} shifts.`,
  };
}

function countShifts(
  providerId: string | undefined,
  dateRange: { start: string; end: string } | undefined,
  slots: ShiftSlot[]
): QueryResult {
  let filteredSlots = slots;

  if (providerId) {
    filteredSlots = filteredSlots.filter(s => s.providerId === providerId);
  }

  if (dateRange) {
    filteredSlots = filteredSlots.filter(s => 
      s.date >= dateRange.start && s.date <= dateRange.end
    );
  }

  const byType = filteredSlots.reduce((acc, slot) => {
    acc[slot.type] = (acc[slot.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    type: 'COUNT',
    data: { total: filteredSlots.length, byType },
    summary: `${filteredSlots.length} total shifts.`,
    details: Object.entries(byType).map(([type, count]) => `${type}: ${count}`).join(', '),
  };
}

function checkAvailability(
  providerId: string | undefined,
  date: string | undefined,
  slots: ShiftSlot[]
): QueryResult {
  if (!providerId || !date) {
    return {
      type: 'ERROR',
      data: null,
      summary: 'Please specify both provider and date.',
    };
  }

  const isWorking = slots.some(s => s.date === date && s.providerId === providerId);

  return {
    type: 'AVAILABILITY',
    data: { available: !isWorking },
    summary: isWorking ? 'Provider is scheduled that day.' : 'Provider is available.',
  };
}

function findUnfilledShifts(slots: ShiftSlot[]): QueryResult {
  const unfilled = slots.filter(s => !s.providerId);
  const criticalUnfilled = unfilled.filter(s => s.priority === 'CRITICAL');

  return {
    type: 'LIST',
    data: unfilled,
    summary: `${unfilled.length} unfilled shifts (${criticalUnfilled.length} critical).`,
    details: criticalUnfilled.map(s => `${s.date}: ${s.type} - ${s.location}`).join('\n'),
  };
}

function showStatistics(providers: Provider[], slots: ShiftSlot[]): QueryResult {
  const filled = slots.filter(s => s.providerId).length;
  const total = slots.length;
  const coverage = (filled / total * 100).toFixed(1);

  const shiftsPerProvider = providers.map(p => ({
    provider: p.name,
    count: slots.filter(s => s.providerId === p.id).length,
  })).sort((a, b) => b.count - a.count);

  return {
    type: 'COMPARISON',
    data: { coverage, shiftsPerProvider },
    summary: `Coverage: ${coverage}% (${filled}/${total} shifts filled)`,
  };
}

function compareProviders(providers: Provider[], slots: ShiftSlot[]): QueryResult {
  const stats = providers.map(p => {
    const providerSlots = slots.filter(s => s.providerId === p.id);
    return {
      provider: p.name,
      total: providerSlots.length,
      days: providerSlots.filter(s => s.type === 'DAY').length,
      nights: providerSlots.filter(s => s.type === 'NIGHT').length,
      weekends: providerSlots.filter(s => s.isWeekendLayout).length,
    };
  }).sort((a, b) => b.total - a.total);

  return {
    type: 'COMPARISON',
    data: stats,
    summary: `${stats[0]?.provider} has the most shifts (${stats[0]?.total}).`,
  };
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Hook for natural language queries
 */
export function useNaturalLanguageQuery(providers: Provider[], slots: ShiftSlot[]) {
  const ask = (query: string): QueryResult => {
    const parsed = parseQuery(query, providers);
    
    if (parsed.confidence < 0.5) {
      return {
        type: 'ERROR',
        data: null,
        summary: "I'm not sure what you're asking. Try:",
        details: "• 'Who's working Friday?'\n• 'Show me Dr. Smith's schedule'\n• 'How many night shifts next week?'",
      };
    }

    return executeQuery(parsed, providers, slots);
  };

  return { ask, parseQuery };
}

export default useNaturalLanguageQuery;
