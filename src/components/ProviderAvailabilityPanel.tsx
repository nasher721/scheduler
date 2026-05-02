import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useScheduleStore, type ShiftSlot, type Provider } from "../store";
import { format, parseISO, addDays } from "date-fns";
import { 
  Users, 
  X, 
  Check, 
  AlertCircle,
  Calendar,
  Search,
  UserPlus,
  Clock,
  LayoutGrid,
  List
} from "lucide-react";
import type { ProviderStatus } from "../types";

function computeProviderStatus(provider: Provider, allSlots: ShiftSlot[], currentDate: string): ProviderStatus {
  const todaysSlots = allSlots.filter(s => s.date === currentDate);
  const assignedToday = todaysSlots.some(s => 
    s.providerId === provider.id || s.secondaryProviderIds?.includes(provider.id)
  );
  if (assignedToday) return "ON_SHIFT";
  
  const hasTimeOff = provider.timeOffRequests?.some(r => 
    currentDate >= r.date && currentDate <= r.date
  );
  if (hasTimeOff) return "ON_LEAVE";
  
  const unfilledCritical = todaysSlots.filter(s => !s.providerId && s.priority === "CRITICAL");
  const hasMatchingSkills = unfilledCritical.some(s => 
    (provider.skills ?? []).includes(s.requiredSkill)
  );
  if (hasMatchingSkills) return "ON_CALL";
  
  return "AVAILABLE";
}

function getStatusColor(status: ProviderStatus): string {
  switch (status) {
    case "AVAILABLE": return "bg-success";
    case "ON_SHIFT": return "bg-primary";
    case "ON_LEAVE": return "bg-warning";
    case "ON_CALL": return "bg-blue-500";
    case "UNAVAILABLE": return "bg-muted-foreground";
  }
}

function getStatusLabel(status: ProviderStatus): string {
  switch (status) {
    case "AVAILABLE": return "Available";
    case "ON_SHIFT": return "On Shift";
    case "ON_LEAVE": return "On Leave";
    case "ON_CALL": return "On Call";
    case "UNAVAILABLE": return "Unavailable";
  }
}

interface ProviderAvailabilityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSlot?: ShiftSlot | null;
  onAssign?: (slotId: string, providerId: string) => void;
  displayMode?: "drawer" | "inline";
  defaultView?: "slot" | "dashboard";
}

interface ProviderAvailability {
  provider: Provider;
  isAvailable: boolean;
  isAvailableReason?: string;
  currentLoad: {
    weekDays: number;
    weekendDays: number;
    weekNights: number;
    weekendNights: number;
  };
  hasSkill: boolean;
  conflicts: string[];
}

