import { useShallow } from 'zustand/react/shallow';
import { useMemo, useCallback } from 'react';
import { parseISO, differenceInCalendarDays } from 'date-fns';
import { useScheduleStore } from '@/store';
import { Provider, FatigueMetrics } from '@/types';

export function useFatigueCheck(providerId?: string) {
  const { providers, slots } = useScheduleStore(useShallow((s) => ({ providers: s.providers, slots: s.slots })));

  const calculateFatigue = useCallback((provider: Provider): FatigueMetrics => {
    const providerSlots = slots.filter(s => s.providerId === provider.id);
    // Dates are 'YYYY-MM-DD' strings; parseISO gives local-time dates so the
    // math below agrees with the user's local "today" (new Date(s.date)
    // parses as UTC midnight, shifting shifts a day for users west of UTC).
    const sortedSlots = [...providerSlots].sort((a, b) => b.date.localeCompare(a.date));

    let consecutiveShiftsWorked = 0;
    const today = new Date();

    for (const slot of sortedSlots) {
      const daysDiff = differenceInCalendarDays(today, parseISO(slot.date));
      if (daysDiff === consecutiveShiftsWorked) {
        consecutiveShiftsWorked++;
      } else {
        break;
      }
    }

    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const shiftsThisMonth = providerSlots.filter(s => {
      const date = parseISO(s.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    }).length;

    const riskLevel = consecutiveShiftsWorked >= 3 || shiftsThisMonth > 20 
      ? 'high' 
      : consecutiveShiftsWorked >= 2 || shiftsThisMonth > 15 
        ? 'medium' 
        : 'low';

    return {
      consecutiveShiftsWorked,
      shiftsThisMonth,
      riskLevel,
    };
  }, [slots]);

  const fatigueMetrics = useMemo(() => {
    if (providerId) {
      const provider = providers.find(p => p.id === providerId);
      return provider ? calculateFatigue(provider) : null;
    }
    return null;
  }, [providerId, providers, calculateFatigue]);

  const getProviderFatigue = useCallback((id: string): FatigueMetrics | null => {
    const provider = providers.find(p => p.id === id);
    return provider ? calculateFatigue(provider) : null;
  }, [providers, calculateFatigue]);

  return {
    fatigueMetrics,
    getProviderFatigue,
    calculateFatigue,
  };
}
