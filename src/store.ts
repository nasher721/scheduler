import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";

export type ShiftType = "DAY" | "NIGHT" | "NMET" | "JEOPARDY";

export interface Provider {
  id: string;
  name: string;
  targetWeekDays: number;
  targetWeekendDays: number;
  targetWeekNights: number;
  targetWeekendNights: number;
  unavailableDates: string[];
  preferredDates: string[];
  skills: string[];
  maxConsecutiveNights: number;
  minDaysOffAfterNight: number;
}

export interface ShiftSlot {
  id: string;
  date: string;
  type: ShiftType;
  providerId: string | null;
  isWeekendLayout: boolean;
  requiredSkill: string;
  priority: "CRITICAL" | "STANDARD";
}

export interface ProviderCounts {
  weekDays: number;
  weekendDays: number;
  weekNights: number;
  weekendNights: number;
}

export interface ScenarioSnapshot {
  id: string;
  name: string;
  createdAt: string;
  providers: Provider[];
  slots: ShiftSlot[];
  startDate: string;
  numWeeks: number;
}

export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
}

interface HistoryState {
  providers: Provider[];
  slots: ShiftSlot[];
  startDate: string;
  numWeeks: number;
}

interface ScheduleState {
  providers: Provider[];
  startDate: string;
  numWeeks: number;
  slots: ShiftSlot[];
  scenarios: ScenarioSnapshot[];
  lastActionMessage: string | null;
  toasts: Toast[];
  history: HistoryState[];
  historyIndex: number;
  addProvider: (provider: Omit<Provider, "id">) => void;
  updateProvider: (id: string, provider: Partial<Provider>) => void;
  removeProvider: (id: string) => void;
  setScheduleRange: (startDate: string, numWeeks: number) => void;
  assignShift: (slotId: string, providerId: string | null) => void;
  autoAssign: () => void;
  clearAssignments: () => void;
  createScenario: (name: string) => void;
  loadScenario: (id: string) => void;
  deleteScenario: (id: string) => void;
  clearMessage: () => void;
  showToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const getWeekStart = () => format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
const baseProviders: Provider[] = [
  { id: "1", name: "Dr. Adams", targetWeekDays: 10, targetWeekendDays: 4, targetWeekNights: 3, targetWeekendNights: 2, unavailableDates: [], preferredDates: [], skills: ["NEURO_CRITICAL", "AIRWAY", "STROKE"], maxConsecutiveNights: 2, minDaysOffAfterNight: 1 },
  { id: "2", name: "Dr. Baker", targetWeekDays: 10, targetWeekendDays: 4, targetWeekNights: 3, targetWeekendNights: 2, unavailableDates: [], preferredDates: [], skills: ["NEURO_CRITICAL", "EEG", "NIGHT_FLOAT"], maxConsecutiveNights: 3, minDaysOffAfterNight: 1 },
  { id: "3", name: "Dr. Clark", targetWeekDays: 10, targetWeekendDays: 4, targetWeekNights: 3, targetWeekendNights: 2, unavailableDates: [], preferredDates: [], skills: ["NEURO_CRITICAL", "ECMO", "STROKE"], maxConsecutiveNights: 2, minDaysOffAfterNight: 2 },
];

const shiftRequirements: Record<ShiftType, { skill: string; priority: "CRITICAL" | "STANDARD" }> = {
  DAY: { skill: "NEURO_CRITICAL", priority: "CRITICAL" },
  NIGHT: { skill: "NIGHT_FLOAT", priority: "CRITICAL" },
  NMET: { skill: "AIRWAY", priority: "STANDARD" },
  JEOPARDY: { skill: "STROKE", priority: "STANDARD" },
};

const generateInitialSlots = (startDateStr: string, numWeeks: number): ShiftSlot[] => {
  const slots: ShiftSlot[] = [];
  const start = startOfWeek(parseISO(startDateStr), { weekStartsOn: 1 });

  for (let dayOffset = 0; dayOffset < numWeeks * 7; dayOffset += 1) {
    const currentDate = addDays(start, dayOffset);
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const dayOfWeek = currentDate.getDay();

    const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
    const isWeekendNight = dayOfWeek === 0 || dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6;

    const numDayShifts = isWeekendDay ? 2 : 3;
    for (let i = 0; i < numDayShifts; i += 1) {
      slots.push({
        id: `${dateStr}-DAY-${i}`,
        date: dateStr,
        type: "DAY",
        providerId: null,
        isWeekendLayout: isWeekendDay,
        requiredSkill: shiftRequirements.DAY.skill,
        priority: shiftRequirements.DAY.priority,
      });
    }

    slots.push({ id: `${dateStr}-NIGHT-0`, date: dateStr, type: "NIGHT", providerId: null, isWeekendLayout: isWeekendNight, requiredSkill: shiftRequirements.NIGHT.skill, priority: shiftRequirements.NIGHT.priority });
    slots.push({ id: `${dateStr}-NMET-0`, date: dateStr, type: "NMET", providerId: null, isWeekendLayout: isWeekendDay, requiredSkill: shiftRequirements.NMET.skill, priority: shiftRequirements.NMET.priority });
    slots.push({ id: `${dateStr}-JEOPARDY-0`, date: dateStr, type: "JEOPARDY", providerId: null, isWeekendLayout: isWeekendDay, requiredSkill: shiftRequirements.JEOPARDY.skill, priority: shiftRequirements.JEOPARDY.priority });
  }

  return slots;
};

export const getProviderCounts = (slots: ShiftSlot[], providers: Provider[]) => {
  const counts: Record<string, ProviderCounts> = {};
  providers.forEach((p) => {
    counts[p.id] = { weekDays: 0, weekendDays: 0, weekNights: 0, weekendNights: 0 };
  });

  slots.forEach((s) => {
    if (!s.providerId || !counts[s.providerId]) return;
    if (s.type === "DAY") {
      if (s.isWeekendLayout) counts[s.providerId].weekendDays += 1;
      else counts[s.providerId].weekDays += 1;
    } else if (s.type === "NIGHT") {
      if (s.isWeekendLayout) counts[s.providerId].weekendNights += 1;
      else counts[s.providerId].weekNights += 1;
    }
  });

  return counts;
};

const getConsecutiveNights = (slots: ShiftSlot[], providerId: string, targetDate: string) => {
  const nights = slots
    .filter((s) => s.providerId === providerId && s.type === "NIGHT")
    .map((s) => s.date)
    .sort();

  let consecutive = 0;
  let cursorDate = parseISO(targetDate);
  while (nights.includes(format(cursorDate, "yyyy-MM-dd"))) {
    consecutive += 1;
    cursorDate = addDays(cursorDate, -1);
  }
  return consecutive;
};

const violatesPostNightRecovery = (slots: ShiftSlot[], providerId: string, slot: ShiftSlot, provider: Provider) => {
  if (slot.type === "NIGHT") return false;

  const nightDates = slots
    .filter((s) => s.providerId === providerId && s.type === "NIGHT")
    .map((s) => s.date);

  return nightDates.some((nightDate) => {
    const diff = differenceInCalendarDays(parseISO(slot.date), parseISO(nightDate));
    return diff > 0 && diff <= provider.minDaysOffAfterNight;
  });
};

const canAssignProvider = (slots: ShiftSlot[], provider: Provider | undefined, slot: ShiftSlot, currentSlotId?: string) => {
  if (!provider) return false;
  if (provider.unavailableDates.includes(slot.date)) return false;
  if (!provider.skills.includes(slot.requiredSkill)) return false;

  const alreadyWorkingDate = slots.some(
    (s) => s.id !== currentSlotId && s.date === slot.date && s.providerId === provider.id,
  );
  if (alreadyWorkingDate) return false;

  if (slot.type === "NIGHT") {
    const projectedNights = getConsecutiveNights(slots, provider.id, slot.date) + 1;
    if (projectedNights > provider.maxConsecutiveNights) return false;
  }

  if (violatesPostNightRecovery(slots, provider.id, slot, provider)) return false;
  return true;
};

const computeDeficitScore = (slot: ShiftSlot, provider: Provider, count: ProviderCounts) => {
  const preferenceBoost = provider.preferredDates.includes(slot.date) ? 2 : 0;
  const criticalBoost = slot.priority === "CRITICAL" ? 1.5 : 0;

  if (slot.type === "DAY") {
    const target = slot.isWeekendLayout ? provider.targetWeekendDays : provider.targetWeekDays;
    const current = slot.isWeekendLayout ? count.weekendDays : count.weekDays;
    return target - current + preferenceBoost + criticalBoost;
  }

  if (slot.type === "NIGHT") {
    const target = slot.isWeekendLayout ? provider.targetWeekendNights : provider.targetWeekNights;
    const current = slot.isWeekendLayout ? count.weekendNights : count.weekNights;
    return target - current + preferenceBoost + criticalBoost;
  }

  return (provider.targetWeekDays + provider.targetWeekendDays + provider.targetWeekNights + provider.targetWeekendNights)
    - (count.weekDays + count.weekendDays + count.weekNights + count.weekendNights)
    + preferenceBoost;
};

const initialStart = getWeekStart();
const MAX_HISTORY = 50;

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      providers: baseProviders,
      startDate: initialStart,
      numWeeks: 4,
      slots: generateInitialSlots(initialStart, 4),
      scenarios: [],
      lastActionMessage: null,
      toasts: [],
      history: [],
      historyIndex: -1,

