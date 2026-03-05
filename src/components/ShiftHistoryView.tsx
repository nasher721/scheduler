import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useScheduleStore, type AuditLogEntry } from "../store";
import { format, parseISO } from "date-fns";
import { 
  History, 
  X,
  UserPlus,
  UserMinus,
  RefreshCw,
  Trash2,
  Filter,
  Search,
  Calendar,
  Clock,
  ChevronDown,
  FileText
} from "lucide-react";

interface ShiftHistoryViewProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSlotId?: string | null;
}

type ActionType = 'ASSIGN' | 'UNASSIGN' | 'AUTO_ASSIGN' | 'CLEAR' | 'RULE_CHANGE' | 'ALL';

const actionConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  ASSIGN: {
    icon: <UserPlus className="w-4 h-4" />,
    color: 'text-emerald-600 bg-emerald-100',
    label: 'Assigned'
  },
  UNASSIGN: {
    icon: <UserMinus className="w-4 h-4" />,
    color: 'text-rose-600 bg-rose-100',
    label: 'Unassigned'
  },
  AUTO_ASSIGN: {
    icon: <RefreshCw className="w-4 h-4" />,
    color: 'text-blue-600 bg-blue-100',
    label: 'Auto-assigned'
  },
  CLEAR: {
    icon: <Trash2 className="w-4 h-4" />,
    color: 'text-slate-600 bg-slate-100',
    label: 'Cleared'
  },
  RULE_CHANGE: {
    icon: <FileText className="w-4 h-4" />,
    color: 'text-amber-600 bg-amber-100',
    label: 'Rule Change'
  }
};

