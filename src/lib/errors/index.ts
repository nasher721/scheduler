export {
  ApiError,
  apiErrorFromResponse,
  parseApiErrorPayload,
  type ApiErrorPayload,
} from "./types";
export {
  buildClientErrorReport,
  buildIncidentId,
  consumeLastApiError,
  formatReportForClipboard,
  peekLastApiError,
  setLastApiError,
  type ClientErrorReport,
} from "./debugReport";
