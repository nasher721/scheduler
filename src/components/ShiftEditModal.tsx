import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useScheduleStore, type Provider } from "../store";
import { format, parseISO } from "date-fns";
import {
  X,
  Calendar,
  User,
  MapPin,
  Clock,
  AlertTriangle,
  Users,
  Trash2,
  Plus,
  ChevronDown,
} from "lucide-react";

interface ShiftEditModalProps {
  /** ID of the slot to edit — we read the live slot from the store so we never work on stale data */
  slotId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ShiftEditModal({ slotId, isOpen, onClose }: ShiftEditModalProps) {
  // ── Live slot from the store (always up-to-date) ──────────────────────
  const slot = useScheduleStore((s) => s.slots.find((sl) => sl.id === slotId) ?? null);
  const providers = useScheduleStore((s) => s.providers);
  const assignShift = useScheduleStore((s) => s.assignShift);

  const [searchTerm, setSearchTerm] = useState("");
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);
  const [listExpanded, setListExpanded] = useState(true);

  if (!isOpen || !slot) return null;

  const currentProvider = providers.find((p) => p.id === slot.providerId);
  const secondaryProviders = (slot.secondaryProviderIds ?? [])
    .map((id) => providers.find((p) => p.id === id))
    .filter((p): p is Provider => Boolean(p));

  const filteredProviders = providers.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const notAlreadyAssigned =
      p.id !== slot.providerId && !(slot.secondaryProviderIds ?? []).includes(p.id);
    return matchesSearch && notAlreadyAssigned;
  });

  const handleAssignProvider = (providerId: string) => {
    assignShift(slot.id, providerId);
    setSearchTerm("");
    setShowConfirmRemove(false);
  };

  const handleAddSecondaryProvider = (providerId: string) => {
    const current = slot.secondaryProviderIds ?? [];
    if (!current.includes(providerId)) {
      useScheduleStore.setState((state) => ({
        slots: state.slots.map((s) =>
          s.id === slot.id
            ? { ...s, secondaryProviderIds: [...current, providerId], isSharedAssignment: true }
            : s
        ),
      }));
    }
    setSearchTerm("");
  };

  const handleRemoveSecondaryProvider = (providerId: string) => {
    const updated = (slot.secondaryProviderIds ?? []).filter((id) => id !== providerId);
    useScheduleStore.setState((state) => ({
      slots: state.slots.map((s) =>
        s.id === slot.id
          ? { ...s, secondaryProviderIds: updated, isSharedAssignment: updated.length > 0 }
          : s
      ),
    }));
  };

  const handleClearAssignment = () => {
    assignShift(slot.id, null);
    setShowConfirmRemove(false);
  };

  const shiftTypeLabels: Record<string, string> = {
    DAY: "Day Shift",
    NIGHT: "Night Shift",
    NMET: "NMET",
    JEOPARDY: "Jeopardy",
    RECOVERY: "Recovery",
    CONSULTS: "Consults",
    VACATION: "Vacation",
  };

  const priorityColors: Record<string, { bg: string; border: string; text: string }> = {
    CRITICAL: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700" },
    STANDARD: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
    FLEXIBLE: { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700" },
  };

  const priorityConfig = priorityColors[slot.servicePriority] ?? priorityColors.FLEXIBLE;

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

          {/* Modal — pointer-events-none on wrapper, auto on inner panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
          >
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden pointer-events-auto flex flex-col">
              {/* Header */}
              <div className={`p-6 border-b ${priorityConfig.border} ${priorityConfig.bg} flex-shrink-0`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full border ${priorityConfig.border} ${priorityConfig.text}`}>
                        {slot.servicePriority} Priority
                      </span>
                      {slot.isSharedAssignment && (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                          Shared
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">
                      {shiftTypeLabels[slot.type] ?? slot.type}
                    </h2>
                    <p className="text-slate-500 flex items-center gap-2 mt-1">
                      <Calendar className="w-4 h-4" />
                      {format(parseISO(slot.date), "EEEE, MMMM d, yyyy")}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    title="Close"
                    className="p-2 hover:bg-black/5 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="flex items-center gap-4 mt-4 text-sm">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <MapPin className="w-4 h-4" />
                    {slot.location}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Clock className="w-4 h-4" />
                    {slot.type === "NIGHT" ? "7:00 PM – 7:00 AM" : "7:00 AM – 7:00 PM"}
                  </div>
                </div>
              </div>

              {/* Scrollable content */}
              <div className="p-6 overflow-y-auto flex-1">
                {/* Current Assignment */}
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                    Current Assignment
                  </h3>

                  {currentProvider ? (
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                          {currentProvider.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{currentProvider.name}</p>
                          <p className="text-sm text-slate-500">Primary Provider</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowConfirmRemove(true)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors flex-shrink-0"
                          title="Remove assignment"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Secondary Providers */}
                      {secondaryProviders.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <p className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Secondary Providers
                          </p>
                          <div className="space-y-2">
                            {secondaryProviders.map((provider) => (
                              <div
                                key={provider.id}
                                className="flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-200"
                              >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                  {provider.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="flex-1 font-medium text-slate-700 truncate">
                                  {provider.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSecondaryProvider(provider.id)}
                                  title="Remove secondary provider"
                                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-amber-900">Unassigned</p>
                          <p className="text-sm text-amber-700">
                            {slot.servicePriority === "CRITICAL"
                              ? "This shift requires staffing"
                              : "No provider assigned"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Confirm Remove */}
                  <AnimatePresence>
                    {showConfirmRemove && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 p-4 bg-rose-50 rounded-xl border border-rose-200"
                      >
                        <p className="text-sm text-rose-700 mb-3">
                          Remove this assignment?
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleClearAssignment}
                            className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors"
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowConfirmRemove(false)}
                            className="px-4 py-2 bg-white text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors border border-slate-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Search + Provider List */}
                <div>
                  <button
                    type="button"
                    onClick={() => setListExpanded((v) => !v)}
                    className="w-full flex items-center justify-between mb-3"
                  >
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                      {currentProvider ? "Add Secondary Provider" : "Assign Provider"}
                    </h3>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform ${listExpanded ? "rotate-180" : ""}`}
                    />
                  </button>

                  <AnimatePresence>
                    {listExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <div className="relative mb-3">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search providers…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                          />
                        </div>

                        {/* Provider List */}
                        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                          {filteredProviders.length === 0 ? (
                            <p className="text-center text-slate-400 py-4 text-sm">
                              {searchTerm ? "No providers match your search" : "All providers already assigned"}
                            </p>
                          ) : (
                            filteredProviders.slice(0, 15).map((provider) => (
                              <button
                                key={provider.id}
                                type="button"
                                onClick={() =>
                                  currentProvider
                                    ? handleAddSecondaryProvider(provider.id)
                                    : handleAssignProvider(provider.id)
                                }
                                className="w-full flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-left group"
                              >
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                                  {provider.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-slate-900 truncate">{provider.name}</p>
                                  <p className="text-xs text-slate-500 truncate">
                                    {provider.skills.slice(0, 3).join(", ")}
                                  </p>
                                </div>
                                <Plus className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors flex-shrink-0" />
                              </button>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center flex-shrink-0">
                <div className="text-xs text-slate-400">
                  {currentProvider
                    ? `Assigned: ${currentProvider.name}${secondaryProviders.length > 0 ? ` + ${secondaryProviders.length} more` : ""}`
                    : "Click a provider to assign"}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
