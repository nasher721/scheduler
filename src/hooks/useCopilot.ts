import { useState, useCallback, useEffect, useRef } from "react";
import { useScheduleStore } from "@/store";
import type { CopilotMessage } from "@/store";
import type { ShiftTypeFilter } from "@/store";
import type { Provider, ShiftSlot } from "@/types";
import {
  sendCopilotMessage,
  parseCopilotIntent,
  getCopilotSuggestions,
  type CopilotContext
} from "@/lib/api";

interface UseCopilotOptions {
  context: CopilotContext;
  onMessageReceived?: (message: CopilotMessage) => void;
  onError?: (error: Error) => void;
}

interface UseCopilotReturn {
  messages: CopilotMessage[];
  isLoading: boolean;
  isTyping: boolean;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  suggestions: string[];
  refreshSuggestions: () => Promise<void>;
}

interface CopilotAction {
  type: string;
  [key: string]: unknown;
}

type ScheduleStore = ReturnType<typeof useScheduleStore.getState>;

const SCHEDULABLE_SHIFT_TYPES = new Set(["DAY", "NIGHT", "NMET", "JEOPARDY", "RECOVERY", "CONSULTS", "VACATION"]);

function normalizeShiftType(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toUpperCase();
  if (normalized === "CONSULT") return "CONSULTS";
  return SCHEDULABLE_SHIFT_TYPES.has(normalized) ? normalized : null;
}

function resolveScenarioIdByName(name: string, items: { id: string; name: string }[]): string | null {
  const query = name.trim().toLowerCase();
  if (!query) return null;
  const exact = items.find((item) => item.name.trim().toLowerCase() === query);
  if (exact) return exact.id;
  const partial = items.find((item) => item.name.trim().toLowerCase().includes(query));
  return partial ? partial.id : null;
}

function resolveProviderIdByName(name: string, providers: Provider[]): string | null {
  const query = name.trim().toLowerCase();
  if (!query) return null;

  const exact = providers.find((provider) => provider.name.trim().toLowerCase() === query);
  if (exact) return exact.id;

  const simplifiedQuery = query.replace(/^dr\.?\s+/, "");
  const partial = providers.find((provider) => {
    const normalized = provider.name.trim().toLowerCase();
    return normalized.includes(query) || normalized.includes(simplifiedQuery);
  });

  return partial ? partial.id : null;
}

function coerceActions(rawActions: unknown[]): CopilotAction[] {
  return rawActions.filter((action): action is CopilotAction => Boolean(action) && typeof action === "object" && typeof (action as CopilotAction).type === "string");
}

function toBooleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function buildAutoAssignPreview(store: ScheduleStore) {
  const totalSlots = store.slots.length;
  const assignedBefore = store.slots.filter((slot) => Boolean(slot.providerId)).length;
  const unassigned = store.slots.filter((slot: ShiftSlot) => !slot.providerId);
  const suggestions = unassigned
    .map((slot: ShiftSlot, index: number) => {
      const candidate = store.providers.find((provider: Provider) => {
        const hasSkill = Array.isArray(provider.skills) ? provider.skills.includes(slot.requiredSkill) : false;
        const isOff = Array.isArray(provider.timeOffRequests)
          ? provider.timeOffRequests.some((request: { date: string }) => request?.date === slot.date)
          : false;
        return hasSkill && !isOff;
      });
      if (!candidate) return null;
      return {
        id: `copilot-suggest-${slot.id}-${index}`,
        type: "assign" as const,
        slotId: slot.id,
        fromProviderId: null,
        toProviderId: candidate.id,
        reason: `Fill ${slot.type} on ${slot.date} with ${candidate.name} (skill match: ${slot.requiredSkill}).`,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .slice(0, 25);

  const predictedAssigned = Math.min(totalSlots, assignedBefore + suggestions.length);
  const coverageBefore = totalSlots > 0 ? Math.round((assignedBefore / totalSlots) * 100) : 100;
  const coverageAfter = totalSlots > 0 ? Math.round((predictedAssigned / totalSlots) * 100) : 100;
  const objectiveBefore = Math.round(coverageBefore * 0.7);
  const objectiveAfter = Math.min(100, objectiveBefore + Math.round(suggestions.length * 1.5));

  const changePreview = {
    objectiveScore: objectiveAfter,
    objectiveScoreBefore: objectiveBefore,
    coverageScore: coverageAfter,
    fairnessScore: 70,
    fatigueScore: 75,
    changes: suggestions.map((suggestion) => ({
      id: suggestion.id,
      type: "assign" as const,
      slotId: suggestion.slotId,
      fromProviderId: suggestion.fromProviderId,
      toProviderId: suggestion.toProviderId,
      reason: suggestion.reason,
      impact: "positive" as const,
    })),
    warnings: suggestions.length === 0 ? ["No safe auto-assign candidates found from current context."] : [],
  };

  return { changePreview, suggestions };
}

function executeCopilotActions(params: {
  store: ScheduleStore;
  actions: unknown[];
  context: CopilotContext;
  requiresConfirmation: boolean;
}): number {
  const { store, actions, context, requiresConfirmation } = params;
  const parsedActions = coerceActions(actions);
  if (parsedActions.length === 0) return 0;

  if (requiresConfirmation) {
    const hasOptimizationAction = parsedActions.some((action) => action.type === "auto_assign" || action.type === "optimize_schedule");
    if (hasOptimizationAction) {
      const { changePreview, suggestions } = buildAutoAssignPreview(store);
      store.queueAISuggestions(changePreview, suggestions);
      store.showToast({
        type: "info",
        title: "Optimization Preview Ready",
        message: "Review the proposed schedule changes, then accept or reject them.",
      });
      return 0;
    }
    store.showToast({
      type: "info",
      title: "Confirmation Required",
      message: "Copilot generated an action preview. Confirm with a follow-up command to apply changes.",
    });
    return 0;
  }

  let executed = 0;
  let unsupportedActionCount = 0;
  let skippedActionCount = 0;
  for (const action of parsedActions) {
    const selectedDate = typeof action.date === "string" ? action.date : (context.selectedDate ?? store.selectedDate ?? null);
    const selectedShiftType = normalizeShiftType(action.shiftType);

    switch (action.type) {
      case "check_coverage":
      case "show_coverage": {
        if (selectedDate) {
          store.setSelectedDate(selectedDate);
        }
        if (selectedShiftType) {
          store.setShiftTypeFilter(selectedShiftType as ShiftTypeFilter);
        }
        executed += 1;
        break;
      }
      case "detect_conflicts": {
        store.detectConflicts();
        executed += 1;
        break;
      }
      case "resolve_conflicts": {
        store.detectConflicts();
        const currentConflicts = useScheduleStore.getState().conflicts;
        for (const conflict of currentConflicts.filter((entry) => entry.autoResolvable && !entry.resolvedAt)) {
          const autoAction = conflict.suggestedActions.find((candidate) => candidate.type === "AUTO_FIX");
          if (autoAction) {
            store.resolveConflict(conflict.id, autoAction.id);
          }
        }
        executed += 1;
        break;
      }
      case "auto_assign":
      case "optimize_schedule": {
        store.autoAssign();
        store.detectConflicts();
        executed += 1;
        break;
      }
      case "assign_shift":
      case "unassign_shift": {
        const slotIdFromAction = typeof action.slotId === "string" ? action.slotId : null;
        const providerName = typeof action.providerName === "string" ? action.providerName : null;
        const providerId =
          typeof action.providerId === "string"
            ? action.providerId
            : providerName
              ? resolveProviderIdByName(providerName, store.providers)
              : (context.selectedProviderId ?? store.selectedProviderId ?? null);
        const candidateSlots = store.slots.filter((slot: ShiftSlot) => {
          if (slotIdFromAction) return slot.id === slotIdFromAction;
          if (selectedDate && slot.date !== selectedDate) return false;
          if (selectedShiftType && slot.type !== selectedShiftType) return false;
          return true;
        });
        const targetSlot = candidateSlots.find((slot) => !slot.providerId) || candidateSlots[0] || null;
        if (!targetSlot) {
          skippedActionCount += 1;
          break;
        }
        if (action.type === "assign_shift") {
          if (!providerId) {
            skippedActionCount += 1;
            break;
          }
          store.assignShift(targetSlot.id, providerId);
        } else {
          store.assignShift(targetSlot.id, null);
        }
        store.detectConflicts();
        executed += 1;
        break;
      }
      case "save_scenario":
      case "create_scenario": {
        const scenarioName = typeof action.scenarioName === "string" && action.scenarioName.trim() ? action.scenarioName.trim() : `Scenario ${new Date().toLocaleDateString()}`;
        store.createScenario(scenarioName);
        executed += 1;
        break;
      }
      case "load_scenario":
      case "delete_scenario": {
        const scenarioId = typeof action.scenarioId === "string"
          ? action.scenarioId
          : (typeof action.scenarioName === "string" ? resolveScenarioIdByName(action.scenarioName, store.scenarios.map((s) => ({ id: s.id, name: s.name }))) : null);
        if (!scenarioId) {
          skippedActionCount += 1;
          break;
        }
        if (action.type === "load_scenario") {
          store.loadScenario(scenarioId);
        } else {
          store.deleteScenario(scenarioId);
        }
        executed += 1;
        break;
      }
      case "explain_assignments": {
        const providerId = typeof action.providerId === "string"
          ? action.providerId
          : (context.selectedProviderId ?? store.selectedProviderId ?? null);
        if (!providerId) {
          skippedActionCount += 1;
          break;
        }
        const provider = store.providers.find((entry: Provider) => entry.id === providerId);
        if (!provider) {
          skippedActionCount += 1;
          break;
        }
        const providerSlots = store.slots.filter((slot: ShiftSlot) => slot.providerId === providerId);
        const dayCount = providerSlots.filter((slot: ShiftSlot) => slot.type === "DAY").length;
        const nightCount = providerSlots.filter((slot: ShiftSlot) => slot.type === "NIGHT").length;
        store.showToast({
          type: "info",
          title: `Assignment Context: ${provider.name}`,
          message: `${providerSlots.length} total assignments (${dayCount} day, ${nightCount} night). Use Conflict Dashboard for constraint details.`,
        });
        executed += 1;
        break;
      }
      case "adjust_parameters": {
        const selectedDateValue = typeof action.date === "string" ? action.date : null;
        const selectedShift = normalizeShiftType(action.shiftType);
        const surfaceView = action.surfaceView === "week" || action.surfaceView === "month" ? action.surfaceView : null;
        const showConflictsOnly = toBooleanOrNull(action.showConflictsOnly);
        const showUnfilledOnly = toBooleanOrNull(action.showUnfilledOnly);

        if (selectedDateValue) {
          store.setSelectedDate(selectedDateValue);
        }
        if (selectedShift) {
          store.setShiftTypeFilter(selectedShift as ShiftTypeFilter);
        }
        if (surfaceView) {
          store.setScheduleSurfaceView(surfaceView);
        }
        if (showConflictsOnly !== null) {
          store.setShowConflictsOnly(showConflictsOnly);
        }
        if (showUnfilledOnly !== null) {
          store.setShowUnfilledOnly(showUnfilledOnly);
        }

        executed += 1;
        break;
      }
      default:
        unsupportedActionCount += 1;
        break;
    }
  }

  if (executed > 0) {
    store.showToast({
      type: "success",
      title: "Copilot Actions Applied",
      message: `${executed} action${executed === 1 ? "" : "s"} executed.`,
    });
  }
  if (skippedActionCount > 0) {
    store.showToast({
      type: "warning",
      title: "Some Copilot Actions Skipped",
      message: `${skippedActionCount} action${skippedActionCount === 1 ? "" : "s"} could not be applied due to missing context.`,
    });
  }
  if (unsupportedActionCount > 0) {
    store.showToast({
      type: "warning",
      title: "Unsupported Copilot Action",
      message: `${unsupportedActionCount} action type${unsupportedActionCount === 1 ? "" : "s"} are not implemented yet.`,
    });
  }
  return executed;
}

export function useCopilot(options: UseCopilotOptions): UseCopilotReturn {
  const store = useScheduleStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Use refs for callbacks to avoid dependency issues
  const optionsRef = useRef(options);
  const storeRef = useRef(store);
  
  // Keep refs up to date
  useEffect(() => {
    optionsRef.current = options;
    storeRef.current = store;
  });

  // Get current conversation messages from store
  const currentConversation = store.copilotConversations.find(
    c => c.id === store.currentConversationId
  );
  const messages = currentConversation?.messages || [];

  // Create conversation if none exists
  useEffect(() => {
    if (!store.currentConversationId) {
      store.createConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.currentConversationId]);

  const sendMessage = useCallback(async (content: string) => {
    const currentStore = storeRef.current;
    const currentOptions = optionsRef.current;
    
    if (!currentStore.currentConversationId) return;

    setIsLoading(true);
    setIsTyping(true);

    // Add user message to store
    const userMessage: CopilotMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    currentStore.addMessageToConversation(currentStore.currentConversationId, userMessage);

    try {
      const response = await sendCopilotMessage(
        content,
        currentOptions.context,
        currentStore.copilotConversations.find(c => c.id === currentStore.currentConversationId)?.messages || []
      );

      const assistantMessage: CopilotMessage = {
        id: response.result.messageId,
        role: "assistant",
        content: response.result.response,
        timestamp: response.updatedAt,
        intent: response.result.intent,
        confidence: response.result.confidence,
        suggestions: response.result.suggestions,
        requiresConfirmation: response.result.requiresConfirmation,
        actions: response.result.actions,
      };

      currentStore.addMessageToConversation(currentStore.currentConversationId, assistantMessage);
      setSuggestions(response.result.suggestions || []);
      executeCopilotActions({
        store: currentStore,
        actions: response.result.actions,
        context: currentOptions.context,
        requiresConfirmation: response.result.requiresConfirmation,
      });
      currentOptions.onMessageReceived?.(assistantMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      const assistantMessage: CopilotMessage = {
        id: `error_${Date.now()}`,
        role: "assistant",
        content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
        timestamp: new Date().toISOString(),
        suggestions: ["Try again", "Show help"],
      };

      currentStore.addMessageToConversation(currentStore.currentConversationId, assistantMessage);
      currentOptions.onError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  }, []); // No dependencies needed since we use refs

  const clearMessages = useCallback(() => {
    const currentStore = storeRef.current;
    if (currentStore.currentConversationId) {
      currentStore.deleteConversation(currentStore.currentConversationId);
      currentStore.createConversation();
    }
  }, []);

  const refreshSuggestions = useCallback(async () => {
    const currentOptions = optionsRef.current;
    try {
      const response = await getCopilotSuggestions(currentOptions.context);
      const recs = response.result.recommendations || [];
      setSuggestions(recs.map((r) => r.title));
    } catch (error) {
      console.error("Failed to refresh suggestions:", error);
    }
  }, []);

  return {
    messages,
    isLoading,
    isTyping,
    sendMessage,
    clearMessages,
    suggestions,
    refreshSuggestions,
  };
}

// Hook for parsing intent (useful for inline suggestions)
export function useCopilotIntent() {
  const [isParsing, setIsParsing] = useState(false);

  const parseIntent = useCallback(async (text: string, context: CopilotContext) => {
    setIsParsing(true);
    try {
      const result = await parseCopilotIntent(text, context);
      return result.result;
    } finally {
      setIsParsing(false);
    }
  }, []);

  return { parseIntent, isParsing };
}
