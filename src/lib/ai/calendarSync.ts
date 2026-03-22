/**
 * Calendar Sync Utilities
 * 
 * Handles two-way sync with Google Calendar and Outlook
 * - Export shifts to personal calendars
 * - Import time-off requests from calendars
 * - Sync availability
 */

import type { Provider, ShiftSlot, TimeOffRequest } from '@/types';

export type CalendarProvider = 'google' | 'outlook' | 'apple';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  isAllDay?: boolean;
  recurrence?: string;
  attendees?: string[];
}

export interface CalendarSyncConfig {
  provider: CalendarProvider;
  syncDirection: 'export' | 'import' | 'bidirectional';
  autoSync: boolean;
  syncInterval: number; // minutes
  includeTypes: string[];
  excludeWeekends?: boolean;
  reminderMinutes?: number;
}

export interface SyncResult {
  success: boolean;
  exported: number;
  imported: number;
  conflicts: SyncConflict[];
  errors: string[];
  timestamp: string;
}

export interface SyncConflict {
  type: 'DUPLICATE' | 'MODIFIED' | 'DELETED';
  localEvent?: CalendarEvent;
  remoteEvent?: CalendarEvent;
  resolution?: 'KEEP_LOCAL' | 'KEEP_REMOTE' | 'MERGE';
}

export interface CalendarAuth {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope: string[];
}

// Google Calendar API endpoints
const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3';
// Microsoft Graph API endpoints
const MICROSOFT_API_BASE = 'https://graph.microsoft.com/v1.0';

/**
 * Generate ICS file content for manual calendar import
 */