export function ShiftHistoryView({ isOpen, onClose, selectedSlotId }: ShiftHistoryViewProps) {
  const { auditLog, slots, providers } = useScheduleStore();
  const [filterAction, setFilterAction] = useState<ActionType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    let filtered = [...auditLog];

    // Filter by slot if specified
    if (selectedSlotId) {
      filtered = filtered.filter(entry => entry.slotId === selectedSlotId);
    }

    // Filter by action type
    if (filterAction !== 'ALL') {
      filtered = filtered.filter(entry => entry.action === filterAction);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.details.toLowerCase().includes(term) ||
        entry.user?.toLowerCase().includes(term) ||
        entry.action.toLowerCase().includes(term)
      );
    }

    // Sort by timestamp (newest first)
    return filtered.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [auditLog, selectedSlotId, filterAction, searchTerm]);

  // Group by date
  const groupedEntries = useMemo(() => {
    const grouped = new Map<string, AuditLogEntry[]>();
    filteredEntries.forEach(entry => {
      const date = format(parseISO(entry.timestamp), "yyyy-MM-dd");
      const existing = grouped.get(date) || [];
      existing.push(entry);
      grouped.set(date, existing);
    });
    return grouped;
  }, [filteredEntries]);

  const toggleExpand = (entryId: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedEntries(newExpanded);
  };

  const getSlotDetails = (slotId?: string) => {
    if (!slotId) return null;
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return null;
    return {
      ...slot,
      providerName: providers.find(p => p.id === slot.providerId)?.name || 'Unassigned'
    };
  };

  const getProviderName = (providerId?: string) => {
    if (!providerId) return 'Unknown';
    return providers.find(p => p.id === providerId)?.name || 'Unknown';
  };

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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 md:inset-10 bg-white rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {selectedSlotId ? 'Shift History' : 'Audit Log'}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {filteredEntries.length} entries
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

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 mt-4">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search history..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                {/* Action Filter */}
                <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={filterAction}
                    onChange={(e) => setFilterAction(e.target.value as ActionType)}
                    className="bg-transparent border-none text-sm text-slate-700 focus:outline-none"
                  >
                    <option value="ALL">All Actions</option>
                    <option value="ASSIGN">Assignments</option>
                    <option value="UNASSIGN">Unassignments</option>
                    <option value="AUTO_ASSIGN">Auto-assignments</option>
                    <option value="CLEAR">Clearances</option>
                    <option value="RULE_CHANGE">Rule Changes</option>
                  </select>
                </div>
              </div>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {Array.from(groupedEntries.entries()).map(([date, entries]) => (
                  <div key={date}>
                    {/* Date Header */}
                    <div className="flex items-center gap-3 mb-3 sticky top-0 bg-white py-2 z-10">
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">
                          {format(parseISO(date), "EEEE, MMMM d, yyyy")}
                        </span>
                      </div>
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-xs text-slate-400">{entries.length} entries</span>
                    </div>

                    {/* Entries */}
                    <div className="space-y-2">
                      {entries.map((entry) => {
                        const config = actionConfig[entry.action] || actionConfig.CLEAR;
                        const isExpanded = expandedEntries.has(entry.id);
                        const slotDetails = getSlotDetails(entry.slotId);

                        return (
                          <motion.div
                            key={entry.id}
                            layout
                            className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors"
                          >
                            <button
                              onClick={() => toggleExpand(entry.id)}
                              className="w-full p-4 flex items-start gap-3 text-left"
                            >
                              <div className={`p-2 rounded-lg ${config.color}`}>
                                {config.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${config.color} mb-1`}>
                                      {config.label}
                                    </span>
                                    <p className="text-sm text-slate-900">{entry.details}</p>
                                  </div>
                                  <ChevronDown 
                                    className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  />
                                </div>
                                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {format(parseISO(entry.timestamp), "h:mm a")}
                                  </span>
                                  {entry.user && (
                                    <span>by {entry.user}</span>
                                  )}
                                </div>
                              </div>
                            </button>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="border-t border-slate-100 bg-slate-50/50"
                                >
                                  <div className="p-4 space-y-3">
                                    {/* Entry Details */}
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                      <div>
                                        <span className="text-slate-500">Action ID:</span>
                                        <p className="font-mono text-xs mt-0.5">{entry.id}</p>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">Timestamp:</span>
                                        <p className="mt-0.5">{format(parseISO(entry.timestamp), "MMM d, yyyy 'at' h:mm:ss a")}</p>
                                      </div>
                                    </div>

                                    {/* Slot Details */}
                                    {slotDetails && (
                                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                                        <p className="text-xs font-medium text-slate-500 mb-2">Shift Details:</p>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                          <div>
                                            <span className="text-slate-500">Location:</span>
                                            <p>{slotDetails.serviceLocation}</p>
                                          </div>
                                          <div>
                                            <span className="text-slate-500">Date:</span>
                                            <p>{format(parseISO(slotDetails.date), "MMM d, yyyy")}</p>
                                          </div>
                                          <div>
                                            <span className="text-slate-500">Type:</span>
                                            <p>{slotDetails.type}</p>
                                          </div>
                                          <div>
                                            <span className="text-slate-500">Current Provider:</span>
                                            <p>{slotDetails.providerName}</p>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Provider Details */}
                                    {entry.providerId && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-slate-500">Provider:</span>
                                        <span className="text-sm font-medium">
                                          {getProviderName(entry.providerId)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {filteredEntries.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <History className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">No History Found</h3>
                    <p className="text-slate-500 mt-1">
                      {searchTerm || filterAction !== 'ALL' 
                        ? 'Try adjusting your filters'
                        : 'No audit entries recorded yet'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Quick history button for shift cards
export function ShiftHistoryButton({ slotId, onClick }: { slotId: string; onClick: () => void }) {
  const { auditLog } = useScheduleStore();
  const entryCount = auditLog.filter(e => e.slotId === slotId).length;

  if (entryCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-full hover:bg-slate-200 transition-colors"
      title="View shift history"
    >
      <History className="w-3 h-3" />
      {entryCount} changes
    </button>
  );
}
