import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useScheduleStore, type ShiftSlot, type Provider } from "../store";
import { format, parseISO } from "date-fns";
import { 
  CheckSquare, 
  X,
  ArrowRight,
  AlertTriangle,
  Check,
  RotateCcw,
  Search,
  Calendar
} from "lucide-react";

interface BulkAssignmentModeProps {
  isOpen: boolean;
  onClose: () => void;
  slots: ShiftSlot[];
}

export function BulkAssignmentMode({ isOpen, onClose, slots }: BulkAssignmentModeProps) {
  const { providers, assignShift } = useScheduleStore();
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUnfilledOnly, setFilterUnfilledOnly] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Get unfilled slots sorted by date
  const availableSlots = useMemo(() => {
    let filtered = slots
      .filter(s => !filterUnfilledOnly || !s.providerId)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.serviceLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.date.includes(searchTerm)
      );
    }

    return filtered;
  }, [slots, filterUnfilledOnly, searchTerm]);

  const selectedSlotDetails = useMemo(() => {
    return availableSlots.filter(s => selectedSlots.has(s.id));
  }, [availableSlots, selectedSlots]);

  const toggleSlot = (slotId: string) => {
    const newSelected = new Set(selectedSlots);
    if (newSelected.has(slotId)) {
      newSelected.delete(slotId);
    } else {
      newSelected.add(slotId);
    }
    setSelectedSlots(newSelected);
  };

  const selectAll = () => {
    setSelectedSlots(new Set(availableSlots.map(s => s.id)));
  };

  const deselectAll = () => {
    setSelectedSlots(new Set());
  };

  const getEligibleCount = (provider: Provider) => {
    return selectedSlotDetails.filter(slot => {
      // Basic eligibility check
      if (provider.timeOffRequests.some(r => r.date === slot.date)) return false;
      if (!provider.skills.includes(slot.requiredSkill)) return false;
      return true;
    }).length;
  };

  const handleAssign = async () => {
    if (!selectedProvider || selectedSlots.size === 0) return;

    setAssigning(true);
    
    // Small delay to show the assigning state
    await new Promise(resolve => setTimeout(resolve, 500));

    let assigned = 0;
    let failed = 0;

    selectedSlotDetails.forEach(slot => {
      const canAssign = selectedProvider && 
        !selectedProvider.timeOffRequests.some((r: { date: string }) => r.date === slot.date) && 
        selectedProvider.skills.includes(slot.requiredSkill);
      if (canAssign) {
        assignShift(slot.id, selectedProvider.id);
        assigned++;
      } else {
        failed++;
      }
    });

    setAssigning(false);
    setCompleted(true);

    // Reset after showing completion
    setTimeout(() => {
      setCompleted(false);
      setSelectedSlots(new Set());
      setSelectedProvider(null);
      setShowPreview(false);
    }, 2000);
  };

  const groupedByDate = useMemo(() => {
    const grouped = new Map<string, ShiftSlot[]>();
    availableSlots.forEach(slot => {
      const existing = grouped.get(slot.date) || [];
      existing.push(slot);
      grouped.set(slot.date, existing);
    });
    return grouped;
  }, [availableSlots]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-4 md:inset-10 bg-white rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-100 rounded-xl text-blue-600">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Bulk Assignment</h2>
                    <p className="text-sm text-slate-500">
                      {selectedSlots.size} shifts selected
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={selectAll}
                  className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Deselect All
                </button>
                <label className="flex items-center gap-2 ml-auto cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterUnfilledOnly}
                    onChange={(e) => setFilterUnfilledOnly(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-600">Unfilled only</span>
                </label>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Left: Shift Selection */}
              <div className="w-1/2 border-r border-slate-200 flex flex-col">
                {/* Search */}
                <div className="p-4 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search shifts..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>

                {/* Shift List */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-4">
                    {Array.from(groupedByDate.entries()).map(([date, dateSlots]) => (
                      <div key={date}>
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 sticky top-0 bg-white py-1">
                          {format(parseISO(date), "EEEE, MMMM d")}
                        </h3>
                        <div className="space-y-2">
                          {dateSlots.map((slot) => (
                            <label
                              key={slot.id}
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                selectedSlots.has(slot.id)
                                  ? 'bg-blue-50 border-blue-300'
                                  : 'bg-white border-slate-200 hover:border-blue-200'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                selectedSlots.has(slot.id)
                                  ? 'bg-blue-500 border-blue-500'
                                  : 'border-slate-300'
                              }`}>
                                {selectedSlots.has(slot.id) && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <input
                                type="checkbox"
                                checked={selectedSlots.has(slot.id)}
                                onChange={() => toggleSlot(slot.id)}
                                className="sr-only"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-slate-400" />
                                  <span className="font-medium text-slate-900">{slot.serviceLocation}</span>
                                  <span className="text-xs text-slate-500">({slot.type})</span>
                                </div>
                                {slot.providerId && (
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    Currently: {providers.find(p => p.id === slot.providerId)?.name || 'Unknown'}
                                  </p>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}

                    {availableSlots.length === 0 && (
                      <div className="text-center py-8 text-slate-400">
                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No shifts match your criteria</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Provider Selection */}
              <div className="w-1/2 flex flex-col bg-slate-50/50">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900 mb-3">
                    {showPreview ? 'Assignment Preview' : 'Select Provider'}
                  </h3>

                  {!showPreview ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {providers.map((provider) => {
                        const eligibleCount = getEligibleCount(provider);
                        const isSelected = selectedProvider?.id === provider.id;

                        return (
                          <button
                            key={provider.id}
                            onClick={() => setSelectedProvider(provider)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                              isSelected
                                ? 'bg-blue-100 border-blue-300'
                                : 'bg-white border-slate-200 hover:border-blue-200'
                            }`}
                          >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                              {provider.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-slate-900">{provider.name}</p>
                              <p className="text-xs text-slate-500">
                                {provider.skills.slice(0, 2).join(", ")}
                              </p>
                            </div>
                            <div className={`text-right ${eligibleCount > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                              <p className="text-lg font-bold">{eligibleCount}</p>
                              <p className="text-xs">eligible</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-4 bg-white rounded-xl border border-slate-200">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                            {selectedProvider?.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{selectedProvider?.name}</p>
                            <p className="text-sm text-slate-500">
                              Will be assigned to {selectedSlotDetails.length} shifts
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {selectedSlotDetails.map((slot) => {
                            const canAssign = selectedProvider 
                              ? !selectedProvider.timeOffRequests.some((r: { date: string }) => r.date === slot.date) && 
                                selectedProvider.skills.includes(slot.requiredSkill)
                              : false;
                          const reason = !selectedProvider ? 'No provider selected' : 
                                         selectedProvider.timeOffRequests.some((r: { date: string }) => r.date === slot.date) ? 'Time off conflict' :
                                         !selectedProvider.skills.includes(slot.requiredSkill) ? 'Missing skill' : '';

                            return (
                              <div
                                key={slot.id}
                                className={`flex items-center justify-between p-2 rounded-lg ${
                                  canAssign ? 'bg-emerald-50' : 'bg-rose-50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {canAssign ? (
                                    <Check className="w-4 h-4 text-emerald-600" />
                                  ) : (
                                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                                  )}
                                  <span className="text-sm">
                                    {slot.serviceLocation} • {format(parseISO(slot.date), "MMM d")}
                                  </span>
                                </div>
                                {!canAssign && (
                                  <span className="text-xs text-rose-600">{reason}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <button
                        onClick={() => setShowPreview(false)}
                        className="w-full py-2 text-sm text-slate-600 hover:text-slate-800"
                      >
                        ← Back to provider selection
                      </button>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="mt-auto p-4 border-t border-slate-200 bg-white">
                  {!showPreview ? (
                    <button
                      onClick={() => setShowPreview(true)}
                      disabled={!selectedProvider || selectedSlots.size === 0}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Preview Assignment
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleAssign}
                      disabled={assigning || completed}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${
                        completed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      } disabled:opacity-50`}
                    >
                      {assigning ? (
                        <>
                          <RotateCcw className="w-4 h-4 animate-spin" />
                          Assigning...
                        </>
                      ) : completed ? (
                        <>
                          <Check className="w-4 h-4" />
                          Assigned Successfully!
                        </>
                      ) : (
                        <>
                          <CheckSquare className="w-4 h-4" />
                          Confirm Assignment
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
