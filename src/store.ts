import { create } from 'zustand';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';

export type ShiftType = 'DAY' | 'NIGHT' | 'NMET' | 'JEOPARDY';

export interface Provider {
    id: string;
    name: string;
    targetWeekDays: number;
    targetWeekendDays: number;
    targetWeekNights: number;
    targetWeekendNights: number;
    unavailableDates: string[]; // YYYY-MM-DD
}

export interface ShiftSlot {
    id: string;         // e.g. "2024-01-01-DAY-1"
    date: string;       // YYYY-MM-DD
    type: ShiftType;
    providerId: string | null;
    isWeekendLayout: boolean; // For display purposes (Sat/Sun for Day, Thu-Sun for Night)
}

interface ScheduleState {
    providers: Provider[];
    startDate: string; // YYYY-MM-DD
    numWeeks: number;
    slots: ShiftSlot[];

    // Actions
    addProvider: (provider: Omit<Provider, 'id'>) => void;
    updateProvider: (id: string, provider: Partial<Provider>) => void;
    removeProvider: (id: string) => void;
    setScheduleRange: (startDate: string, numWeeks: number) => void;
    assignShift: (slotId: string, providerId: string | null) => void;
    autoAssign: () => void;
    clearAssignments: () => void;
}

const generateInitialSlots = (startDateStr: string, numWeeks: number): ShiftSlot[] => {
    const slots: ShiftSlot[] = [];
    const start = startOfWeek(parseISO(startDateStr), { weekStartsOn: 1 }); // Start on Monday

    for (let dayOffset = 0; dayOffset < numWeeks * 7; dayOffset++) {
        const currentDate = addDays(start, dayOffset);
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const dayOfWeek = currentDate.getDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat

        const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6; // Sat, Sun
        const isWeekendNight = dayOfWeek === 0 || dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6; // Thu, Fri, Sat, Sun

        // Day Shifts: 3 on weekdays, 2 on weekends
        const numDayShifts = isWeekendDay ? 2 : 3;
        for (let i = 0; i < numDayShifts; i++) {
            slots.push({ id: `${dateStr}-DAY-${i}`, date: dateStr, type: 'DAY', providerId: null, isWeekendLayout: isWeekendDay });
        }

        // Night Shift: 1
        slots.push({ id: `${dateStr}-NIGHT-0`, date: dateStr, type: 'NIGHT', providerId: null, isWeekendLayout: isWeekendNight });

        // NMET: 1
        slots.push({ id: `${dateStr}-NMET-0`, date: dateStr, type: 'NMET', providerId: null, isWeekendLayout: isWeekendDay });

        // Jeopardy: 1
        slots.push({ id: `${dateStr}-JEOPARDY-0`, date: dateStr, type: 'JEOPARDY', providerId: null, isWeekendLayout: isWeekendDay });
    }

    return slots;
};

export const useScheduleStore = create<ScheduleState>((set) => ({
    providers: [
        { id: '1', name: 'Dr. Adams', targetWeekDays: 10, targetWeekendDays: 4, targetWeekNights: 3, targetWeekendNights: 2, unavailableDates: [] },
        { id: '2', name: 'Dr. Baker', targetWeekDays: 10, targetWeekendDays: 4, targetWeekNights: 3, targetWeekendNights: 2, unavailableDates: [] },
        { id: '3', name: 'Dr. Clark', targetWeekDays: 10, targetWeekendDays: 4, targetWeekNights: 3, targetWeekendNights: 2, unavailableDates: [] }
    ],
    startDate: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    numWeeks: 4,
    slots: generateInitialSlots(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'), 4),

    addProvider: (provider) => set((state) => ({ providers: [...state.providers, { ...provider, id: crypto.randomUUID() }] })),

    updateProvider: (id, updates) => set((state) => ({
        providers: state.providers.map((p) => (p.id === id ? { ...p, ...updates } : p))
    })),

    removeProvider: (id) => set((state) => ({
        providers: state.providers.filter((p) => p.id !== id),
        // Remove assignments for this provider
        slots: state.slots.map(s => s.providerId === id ? { ...s, providerId: null } : s)
    })),

    setScheduleRange: (startDate, numWeeks) => set(() => ({
        startDate,
        numWeeks,
        slots: generateInitialSlots(startDate, numWeeks)
    })),

    assignShift: (slotId, providerId) => set((state) => ({
        slots: state.slots.map(s => s.id === slotId ? { ...s, providerId } : s)
    })),

    clearAssignments: () => set((state) => ({
        slots: state.slots.map(s => ({ ...s, providerId: null }))
    })),

    autoAssign: () => {
        // Basic auto-fill logic: iterate through unassigned slots and assign available providers who haven't met their target
        set((state) => {
            const newSlots = [...state.slots];
            const providers = [...state.providers];

            // Track assigned counts
            const counts: Record<string, { weekDays: number, weekendDays: number, weekNights: number, weekendNights: number }> = {};
            providers.forEach(p => counts[p.id] = { weekDays: 0, weekendDays: 0, weekNights: 0, weekendNights: 0 });

            // Count existing
            newSlots.forEach(s => {
                if (s.providerId && counts[s.providerId]) {
                    if (s.type === 'DAY') {
                        if (s.isWeekendLayout) counts[s.providerId].weekendDays++;
                        else counts[s.providerId].weekDays++;
                    } else if (s.type === 'NIGHT') {
                        if (s.isWeekendLayout) counts[s.providerId].weekendNights++;
                        else counts[s.providerId].weekNights++;
                    }
                }
            });

            // Helper to check if provider is valid for a slot
            const isValid = (pId: string, slot: ShiftSlot) => {
                const p = providers.find(prov => prov.id === pId);
                if (!p) return false;
                // Check unavailable
                if (p.unavailableDates.includes(slot.date)) return false;
                // Check if already working this day
                const alreadyWorking = newSlots.some(s => s.date === slot.date && s.providerId === pId);
                if (alreadyWorking) return false;

                // Check targets (soft constraint for auto assign)
                const cc = counts[pId];
                if (slot.type === 'DAY') {
                    if (slot.isWeekendLayout && cc.weekendDays >= p.targetWeekendDays) return false;
                    if (!slot.isWeekendLayout && cc.weekDays >= p.targetWeekDays) return false;
                } else if (slot.type === 'NIGHT') {
                    if (slot.isWeekendLayout && cc.weekendNights >= p.targetWeekendNights) return false;
                    if (!slot.isWeekendLayout && cc.weekNights >= p.targetWeekNights) return false;
                }
                return true;
            };

            // Assign
            newSlots.forEach((slot, index) => {
                if (!slot.providerId) {
                    // Find a valid provider
                    // Shuffle providers to distribute randomly
                    const shuffled = [...providers].sort(() => 0.5 - Math.random());
                    for (const p of shuffled) {
                        if (isValid(p.id, slot)) {
                            newSlots[index] = { ...slot, providerId: p.id };
                            // Update counts
                            const cc = counts[p.id];
                            if (slot.type === 'DAY') {
                                if (slot.isWeekendLayout) cc.weekendDays++;
                                else cc.weekDays++;
                            } else if (slot.type === 'NIGHT') {
                                if (slot.isWeekendLayout) cc.weekendNights++;
                                else cc.weekNights++;
                            }
                            break;
                        }
                    }
                }
            });

            return { slots: newSlots };
        });
    }
}));
