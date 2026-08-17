import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveScheduleState } from "../lib/api/scheduleState";
import { optimizeWithSolver } from "../lib/api/scheduleState";
import { createShiftRequest } from "../lib/api/shiftRequests";
import { reviewShiftRequest } from "../lib/api/shiftRequests";
import { sendNotification } from "../lib/api/notifications";
import { updateNotification } from "../lib/api/notifications";
import { deleteNotification } from "../lib/api/notifications";
import { sendCopilotMessage } from "../lib/api/copilot";
import { parseCopilotIntent } from "../lib/api/copilot";
import { getCopilotSuggestions } from "../lib/api/copilot";
import { multiAgentOptimize } from "../lib/api/multiAgentOptimize";
import { applyOptimizationResult } from "../lib/api/multiAgentOptimize";
import { postShiftForCoverage } from "../lib/api/marketplace";
import { claimShift } from "../lib/api/marketplace";
import { approveShift } from "../lib/api/marketplace";
import { dispatchBroadcast } from "../lib/api/broadcast";
import { escalateBroadcast } from "../lib/api/broadcast";
import type { MultiAgentOptimizeResult } from "../lib/api/multiAgentOptimize";
import type {
  BroadcastChannel,
  CopilotContext,
  CopilotMessage,
} from "../types";

// ───────────────────────────────────────────────
// Schedule state & solver
// ───────────────────────────────────────────────

export function useSaveScheduleStateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveScheduleState,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
    },
  });
}

export function useOptimizeWithSolverMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: optimizeWithSolver,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      qc.invalidateQueries({ queryKey: ["ai", "applyHistory"] });
    },
  });
}

// ───────────────────────────────────────────────
// Shift requests
// ───────────────────────────────────────────────

export function useCreateShiftRequestMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createShiftRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shiftRequests"] });
    },
  });
}

export function useReviewShiftRequestMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      status,
      reviewedBy,
    }: {
      requestId: string;
      status: "approved" | "denied";
      reviewedBy: string;
    }) => reviewShiftRequest(requestId, { status, reviewedBy }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shiftRequests"] });
    },
  });
}

// ───────────────────────────────────────────────
// Notifications
// ───────────────────────────────────────────────

export function useSendNotificationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendNotification,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useUpdateNotificationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      updateNotification(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useDeleteNotificationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

// ───────────────────────────────────────────────
// Copilot
// ───────────────────────────────────────────────

export function useSendCopilotMessageMutation() {
  return useMutation({
    mutationFn: ({
      message,
      context,
      history,
    }: {
      message: string;
      context: CopilotContext;
      history?: CopilotMessage[];
    }) => sendCopilotMessage(message, context, history),
  });
}

export function useParseCopilotIntentMutation() {
  return useMutation({
    mutationFn: ({
      text,
      context,
    }: {
      text: string;
      context: CopilotContext;
    }) => parseCopilotIntent(text, context),
  });
}

export function useGetCopilotSuggestionsMutation() {
  return useMutation({
    mutationFn: ({ context }: { context: CopilotContext }) =>
      getCopilotSuggestions(context),
  });
}

// ───────────────────────────────────────────────
// Multi-agent optimization
// ───────────────────────────────────────────────

export function useMultiAgentOptimizeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: multiAgentOptimize,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      qc.invalidateQueries({ queryKey: ["ai", "applyHistory"] });
    },
  });
}

export function useApplyOptimizationResultMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      result,
      approvedBy,
    }: {
      result: MultiAgentOptimizeResult;
      approvedBy: string | null;
    }) => applyOptimizationResult(result, approvedBy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      qc.invalidateQueries({ queryKey: ["ai", "applyHistory"] });
    },
  });
}

// ───────────────────────────────────────────────
// Marketplace
// ───────────────────────────────────────────────

export function usePostShiftForCoverageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      slotId,
      postedByProviderId,
      notes,
    }: {
      slotId: string;
      postedByProviderId: string;
      notes?: string;
    }) => postShiftForCoverage(slotId, postedByProviderId, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketplace"] });
    },
  });
}

export function useClaimShiftMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      shiftId,
      providerId,
    }: {
      shiftId: string;
      providerId: string;
    }) => claimShift(shiftId, providerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketplace"] });
    },
  });
}

export function useApproveShiftMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      shiftId,
      approvedBy,
    }: {
      shiftId: string;
      approvedBy: string;
    }) => approveShift(shiftId, approvedBy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketplace"] });
    },
  });
}

// ───────────────────────────────────────────────
// Broadcast
// ───────────────────────────────────────────────

export function useDispatchBroadcastMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      shiftId,
      channel,
      eligibleProviderIds,
    }: {
      shiftId: string;
      channel: string;
      eligibleProviderIds: string[];
    }) => dispatchBroadcast(shiftId, channel as BroadcastChannel, eligibleProviderIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcast"] });
    },
  });
}

export function useEscalateBroadcastMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: escalateBroadcast,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcast"] });
    },
  });
}
