import { useMemo, useCallback } from 'react';
import { useScheduleStore } from '@/store';
import { Provider, FatigueMetrics } from '@/types';

export function useFatigueCheck(providerId?: string) {
  const { providers, slots } = useScheduleStore();

  const calculateFatigue = useCallback((provider: Provider): FatigueMetrics => {
    const providerSlots = slots.filter(s => s.providerId === provider.id);
    const sortedSlots = providerSlots.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    let consecutiveShiftsWorked = 0;
    const today = new Date();
    
    for (const slot of sortedSlots) {
      const slotDate = new Date(slot.date);
      const daysDiff = Math.floor((today.getTime() - slotDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff === consecutiveShiftsWorked) {
        consecutiveShiftsWorked++;
      } else {
        break;
      }
    }

    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const shiftsThisMonth = providerSlots.filter(s => {
      const date = new Date(s.date);
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
