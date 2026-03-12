/**
 * API Layer
 * Centralized API exports for the application
 */

// Re-export all types from central types file
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
} from "../../types";

// Export API modules
export * from "./client";
export * from "./providers";
export * from "./shiftRequests";
export * from "./copilot";
export * from "./notifications";
export * from "./scheduleState";

// Keep backward compatibility with existing imports
export { registerProvider } from "./providers";
export {
  listShiftRequests,
  createShiftRequest,
  reviewShiftRequest,
  listEmailEvents,
  submitInboundEmail,
} from "./shiftRequests";
export {
  sendCopilotMessage,
  parseCopilotIntent,
  getCopilotSuggestions,
  getCopilotCapabilities,
} from "./copilot";
export {
  sendNotification,
  listNotificationHistory,
  updateNotification,
  deleteNotification,
} from "./notifications";
export {
  saveScheduleState,
  loadScheduleState,
  optimizeWithSolver,
} from "./scheduleState";
export {
  fetchApplyHistory,
  fetchApplyHistorySummary,
  type AiApplyRecord,
  type AiApplySummary,
} from "./aiApplyHistory";
export {
  multiAgentOptimize,
  applyOptimizationResult,
  buildOptimizationPreview,
  type MultiAgentOptimizeResult,
  type ApplyOptimizationResponse,
} from "./multiAgentOptimize";
export {
  fetchScheduleSummary,
  fetchScheduleScenarios,
  fetchLastOptimizationResult,
  fetchAgentTools,
  type ScheduleSummaryResponse,
  type ScheduleScenariosResponse,
  type LastOptimizationResultResponse,
  type AgentToolsResponse,
  type AgentToolDescriptor,
} from "./scheduleApi";