      addProvider: (provider) => {
        const state = get();
        const historyState: HistoryState = {
          providers: state.providers,
          slots: state.slots,
          startDate: state.startDate,
          numWeeks: state.numWeeks,
        };
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyState].slice(-MAX_HISTORY);
        
        set({
          providers: [...state.providers, { ...provider, id: crypto.randomUUID() }],
          history: newHistory,
          historyIndex: newHistory.length - 1,
          lastActionMessage: `Added ${provider.name} to roster.`,
        });
        
        get().showToast({ type: "success", title: "Provider Added", message: `${provider.name} has been added to the roster.` });
      },

      updateProvider: (id, updates) => {
        set((state) => ({
          providers: state.providers.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        }));
      },

      removeProvider: (id) => {
        const state = get();
        const provider = state.providers.find(p => p.id === id);
        const historyState: HistoryState = {
          providers: state.providers,
          slots: state.slots,
          startDate: state.startDate,
          numWeeks: state.numWeeks,
        };
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyState].slice(-MAX_HISTORY);
        
        set({
          providers: state.providers.filter((p) => p.id !== id),
          slots: state.slots.map((s) => (s.providerId === id ? { ...s, providerId: null } : s)),
          history: newHistory,
          historyIndex: newHistory.length - 1,
          lastActionMessage: "Provider removed and related assignments cleared.",
        });
        
        get().showToast({ type: "info", title: "Provider Removed", message: provider ? `${provider.name} has been removed.` : undefined });
      },

      setScheduleRange: (startDate, numWeeks) => {
        set(() => ({
          startDate,
          numWeeks,
          slots: generateInitialSlots(startDate, numWeeks),
          lastActionMessage: "Schedule window updated.",
        }));
        
        get().showToast({ type: "info", title: "Schedule Updated", message: `Now viewing ${numWeeks} week${numWeeks > 1 ? 's' : ''} starting ${startDate}.` });
      },

      assignShift: (slotId, providerId) => {
        const state = get();
        const slot = state.slots.find((s) => s.id === slotId);
        if (!slot) return;

        if (providerId === null) {
          const historyState: HistoryState = {
            providers: state.providers,
            slots: state.slots,
            startDate: state.startDate,
            numWeeks: state.numWeeks,
          };
          const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyState].slice(-MAX_HISTORY);
          
          set({
            slots: state.slots.map((s) => (s.id === slotId ? { ...s, providerId: null } : s)),
            history: newHistory,
            historyIndex: newHistory.length - 1,
          });
          return;
        }

        const provider = state.providers.find((p) => p.id === providerId);
        if (!canAssignProvider(state.slots, provider, slot, slot.id)) {
          set({
            lastActionMessage: "Cannot assign provider due to conflicts, skills, or fatigue guardrails.",
          });
          get().showToast({ type: "error", title: "Assignment Failed", message: "Cannot assign due to conflicts, skills, or fatigue guardrails." });
          return;
        }

        const historyState: HistoryState = {
          providers: state.providers,
          slots: state.slots,
          startDate: state.startDate,
          numWeeks: state.numWeeks,
        };
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyState].slice(-MAX_HISTORY);

        set({
          slots: state.slots.map((s) => (s.id === slotId ? { ...s, providerId } : s)),
          history: newHistory,
          historyIndex: newHistory.length - 1,
          lastActionMessage: null,
        });
      },

      clearAssignments: () => {
        const state = get();
        const historyState: HistoryState = {
          providers: state.providers,
          slots: state.slots,
          startDate: state.startDate,
          numWeeks: state.numWeeks,
        };
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyState].slice(-MAX_HISTORY);
        
        set({
          slots: state.slots.map((s) => ({ ...s, providerId: null })),
          history: newHistory,
          historyIndex: newHistory.length - 1,
          lastActionMessage: "All assignments cleared.",
        });
        
        get().showToast({ type: "warning", title: "Assignments Cleared", message: "All shift assignments have been removed." });
      },

      autoAssign: () => {
        set((state) => {
          const historyState: HistoryState = {
            providers: state.providers,
            slots: state.slots,
            startDate: state.startDate,
            numWeeks: state.numWeeks,
          };
          const prevHistory = [...state.history.slice(0, state.historyIndex + 1), historyState].slice(-MAX_HISTORY);
          
          const newSlots = [...state.slots];
          const counts = getProviderCounts(newSlots, state.providers);

          let assignedCount = 0;
          newSlots.forEach((slot, index) => {
            if (slot.providerId) return;

            const candidates = state.providers
              .filter((provider) => canAssignProvider(newSlots, provider, slot, slot.id))
              .map((provider) => ({ provider, score: computeDeficitScore(slot, provider, counts[provider.id]) }))
              .sort((a, b) => b.score - a.score || a.provider.name.localeCompare(b.provider.name));

            const chosen = candidates[0]?.provider;
            if (!chosen) return;

            newSlots[index] = { ...slot, providerId: chosen.id };
            assignedCount += 1;
            const cc = counts[chosen.id];
            if (slot.type === "DAY") {
              if (slot.isWeekendLayout) cc.weekendDays += 1;
              else cc.weekDays += 1;
            } else if (slot.type === "NIGHT") {
              if (slot.isWeekendLayout) cc.weekendNights += 1;
              else cc.weekNights += 1;
            }
          });

          return {
            slots: newSlots,
            history: prevHistory,
            historyIndex: prevHistory.length - 1,
            lastActionMessage: `Auto-assigned ${assignedCount} shifts using constraints: skills, fatigue, fairness, and preferences.`,
          };
        });
        
        get().showToast({ type: "success", title: "Auto-Assignment Complete", message: "Shifts have been assigned based on skills, fatigue, and preferences." });
      },

      createScenario: (name) => {
        const state = get();
        const trimmed = name.trim() || `Scenario ${state.scenarios.length + 1}`;
        const snapshot: ScenarioSnapshot = {
          id: crypto.randomUUID(),
          name: trimmed,
          createdAt: new Date().toISOString(),
          providers: structuredClone(state.providers),
          slots: structuredClone(state.slots),
          startDate: state.startDate,
          numWeeks: state.numWeeks,
        };
        set({
          scenarios: [snapshot, ...state.scenarios].slice(0, 12),
          lastActionMessage: `Saved scenario: ${trimmed}`,
        });
        
        get().showToast({ type: "success", title: "Scenario Saved", message: `"${trimmed}" has been saved.` });
      },

      loadScenario: (id) => {
        const state = get();
        const found = state.scenarios.find((scenario) => scenario.id === id);
        if (!found) return;
        
        const historyState: HistoryState = {
          providers: state.providers,
          slots: state.slots,
          startDate: state.startDate,
          numWeeks: state.numWeeks,
        };
        const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyState].slice(-MAX_HISTORY);
        
        set({
          providers: structuredClone(found.providers),
          slots: structuredClone(found.slots),
          startDate: found.startDate,
          numWeeks: found.numWeeks,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          lastActionMessage: `Loaded scenario: ${found.name}`,
        });
        
        get().showToast({ type: "info", title: "Scenario Loaded", message: `"${found.name}" has been restored.` });
      },

      deleteScenario: (id) => {
        set((state) => ({
          scenarios: state.scenarios.filter((scenario) => scenario.id !== id),
        }));
        
        get().showToast({ type: "info", title: "Scenario Deleted" });
      },

      clearMessage: () => set({ lastActionMessage: null }),

      showToast: (toast) => {
        const id = crypto.randomUUID();
        const duration = toast.duration ?? 4000;
        
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id }],
        }));

        if (duration > 0) {
          setTimeout(() => {
            get().dismissToast(id);
          }, duration);
        }
      },

      dismissToast: (id) => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      },

      undo: () => {
        const state = get();
        if (state.historyIndex < 0) return;
        
        const historyState = state.history[state.historyIndex];
        if (!historyState) return;
        
        const previousIndex = state.historyIndex - 1;
        const previousState = previousIndex >= 0 ? state.history[previousIndex] : null;
        
        set({
          providers: previousState?.providers ?? historyState.providers,
          slots: previousState?.slots ?? historyState.slots,
          startDate: previousState?.startDate ?? historyState.startDate,
          numWeeks: previousState?.numWeeks ?? historyState.numWeeks,
          historyIndex: previousIndex,
          lastActionMessage: "Undo applied.",
        });
        
        get().showToast({ type: "info", title: "Undo", message: "Previous action has been undone." });
      },

      redo: () => {
        const state = get();
        if (state.historyIndex >= state.history.length - 1) return;
        
        const nextIndex = state.historyIndex + 1;
        const nextState = state.history[nextIndex];
        if (!nextState) return;
        
        set({
          providers: nextState.providers,
          slots: nextState.slots,
          startDate: nextState.startDate,
          numWeeks: nextState.numWeeks,
          historyIndex: nextIndex,
          lastActionMessage: "Redo applied.",
        });
        
        get().showToast({ type: "info", title: "Redo", message: "Action has been restored." });
      },

      canUndo: () => {
        const state = get();
        return state.historyIndex >= 0;
      },

      canRedo: () => {
        const state = get();
        return state.historyIndex < state.history.length - 1;
      },
    }),
    {
      name: "nicu-schedule-store-v4",
      partialize: (state) => ({
        providers: state.providers,
        startDate: state.startDate,
        numWeeks: state.numWeeks,
        slots: state.slots,
        scenarios: state.scenarios,
        history: state.history,
        historyIndex: state.historyIndex,
      }),
    },
  ),
);