export function ProviderAvailabilityPanel({ 
  isOpen, 
  onClose, 
  selectedSlot,
  onAssign,
  displayMode = "drawer",
  defaultView
}: ProviderAvailabilityPanelProps) {
  const { providers, slots, assignShift } = useScheduleStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAvailableOnly, setFilterAvailableOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'slot' | 'dashboard'>(() => defaultView ?? (selectedSlot ? 'slot' : 'dashboard'));
  const [dashboardView, setDashboardView] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<ProviderStatus | 'ALL'>('ALL');
  const canShowSlotView = Boolean(selectedSlot);
  const activeViewMode = canShowSlotView ? viewMode : 'dashboard';

  const today = format(new Date(), 'yyyy-MM-dd');

  const dashboardStatuses = useMemo(() => {
    return providers.map((provider) => ({
      provider,
      status: computeProviderStatus(provider, slots, today)
    }));
  }, [providers, slots, today]);

  const filteredDashboardStatuses = useMemo(() => {
    let filtered = dashboardStatuses;
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(d => d.status === statusFilter);
    }
    if (searchTerm) {
      filtered = filtered.filter(d => 
        d.provider.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return filtered;
  }, [dashboardStatuses, statusFilter, searchTerm]);

  const statusCounts = useMemo(() => {
    const counts: Record<ProviderStatus, number> = {
      AVAILABLE: 0,
      ON_SHIFT: 0,
      ON_LEAVE: 0,
      ON_CALL: 0,
      UNAVAILABLE: 0
    };
    dashboardStatuses.forEach(d => { counts[d.status]++; });
    return counts;
  }, [dashboardStatuses]);

  const availabilities = useMemo((): ProviderAvailability[] => {
    if (!selectedSlot) return [];

    const slotDate = parseISO(selectedSlot.date);
    const weekStart = addDays(slotDate, -slotDate.getDay() + 1);
    const weekEnd = addDays(weekStart, 6);

    return providers.map((provider) => {
      const conflicts: string[] = [];

      const hasSkill = provider.skills.includes(selectedSlot.requiredSkill);
      if (!hasSkill) {
        conflicts.push(`Missing skill: ${selectedSlot.requiredSkill}`);
      }

      const isOnTimeOff = provider.timeOffRequests.some(r => r.date === selectedSlot.date);
      if (isOnTimeOff) {
        conflicts.push('On time-off/PTO');
      }

      const sameDayShifts = slots.filter(s => 
        s.date === selectedSlot.date && 
        s.providerId === provider.id &&
        s.id !== selectedSlot.id
      );

      if (sameDayShifts.length > 0) {
        const shiftTypes = sameDayShifts.map(s => s.type).join(', ');
        conflicts.push(`Already assigned: ${shiftTypes}`);
      }

      if (selectedSlot.type === 'NIGHT') {
        const nightSlots = slots.filter(s => 
          s.providerId === provider.id && 
          s.type === 'NIGHT'
        );
        
        const consecutiveNights = nightSlots.filter(s => {
          const sDate = parseISO(s.date);
          const diff = Math.abs(slotDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24);
          return diff <= 1 && diff > 0;
        }).length;

        if (consecutiveNights >= provider.maxConsecutiveNights) {
          conflicts.push(`Max consecutive nights (${provider.maxConsecutiveNights})`);
        }
      }

      const providerSlots = slots.filter(s => s.providerId === provider.id);
      const weekSlots = providerSlots.filter(s => {
        const sDate = parseISO(s.date);
        return sDate >= weekStart && sDate <= weekEnd;
      });

      const currentLoad = {
        weekDays: weekSlots.filter(s => s.type === 'DAY' && !s.isWeekendLayout).length,
        weekendDays: weekSlots.filter(s => s.type === 'DAY' && s.isWeekendLayout).length,
        weekNights: weekSlots.filter(s => s.type === 'NIGHT' && !s.isWeekendLayout).length,
        weekendNights: weekSlots.filter(s => s.type === 'NIGHT' && s.isWeekendLayout).length,
      };

      const isDayShift = selectedSlot.type === 'DAY';
      const isWeekend = selectedSlot.isWeekendLayout;

      let wouldExceedTarget = false;
      if (isDayShift && !isWeekend && currentLoad.weekDays >= provider.targetWeekDays) {
        wouldExceedTarget = true;
      } else if (isDayShift && isWeekend && currentLoad.weekendDays >= provider.targetWeekendDays) {
        wouldExceedTarget = true;
      } else if (!isDayShift) {
        wouldExceedTarget = (currentLoad.weekNights + currentLoad.weekendNights) >= provider.targetWeekNights;
      }

      if (wouldExceedTarget) {
        conflicts.push('Would exceed target load');
      }

      const isAvailable = hasSkill && !isOnTimeOff && sameDayShifts.length === 0 && !wouldExceedTarget;

      return {
        provider,
        isAvailable,
        currentLoad,
        hasSkill,
        conflicts,
      };
    });
  }, [providers, slots, selectedSlot]);

  const filteredAvailabilities = useMemo(() => {
    let filtered = availabilities;

    if (searchTerm) {
      filtered = filtered.filter(a => 
        a.provider.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterAvailableOnly) {
      filtered = filtered.filter(a => a.isAvailable);
    }

    return filtered.sort((a, b) => {
      if (a.isAvailable && !b.isAvailable) return -1;
      if (!a.isAvailable && b.isAvailable) return 1;
      
      const aTotal = a.currentLoad.weekDays + a.currentLoad.weekNights;
      const bTotal = b.currentLoad.weekDays + b.currentLoad.weekNights;
      return aTotal - bTotal;
    });
  }, [availabilities, searchTerm, filterAvailableOnly]);

  const availableCount = availabilities.filter(a => a.isAvailable).length;

  const handleAssign = (providerId: string) => {
    if (selectedSlot) {
      assignShift(selectedSlot.id, providerId);
      onAssign?.(selectedSlot.id, providerId);
    }
  };

  if (!isOpen) return null;

  const panelContent = (
    <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {activeViewMode === 'slot' ? 'Available Providers' : 'Staff Dashboard'}
            </h2>
            {selectedSlot && activeViewMode === 'slot' && (
              <p className="text-sm text-slate-500">
                {selectedSlot.serviceLocation} • {format(parseISO(selectedSlot.date), "MMM d")}
              </p>
            )}
            {activeViewMode === 'dashboard' && (
              <p className="text-sm text-slate-500">
                {format(parseISO(today), "EEEE, MMM d")}
              </p>
            )}
          </div>
        </div>
        {displayMode === "drawer" && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mt-4">
        {canShowSlotView && (
          <button
            type="button"
            onClick={() => setViewMode('slot')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              viewMode === 'slot' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Slot View
          </button>
        )}
        <button
          type="button"
          onClick={() => setViewMode('dashboard')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            activeViewMode === 'dashboard' 
              ? 'bg-indigo-600 text-white' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Dashboard
        </button>
      </div>

      {activeViewMode === 'dashboard' && (
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-success/10 text-success rounded-lg text-xs font-medium">
            <span className={`w-2 h-2 rounded-full ${getStatusColor('AVAILABLE')}`} />
            {statusCounts.AVAILABLE} Available
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary rounded-lg text-xs font-medium">
            <span className={`w-2 h-2 rounded-full ${getStatusColor('ON_SHIFT')}`} />
            {statusCounts.ON_SHIFT} On Shift
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-warning/10 text-warning rounded-lg text-xs font-medium">
            <span className={`w-2 h-2 rounded-full ${getStatusColor('ON_LEAVE')}`} />
            {statusCounts.ON_LEAVE} On Leave
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
            <span className={`w-2 h-2 rounded-full ${getStatusColor('ON_CALL')}`} />
            {statusCounts.ON_CALL} On Call
          </div>
        </div>
      )}

      {activeViewMode === 'slot' && (
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium">
            <Check className="w-4 h-4" />
            {availableCount} available
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium">
            <Users className="w-4 h-4" />
            {providers.length} total
          </div>
        </div>
      )}
    </div>
  );

  const filterContent = (
    <div className="p-4 border-b border-slate-100 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder={activeViewMode === 'dashboard' ? "Search staff..." : "Search providers..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      {activeViewMode === 'dashboard' && (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ProviderStatus | 'ALL')}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
          >
            <option value="ALL">All Status</option>
            <option value="AVAILABLE">Available</option>
            <option value="ON_SHIFT">On Shift</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="ON_CALL">On Call</option>
          </select>
          
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setDashboardView('grid')}
              className={`p-1.5 ${dashboardView === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-500'}`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setDashboardView('list')}
              className={`p-1.5 ${dashboardView === 'list' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-500'}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {activeViewMode === 'slot' && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filterAvailableOnly}
            onChange={(e) => setFilterAvailableOnly(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-slate-600">Show available only</span>
        </label>
      )}
    </div>
  );

  const dashboardContent = (
    <div className="flex-1 overflow-y-auto p-4">
      <div className={dashboardView === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2'}>
        {filteredDashboardStatuses.map(({ provider, status }) => (
          <motion.div
            key={provider.id}
            layout
            className={`p-3 rounded-xl border ${
              dashboardView === 'grid' 
                ? 'bg-white border-slate-200' 
                : 'bg-white border-slate-200 flex items-center justify-between'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
              <span className="font-medium text-slate-900">{provider.name}</span>
            </div>
            <span className="text-xs text-slate-500">{getStatusLabel(status)}</span>
          </motion.div>
        ))}
        {filteredDashboardStatuses.length === 0 && (
          <div className="col-span-2 text-center py-8 text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No staff match your filters</p>
          </div>
        )}
      </div>
    </div>
  );

  const slotListContent = (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="space-y-3">
        {filteredAvailabilities.map(({ provider, isAvailable, currentLoad, hasSkill, conflicts }) => {
          const totalLoad = currentLoad.weekDays + currentLoad.weekendDays + currentLoad.weekNights + currentLoad.weekendNights;
          const targetTotal = provider.targetWeekDays + provider.targetWeekendDays + provider.targetWeekNights;
          const loadPercentage = targetTotal > 0 ? (totalLoad / targetTotal) * 100 : 0;

          return (
            <motion.div
              key={provider.id}
              layout
              className={`p-4 rounded-xl border transition-all ${
                isAvailable 
                  ? 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm' 
                  : 'bg-slate-50 border-slate-200 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                    {provider.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{provider.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {isAvailable ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                          <Check className="w-3 h-3" />
                          Available
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-rose-600 font-medium">
                          <AlertCircle className="w-3 h-3" />
                          Unavailable
                        </span>
                      )}
                      {!hasSkill && (
                        <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                          Skill mismatch
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {isAvailable && (
                  <button
                    type="button"
                    onClick={() => handleAssign(provider.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Assign
                  </button>
                )}
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-500">Weekly Load</span>
                  <span className={`font-medium ${
                    loadPercentage >= 100 ? 'text-rose-600' :
                    loadPercentage >= 80 ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {totalLoad}/{targetTotal} shifts
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      loadPercentage >= 100 ? 'bg-rose-500' :
                      loadPercentage >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, loadPercentage)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Days: {currentLoad.weekDays}/{provider.targetWeekDays}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Nights: {currentLoad.weekNights}/{provider.targetWeekNights}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {provider.skills.slice(0, 3).map((skill) => (
                  <span
                    key={skill}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      skill === selectedSlot?.requiredSkill
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {skill}
                  </span>
                ))}
              </div>

              {!isAvailable && conflicts.length > 0 && (
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Conflicts:</p>
                  <ul className="space-y-1">
                    {conflicts.map((conflict) => (
                      <li key={conflict} className="flex items-center gap-1 text-xs text-rose-600">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        {conflict}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          );
        })}

        {filteredAvailabilities.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No providers match your search</p>
          </div>
        )}
      </div>
    </div>
  );

  const content = (
    <>
      {panelContent}
      {filterContent}
      {activeViewMode === 'dashboard' ? dashboardContent : slotListContent}
    </>
  );

  if (displayMode === "inline") {
    return (
      <section className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        {content}
      </section>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
          >
            {content}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
