import { useState, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  Filter,
  MinusCircle,
  Search,
  X,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { parseISO, format } from 'date-fns';
import { useScheduleStore } from '@/store';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useOfflineMode } from '@/lib/pwa/offlineMode';
import type { MarketplaceShift, ShiftLifecycleStatus } from '@/types';
import { ShiftCard } from './ShiftCard';

type TabType = 'posted' | 'claimed';

export function MyShifts() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const toast = useToast();
  const { isOnline } = useOfflineMode();

  const providers = useScheduleStore((s) => s.providers);
  const currentUser = useScheduleStore((s) => s.currentUser);
  const marketplaceShifts = useScheduleStore((s) => s.marketplaceShifts);
  const cancelMarketplaceShift = useScheduleStore((s) => s.cancelMarketplaceShift);

  const [activeTab, setActiveTab] = useState<TabType>('posted');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ShiftLifecycleStatus | 'all'>('all');

  const myPostedShifts = useMemo(() => {
    if (!currentUser) return [];
    return marketplaceShifts.filter(
      (s) => s.postedByProviderId === currentUser.id
    );
  }, [marketplaceShifts, currentUser]);

  const myClaimedShifts = useMemo(() => {
    if (!currentUser) return [];
    return marketplaceShifts.filter(
      (s) => s.claimedByProviderId === currentUser.id
    );
  }, [marketplaceShifts, currentUser]);

  const filteredShifts = useMemo(() => {
    const shifts = activeTab === 'posted' ? myPostedShifts : myClaimedShifts;
    
    return shifts.filter((shift) => {
      if (statusFilter !== 'all' && shift.lifecycleState !== statusFilter) {
        return false;
      }

      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const shiftDate = parseISO(shift.date);
        const dateLabel = format(shiftDate, 'yyyy-MM-dd');
        const dayOfWeek = format(shiftDate, 'EEEE');
        
        return (
          shift.shiftType.toLowerCase().includes(searchLower) ||
          shift.location.toLowerCase().includes(searchLower) ||
          dateLabel.includes(searchLower) ||
          dayOfWeek.toLowerCase().includes(searchLower) ||
          shift.notes.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [myPostedShifts, myClaimedShifts, activeTab, statusFilter, searchTerm]);

  const handleCancelShift = (shiftId: string) => {
    if (!isOnline) {
      toast.error('Cannot cancel while offline');
      return;
    }
    cancelMarketplaceShift(shiftId);
    toast.success('Shift cancelled successfully');
  };

  const getProviderName = (providerId: string | null) => {
    if (!providerId) return 'Unknown';
    const provider = providers.find((p) => p.id === providerId);
    return provider?.name || 'Unknown';
  };

  const getPostedByName = (shift: MarketplaceShift) => {
    return getProviderName(shift.postedByProviderId);
  };

  const getClaimedByName = (shift: MarketplaceShift) => {
    return getProviderName(shift.claimedByProviderId);
  };

  const postedCount = myPostedShifts.length;
  const claimedCount = myClaimedShifts.length;
  const statusOptions: { value: ShiftLifecycleStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'POSTED', label: 'Posted' },
    { value: 'AI_EVALUATING', label: 'Evaluating' },
    { value: 'BROADCASTING', label: 'Broadcasting' },
    { value: 'CLAIMED', label: 'Claimed' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-xl border ${
        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              My Marketplace Shifts
            </h2>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {postedCount} posted • {claimedCount} claimed
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex rounded-lg overflow-hidden border flex-1 max-w-md">
            {(['posted', 'claimed'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                  activeTab === tab
                    ? isDark
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-600 text-white'
                    : isDark
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab === 'posted' ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownLeft className="w-4 h-4" />
                )}
                <span className="capitalize">{tab}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  activeTab === tab
                    ? 'bg-white/20'
                    : isDark
                      ? 'bg-slate-600'
                      : 'bg-slate-200'
                }`}>
                  {tab === 'posted' ? postedCount : claimedCount}
                </span>
              </button>
            ))}
          </div>

          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border flex-1 max-w-md ${
            isDark 
              ? 'bg-slate-700 border-slate-600' 
              : 'bg-slate-50 border-slate-200'
          }`}>
            <Search className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search shifts..."
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

          <div className="flex items-center gap-2">
            <Filter className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ShiftLifecycleStatus | 'all')}
              className={`px-3 py-2 rounded-lg border text-sm min-h-[44px] ${
                isDark
                  ? 'bg-slate-700 border-slate-600 text-white'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filteredShifts.length === 0 ? (
            <div className={`col-span-full py-12 text-center ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              {activeTab === 'posted' ? (
                <MinusCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              ) : (
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              )}
              <p className="font-medium">
                {searchTerm || statusFilter !== 'all' 
                  ? 'No shifts match your filters' 
                  : `No ${activeTab} shifts yet`}
              </p>
              <p className="text-sm mt-1">
                {activeTab === 'posted' 
                  ? 'Shifts you post for coverage will appear here' 
                  : 'Shifts you claim from the marketplace will appear here'}
              </p>
            </div>
          ) : (
            filteredShifts.map((shift) => (
              <ShiftCard
                key={shift.id}
                shift={shift}
                postedByName={getPostedByName(shift)}
                claimedByName={getClaimedByName(shift)}
                isOwnShift={activeTab === 'posted'}
                onCancel={activeTab === 'posted' ? handleCancelShift : undefined}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default MyShifts;
