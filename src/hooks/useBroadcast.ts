import { useState, useCallback } from 'react';
import { useScheduleStore } from '@/store';
import { BroadcastChannel } from '@/types';
import * as broadcastApi from '@/lib/api/broadcast';

export function useBroadcast() {
  const [isDispatching, setIsDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { broadcastHistory, addBroadcastEntry, escalateBroadcast } = useScheduleStore();

  const dispatch = useCallback(async (
    shiftId: string,
    channel: BroadcastChannel,
    eligibleProviderIds: string[]
  ) => {
    setIsDispatching(true);
    setError(null);
    try {
      const result = await broadcastApi.dispatchBroadcast(shiftId, channel, eligibleProviderIds);
      addBroadcastEntry(shiftId, [], channel);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dispatch broadcast');
      throw err;
    } finally {
      setIsDispatching(false);
    }
  }, [addBroadcastEntry]);

  const escalate = useCallback(async (shiftId: string, _currentTier: number) => {
    setIsDispatching(true);
    setError(null);
    try {
      const result = await broadcastApi.escalateBroadcast(shiftId, _currentTier);
      escalateBroadcast(shiftId);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to escalate broadcast');
      throw err;
    } finally {
      setIsDispatching(false);
    }
  }, [escalateBroadcast]);

  const getHistoryForShift = useCallback((shiftId: string) => {
    return broadcastHistory.filter(h => h.marketplaceShiftId === shiftId);
  }, [broadcastHistory]);

  return {
    broadcastHistory,
    isDispatching,
    error,
    dispatch,
    escalate,
    getHistoryForShift,
  };
}