export function generateICS(
  slots: ShiftSlot[],
  provider: Provider,
  options: {
    includeDescription?: boolean;
    alarm?: boolean;
  } = {}
): string {
  const { includeDescription = true, alarm = true } = options;
  
  const events = slots
    .filter(s => s.providerId === provider.id)
    .map(slot => slotToICSEvent(slot, provider, includeDescription, alarm));

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Neuro ICU Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Neuro ICU Schedule',
    'X-WR-TIMEZONE:America/New_York',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Convert shift slot to ICS event format
 */
function slotToICSEvent(
  slot: ShiftSlot,
  provider: Provider,
  includeDescription: boolean,
  alarm: boolean
): string {
  const uid = `${slot.id}@nicuscheduler.local`;
  const dtstart = formatICSDate(slot.date, slot.type === 'NIGHT' ? 19 : 7); // 7pm or 7am
  const dtend = formatICSDate(slot.date, slot.type === 'NIGHT' ? 7 : 19);   // 12 hours later
  
  const summary = `${slot.type} Shift - ${slot.location}`;
  const description = includeDescription 
    ? `Provider: ${provider.name}\\nLocation: ${slot.location}\\nType: ${slot.type}\\n${slot.notes || ''}`
    : '';

  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART;TZID=America/New_York:${dtstart}`,
    `DTEND;TZID=America/New_York:${dtend}`,
    `SUMMARY:${escapeICS(summary)}`,
  ];

  if (description) {
    lines.push(`DESCRIPTION:${escapeICS(description)}`);
  }

  if (slot.location) {
    lines.push(`LOCATION:${escapeICS(slot.location)}`);
  }

  lines.push('DTSTAMP:' + formatICSDateNow());
  lines.push('CREATED:' + formatICSDateNow());
  lines.push('LAST-MODIFIED:' + formatICSDateNow());

  if (alarm) {
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push('DESCRIPTION:Reminder');
    lines.push('TRIGGER:-PT24H'); // 24 hours before
    lines.push('END:VALARM');
  }

  lines.push('END:VEVENT');

  return lines.join('\r\n');
}

/**
 * Export schedule to Google Calendar
 */
export async function exportToGoogleCalendar(
  slots: ShiftSlot[],
  provider: Provider,
  auth: CalendarAuth,
  config: CalendarSyncConfig
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    exported: 0,
    imported: 0,
    conflicts: [],
    errors: [],
    timestamp: new Date().toISOString(),
  };

  try {
    const providerSlots = slots.filter(s => s.providerId === provider.id);

    for (const slot of providerSlots) {
      const event = createGoogleEvent(slot, provider, config);
      
      try {
        const response = await fetch(
          `${GOOGLE_API_BASE}/calendars/primary/events`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${auth.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          }
        );

        if (response.ok) {
          result.exported++;
        } else {
          const error = await response.json();
          result.errors.push(`Failed to export ${slot.id}: ${error.message}`);
        }
      } catch (err) {
        result.errors.push(`Network error for ${slot.id}: ${err}`);
      }
    }

    result.success = result.errors.length === 0;
  } catch (err) {
    result.success = false;
    result.errors.push(`Export failed: ${err}`);
  }

  return result;
}

/**
 * Export schedule to Outlook Calendar
 */
export async function exportToOutlookCalendar(
  slots: ShiftSlot[],
  provider: Provider,
  auth: CalendarAuth,
  config: CalendarSyncConfig
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    exported: 0,
    imported: 0,
    conflicts: [],
    errors: [],
    timestamp: new Date().toISOString(),
  };

  try {
    const providerSlots = slots.filter(s => s.providerId === provider.id);

    for (const slot of providerSlots) {
      const event = createOutlookEvent(slot, provider, config);
      
      try {
        const response = await fetch(
          `${MICROSOFT_API_BASE}/me/events`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${auth.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          }
        );

        if (response.ok) {
          result.exported++;
        } else {
          const error = await response.json();
          result.errors.push(`Failed to export ${slot.id}: ${error.message}`);
        }
      } catch (err) {
        result.errors.push(`Network error for ${slot.id}: ${err}`);
      }
    }

    result.success = result.errors.length === 0;
  } catch (err) {
    result.success = false;
    result.errors.push(`Export failed: ${err}`);
  }

  return result;
}

/**
 * Import time-off from external calendar
 */
export async function importTimeOffFromCalendar(
  _providerId: string,
  auth: CalendarAuth,
  calendarProvider: CalendarProvider,
  dateRange: { start: string; end: string }
): Promise<TimeOffRequest[]> {
  const timeOffRequests: TimeOffRequest[] = [];

  try {
    const events = await fetchCalendarEvents(auth, calendarProvider, dateRange);

    for (const event of events) {
      // Look for time-off indicators in event title/description
      if (isTimeOffEvent(event)) {
        timeOffRequests.push({
          date: formatDate(event.start),
          type: categorizeTimeOff(event),
        });
      }
    }
  } catch (err) {
    console.error('Failed to import time-off:', err);
  }

  return timeOffRequests;
}

/**
 * Create calendar subscription URL (ICS feed)
 */
export function createCalendarFeedUrl(
  providerId: string,
  baseUrl: string
): string {
  // In production, this would be a signed URL with token
  return `${baseUrl}/api/calendar/${providerId}/feed.ics`;
}

/**
 * Create Google Calendar event object
 */
function createGoogleEvent(
  slot: ShiftSlot,
  provider: Provider,
  config: CalendarSyncConfig
): object {
  const startHour = slot.type === 'NIGHT' ? 19 : 7;
  const endHour = slot.type === 'NIGHT' ? 7 : 19;
  
  const startDateTime = new Date(slot.date);
  startDateTime.setHours(startHour, 0, 0);
  
  const endDateTime = new Date(slot.date);
  endDateTime.setHours(endHour, 0, 0);

  // Handle night shift crossing midnight
  if (slot.type === 'NIGHT') {
    endDateTime.setDate(endDateTime.getDate() + 1);
  }

  return {
    summary: `${slot.type} Shift - ${slot.location}`,
    location: slot.location,
    description: `Provider: ${provider.name}\nShift Type: ${slot.type}\n${slot.notes || ''}`,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: 'America/New_York',
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: 'America/New_York',
    },
    reminders: config.reminderMinutes ? {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: config.reminderMinutes },
      ],
    } : undefined,
    extendedProperties: {
      private: {
        nicuSchedulerId: slot.id,
        providerId: provider.id,
      },
    },
  };
}

/**
 * Create Outlook event object
 */
function createOutlookEvent(
  slot: ShiftSlot,
  provider: Provider,
  config: CalendarSyncConfig
): object {
  const startHour = slot.type === 'NIGHT' ? 19 : 7;
  const endHour = slot.type === 'NIGHT' ? 7 : 19;
  
  const startDateTime = new Date(slot.date);
  startDateTime.setHours(startHour, 0, 0);
  
  const endDateTime = new Date(slot.date);
  endDateTime.setHours(endHour, 0, 0);

  if (slot.type === 'NIGHT') {
    endDateTime.setDate(endDateTime.getDate() + 1);
  }

  return {
    subject: `${slot.type} Shift - ${slot.location}`,
    location: {
      displayName: slot.location,
    },
    body: {
      contentType: 'text',
      content: `Provider: ${provider.name}\nShift Type: ${slot.type}\n${slot.notes || ''}`,
    },
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: 'Eastern Standard Time',
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: 'Eastern Standard Time',
    },
    isReminderOn: !!config.reminderMinutes,
    reminderMinutesBeforeStart: config.reminderMinutes || 0,
    categories: ['Neuro ICU Schedule'],
    singleValueExtendedProperties: [
      {
        id: 'String {nicu-scheduler} Name nicuSchedulerId',
        value: slot.id,
      },
    ],
  };
}

/**
 * Fetch events from calendar API
 */
async function fetchCalendarEvents(
  auth: CalendarAuth,
  provider: CalendarProvider,
  dateRange: { start: string; end: string }
): Promise<CalendarEvent[]> {
  const baseUrl = provider === 'google' 
    ? `${GOOGLE_API_BASE}/calendars/primary/events`
    : `${MICROSOFT_API_BASE}/me/calendarview`;

  const url = new URL(baseUrl);
  
  if (provider === 'google') {
    url.searchParams.set('timeMin', new Date(dateRange.start).toISOString());
    url.searchParams.set('timeMax', new Date(dateRange.end).toISOString());
    url.searchParams.set('singleEvents', 'true');
  } else {
    url.searchParams.set('startDateTime', new Date(dateRange.start).toISOString());
    url.searchParams.set('endDateTime', new Date(dateRange.end).toISOString());
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${auth.accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Normalize response format
  const events = provider === 'google' ? data.items : data.value;
  
  return events.map((e: unknown) => normalizeEvent(e, provider));
}

/**
 * Normalize calendar event from different providers
 */
function normalizeEvent(event: any, provider: CalendarProvider): CalendarEvent {
  if (provider === 'google') {
    return {
      id: event.id,
      title: event.summary || '',
      description: event.description,
      start: new Date(event.start?.dateTime || event.start?.date),
      end: new Date(event.end?.dateTime || event.end?.date),
      location: event.location,
      isAllDay: !event.start?.dateTime,
    };
  } else {
    return {
      id: event.id,
      title: event.subject || '',
      description: event.body?.content,
      start: new Date(event.start?.dateTime),
      end: new Date(event.end?.dateTime),
      location: event.location?.displayName,
      isAllDay: event.isAllDay,
    };
  }
}

/**
 * Check if event indicates time-off
 */
function isTimeOffEvent(event: CalendarEvent): boolean {
  const timeOffKeywords = [
    'pto', 'vacation', 'time off', 'sick', 'leave', 
    'out of office', 'ooo', 'cme', 'conference',
    'unavailable', 'busy', 'blocked'
  ];
  
  const text = `${event.title} ${event.description || ''}`.toLowerCase();
  return timeOffKeywords.some(keyword => text.includes(keyword));
}

/**
 * Categorize time-off type
 */
function categorizeTimeOff(event: CalendarEvent): 'PTO' | 'CME' | 'SICK' | 'UNAVAILABLE' {
  const text = `${event.title} ${event.description || ''}`.toLowerCase();
  
  if (text.includes('sick')) return 'SICK';
  if (text.includes('cme') || text.includes('conference')) return 'CME';
  if (text.includes('pto') || text.includes('vacation')) return 'PTO';
  return 'UNAVAILABLE';
}

// Helper functions

function formatICSDate(dateStr: string, hour: number): string {
  const date = new Date(dateStr);
  date.setHours(hour, 0, 0);
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function formatICSDateNow(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeICS(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Hook for calendar sync
 */
export function useCalendarSync() {
  const downloadICS = (slots: ShiftSlot[], provider: Provider, filename?: string) => {
    const icsContent = generateICS(slots, provider);
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `${provider.name.replace(/\s+/g, '_')}_schedule.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  const getFeedUrl = (providerId: string) => {
    const baseUrl = window.location.origin;
    return createCalendarFeedUrl(providerId, baseUrl);
  };

  return {
    downloadICS,
    getFeedUrl,
    exportToGoogleCalendar,
    exportToOutlookCalendar,
    importTimeOffFromCalendar,
  };
}

export default useCalendarSync;
