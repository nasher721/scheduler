import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addDays, format, parseISO, startOfWeek } from "date-fns";

export type ShiftType = "DAY" | "NIGHT" | "NMET" | "JEOPARDY";

export interface Provider {
  id: string;
  name: string;
  targetWeekDays: number;
  targetWeekendDays: number;
  targetWeekNights: number;
  targetWeekendNights: number;
  unavailableDates: string[];
}

export interface ShiftSlot {
  id: string;
  date: string;
  type: ShiftType;
  providerId: string | null;
  isWeekendLayout: boolean;
}

export interface ProviderCounts {
  weekDays: number;
  weekendDays: number;
  weekNights: number;
  weekendNights: number;
}

interface ScheduleState {
  providers: Provider[];
  startDate: string;
  numWeeks: number;
  slots: ShiftSlot[];
  lastActionMessage: string | null;
  addProvider: (provider: Omit<Provider, "id">) => void;
  updateProvider: (id: string, provider: Partial<Provider>) => void;
  removeProvider: (id: string) => void;
  setScheduleRange: (startDate: string, numWeeks: number) => void;
  assignShift: (slotId: string, providerId: string | null) => void;
  autoAssign: () => void;
  clearAssignments: () => void;
  clearMessage: () => void;
}

const getWeekStart = () => format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

const baseProviders: Provider[] = [
  { id: "1", name: "Dr. Adams", targetWeekDays: 10, targetWeekendDays: 4, targetWeekNights: 3, targetWeekendNights: 2, unavailableDates: [] },
  { id: "2", name: "Dr. Baker", targetWeekDays: 10, targetWeekendDays: 4, targetWeekNights: 3, targetWeekendNights: 2, unavailableDates: [] },
  { id: "3", name: "Dr. Clark", targetWeekDays: 10, targetWeekendDays: 4, targetWeekNights: 3, targetWeekendNights: 2, unavailableDates: [] },
];

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
      slots.push({ id: `${dateStr}-DAY-${i}`, date: dateStr, type: "DAY", providerId: null, isWeekendLayout: isWeekendDay });
    }

    slots.push({ id: `${dateStr}-NIGHT-0`, date: dateStr, type: "NIGHT", providerId: null, isWeekendLayout: isWeekendNight });
    slots.push({ id: `${dateStr}-NMET-0`, date: dateStr, type: "NMET", providerId: null, isWeekendLayout: isWeekendDay });
    slots.push({ id: `${dateStr}-JEOPARDY-0`, date: dateStr, type: "JEOPARDY", providerId: null, isWeekendLayout: isWeekendDay });
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

const canAssignProvider = (slots: ShiftSlot[], provider: Provider | undefined, slot: ShiftSlot, currentSlotId?: string) => {
  if (!provider) return false;
  if (provider.unavailableDates.includes(slot.date)) return false;

  return !slots.some(
    (s) => s.id !== currentSlotId && s.date === slot.date && s.providerId === provider.id,
  );
};

const computeDeficitScore = (slot: ShiftSlot, provider: Provider, count: ProviderCounts) => {
  if (slot.type === "DAY") {
    const target = slot.isWeekendLayout ? provider.targetWeekendDays : provider.targetWeekDays;
    const current = slot.isWeekendLayout ? count.weekendDays : count.weekDays;
    return target - current;
  }

  if (slot.type === "NIGHT") {
    const target = slot.isWeekendLayout ? provider.targetWeekendNights : provider.targetWeekNights;
    const current = slot.isWeekendLayout ? count.weekendNights : count.weekNights;
    return target - current;
  }

  // keep NMET/JEOPARDY fair by balancing total shifts.
  return (provider.targetWeekDays + provider.targetWeekendDays + provider.targetWeekNights + provider.targetWeekendNights)
    - (count.weekDays + count.weekendDays + count.weekNights + count.weekendNights);
};

const initialStart = getWeekStart();

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      providers: baseProviders,
      startDate: initialStart,
      numWeeks: 4,
      slots: generateInitialSlots(initialStart, 4),
      lastActionMessage: null,

      addProvider: (provider) => {
        set((state) => ({
          providers: [...state.providers, { ...provider, id: crypto.randomUUID() }],
          lastActionMessage: `Added ${provider.name} to roster.`,
        }));
      },

      updateProvider: (id, updates) => {
        set((state) => ({
          providers: state.providers.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        }));
      },

      removeProvider: (id) => {
        set((state) => ({
          providers: state.providers.filter((p) => p.id !== id),
          slots: state.slots.map((s) => (s.providerId === id ? { ...s, providerId: null } : s)),
          lastActionMessage: "Provider removed and related assignments cleared.",
        }));
      },

      setScheduleRange: (startDate, numWeeks) => {
        set(() => ({
          startDate,
          numWeeks,
          slots: generateInitialSlots(startDate, numWeeks),
          lastActionMessage: "Schedule window updated.",
        }));
      },

      assignShift: (slotId, providerId) => {
        const state = get();
        const slot = state.slots.find((s) => s.id === slotId);
        if (!slot) return;

        if (providerId === null) {
          set({
            slots: state.slots.map((s) => (s.id === slotId ? { ...s, providerId: null } : s)),
          });
          return;
        }

        const provider = state.providers.find((p) => p.id === providerId);
        if (!canAssignProvider(state.slots, provider, slot, slot.id)) {
          set({
            lastActionMessage: "Cannot assign provider: unavailable or already working that date.",
          });
          return;
        }

        set({
          slots: state.slots.map((s) => (s.id === slotId ? { ...s, providerId } : s)),
          lastActionMessage: null,
        });
      },

      clearAssignments: () => {
        set((state) => ({
          slots: state.slots.map((s) => ({ ...s, providerId: null })),
          lastActionMessage: "All assignments cleared.",
        }));
      },

      autoAssign: () => {
        set((state) => {
          const newSlots = [...state.slots];
          const counts = getProviderCounts(newSlots, state.providers);

          newSlots.forEach((slot, index) => {
            if (slot.providerId) return;

            const candidates = state.providers
              .filter((provider) => canAssignProvider(newSlots, provider, slot, slot.id))
              .map((provider) => ({ provider, score: computeDeficitScore(slot, provider, counts[provider.id]) }))
              .sort((a, b) => b.score - a.score || a.provider.name.localeCompare(b.provider.name));

            const chosen = candidates[0]?.provider;
            if (!chosen) return;

            newSlots[index] = { ...slot, providerId: chosen.id };
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
            lastActionMessage: "Auto-assignment finished using fairness + target balancing.",
          };
        });
      },

      clearMessage: () => set({ lastActionMessage: null }),
    }),
    {
      name: "nicu-schedule-store-v2",
      partialize: (state) => ({
        providers: state.providers,
        startDate: state.startDate,
        numWeeks: state.numWeeks,
        slots: state.slots,
      }),
    },
  ),
);
