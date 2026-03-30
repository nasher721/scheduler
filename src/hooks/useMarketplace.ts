import { useState, useCallback } from 'react';
import { useScheduleStore } from '@/store';
import { ShiftLifecycleStatus } from '@/types';
import * as marketplaceApi from '@/lib/api/marketplace';

export function useMarketplace() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const store = useScheduleStore();
  const { marketplaceShifts, postShiftForCoverage, claimShift, approveShift, cancelMarketplaceShift } = store;

  const postShift = useCallback(async (slotId: string, postedByProviderId: string, notes?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await marketplaceApi.postShiftForCoverage(slotId, postedByProviderId, notes);
      postShiftForCoverage(slotId, postedByProviderId, notes);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post shift');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [postShiftForCoverage]);

  const claimMarketplaceShift = useCallback(async (shiftId: string, providerId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await marketplaceApi.claimShift(shiftId, providerId);
      claimShift(shiftId, providerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim shift');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [claimShift]);

  const approveMarketplaceShift = useCallback(async (shiftId: string, approvedBy: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await marketplaceApi.approveShift(shiftId, approvedBy);
      approveShift(shiftId, approvedBy);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve shift');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [approveShift]);

  const getShiftsByStatus = useCallback((status: ShiftLifecycleStatus) => {
    return marketplaceShifts.filter(s => s.lifecycleState === status);
  }, [marketplaceShifts]);

  return {
    shifts: marketplaceShifts,
    isLoading,
    error,
    postShift,
    claimMarketplaceShift,
    approveMarketplaceShift,
    cancelShift: cancelMarketplaceShift,
    getShiftsByStatus,
  };
}
