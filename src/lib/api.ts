/**
 * API Layer (Legacy Compatibility)
 * 
 * @deprecated Import from '@/lib/api' instead. This file is kept for backward compatibility.
 * 
 * The API layer has been refactored into modular files:
 * - api/client.ts - Base HTTP client
 * - api/providers.ts - Provider management
 * - api/shiftRequests.ts - Shift requests
 * - api/copilot.ts - AI assistant
 * - api/notifications.ts - Notifications
 * - api/scheduleState.ts - Schedule state
 */

// Re-export everything from the new modular API
export * from "./api/index";

// Explicit re-exports for backward compatibility
export {
  // Client
  requestJson,
  API_BASE,
  API_TIMEOUT_MS,
  
  // Providers
  registerProvider,
  
  // Shift Requests
  listShiftRequests,
  createShiftRequest,
  reviewShiftRequest,
  listEmailEvents,
  submitInboundEmail,
  
  // Copilot
  sendCopilotMessage,
  parseCopilotIntent,
  getCopilotSuggestions,
  getCopilotCapabilities,
  type CopilotChatResponse,
  type CopilotIntentResponse,
  type CopilotSuggestionsResponse,
  type CopilotCapabilitiesResponse,
  
  // Notifications
  sendNotification,
  listNotificationHistory,
  updateNotification,
  deleteNotification,
  
  // Schedule State
  saveScheduleState,
  loadScheduleState,
  optimizeWithSolver,
} from "./api/index";

// Types re-exported from central types
export type {
  ShiftRequest,
  ShiftRequestType,
  ShiftRequestStatus,
  EmailEvent,
  CopilotMessage,
  CopilotContext,
  CopilotConversation,
  NotificationRecord,
  NotificationSeverity,
} from "../types";
