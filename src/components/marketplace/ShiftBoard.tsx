import { useState, useMemo, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { 
  Megaphone, 
  Search, 
  X,
  Users,
  Clock
} from 'lucide-react';
import { useScheduleStore } from '@/store';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useOfflineMode } from '@/lib/pwa/offlineMode';
import type { MarketplaceShift, ShiftType } from '@/types';
import { ShiftCard } from './ShiftCard';

interface MarketplaceFilters {
  dateRange: { start: string | null; end: string | null };
  shiftTypes: ShiftType[];
  locations: string[];
}

interface ShiftBoardProps {
  filters?: MarketplaceFilters;
  onClaimSuccess?: (shiftId: string) => void;
}

export function ShiftBoard({ filters, onClaimSuccess }: ShiftBoardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const toast = useToast();
  const { isOnline } = useOfflineMode();

  const providers = useScheduleStore((s) => s.providers);
  const currentUser = useScheduleStore((s) => s.currentUser);
  const marketplaceShifts = useScheduleStore((s) => s.marketplaceShifts);
  const claimShift = useScheduleStore((s) => s.claimShift);

  const [searchTerm, setSearchTerm] = useState('');
  const [claimingShiftId, setClaimingShiftId] = useState<string | null>(null);

  const broadcastingShifts = useMemo(() => {
    return marketplaceShifts.filter(
      (s) => s.lifecycleState === 'BROADCASTING' || s.lifecycleState === 'POSTED'
    );
  }, [marketplaceShifts]);

  const filteredShifts = useMemo(() => {
    let shifts = broadcastingShifts;

    if (filters?.dateRange?.start) {
      shifts = shifts.filter((s) => s.date >= filters.dateRange.start!);
    }
    if (filters?.dateRange?.end) {
      shifts = shifts.filter((s) => s.date <= filters.dateRange.end!);
    }
    if (filters?.shiftTypes && filters.shiftTypes.length > 0) {
      shifts = shifts.filter((s) => filters.shiftTypes.includes(s.shiftType as ShiftType));
    }
    if (filters?.locations && filters.locations.length > 0) {
      shifts = shifts.filter((s) => filters.locations.includes(s.location));
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      shifts = shifts.filter((s) => {
        const provider = providers.find((p) => p.id === s.postedByProviderId);
        return (
          s.shiftType.toLowerCase().includes(searchLower) ||
          s.location.toLowerCase().includes(searchLower) ||
          s.date.includes(searchLower) ||
          s.notes.toLowerCase().includes(searchLower) ||
          provider?.name.toLowerCase().includes(searchLower)
        );
      });
    }

    return shifts.sort((a, b) => a.date.localeCompare(b.date));
  }, [broadcastingShifts, filters, searchTerm, providers]);

  const availableLocations = useMemo(() => {
    const locs = new Set(broadcastingShifts.map((s) => s.location));
    return Array.from(locs).sort();
  }, [broadcastingShifts]);

  const handleClaim = useCallback(async (shiftId: string) => {
    if (!currentUser) {
      toast.error('You must be logged in to claim a shift');
      return;
    }

    if (!isOnline) {
      toast.error('Cannot claim shifts while offline');
      return;
    }

    setClaimingShiftId(shiftId);
    try {
      await claimShift(shiftId, currentUser.id);
      toast.success('Shift claimed successfully!');
      onClaimSuccess?.(shiftId);
    } catch {
      toast.error('Failed to claim shift. Please try again.');
    } finally {
      setClaimingShiftId(null);
    }
  }, [currentUser, isOnline, claimShift, toast, onClaimSuccess]);

  const getPostedByName = (shift: MarketplaceShift) => {
    const provider = providers.find((p) => p.id === shift.postedByProviderId);
    return provider?.name || 'Unknown Provider';
  };

  const getClaimedByName = (shift: MarketplaceShift) => {
    if (!shift.claimedByProviderId) return undefined;
    const provider = providers.find((p) => p.id === shift.claimedByProviderId);
    return provider?.name;
  };

  const postedCount = broadcastingShifts.length;
  const claimedCount = broadcastingShifts.filter(s => s.claimedByProviderId).length;
  const availableCount = postedCount - claimedCount;

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-xl border ${
        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isDark ? 'bg-blue-500/20' : 'bg-blue-100'
            }`}>
              <Megaphone className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Shift Marketplace
              </h2>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {availableCount} available shifts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
            }`}>
              <Users className="w-3.5 h-3.5" />
              {postedCount} posted
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              {claimedCount} claimed
            </div>
          </div>
        </div>

        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
          isDark 
            ? 'bg-slate-700 border-slate-600' 
            : 'bg-slate-50 border-slate-200'
        }`}>
          <Search className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by date, shift type, location, or provider..."
            className={`flex-1 bg-transparent border-none outline-none text-sm min-h-[44px] ${
              isDark 
                ? 'text-white placeholder:text-slate-500' 
                : 'text-slate-900 placeholder:text-slate-400'
            }`}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className={`p-1 rounded ${isDark ? 'hover:bg-slate-600' : 'hover:bg-slate-200'}`}
            >
              <X className={`w-3 h-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            </button>
          )}
        </div>

        {availableLocations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Locations:
            </span>
            {availableLocations.map((loc) => (
              <span
                key={loc}
                className={`px-2 py-0.5 rounded text-xs ${
                  isDark 
                    ? 'bg-slate-700 text-slate-300' 
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {loc}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filteredShifts.length === 0 ? (
            <div className={`col-span-full py-12 text-center ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">
                {searchTerm || filters 
                  ? 'No shifts match your filters' 
                  : 'No shifts available'}
              </p>
              <p className="text-sm mt-1">
                {searchTerm || filters 
                  ? 'Try adjusting your search or filters' 
                  : 'Check back later for new shift opportunities'}
              </p>
            </div>
          ) : (
            filteredShifts.map((shift) => (
              <ShiftCard
                key={shift.id}
                shift={shift}
                postedByName={getPostedByName(shift)}
                claimedByName={getClaimedByName(shift)}
                onClaim={handleClaim}
                isLoading={claimingShiftId === shift.id}
                isOwnShift={shift.postedByProviderId === currentUser?.id}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ShiftBoard;
