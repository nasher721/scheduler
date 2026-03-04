import { useState } from "react";
import { useScheduleStore, type ShiftSlot, type Provider, type TimeOffRequest } from "../store";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRightLeft, Check, X, AlertCircle, User, Calendar, RotateCcw } from "lucide-react";
import { format, parseISO } from "date-fns";

interface SwapValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateSwapRequest(
  requestor: Provider,
  target: Provider | undefined,
  fromSlot: ShiftSlot | undefined,
  toSlot: ShiftSlot | undefined,
  allSlots: ShiftSlot[]
): SwapValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!fromSlot) {
    errors.push("Source shift not found");
    return { valid: false, errors, warnings };
  }

  if (!toSlot) {
    errors.push("Target shift not found");
    return { valid: false, errors, warnings };
  }

  // Check if requestor is actually assigned to the fromSlot
  if (fromSlot.providerId !== requestor.id) {
    errors.push(`${requestor.name} is not assigned to the source shift`);
  }

  // Check if target is assigned to the toSlot (if target specified)
  if (target && toSlot.providerId !== target.id) {
    errors.push(`${target.name} is not assigned to the target shift`);
  }

  // Check skills compatibility
  if (!requestor.skills.includes(toSlot.requiredSkill)) {
    errors.push(`${requestor.name} lacks required skill: ${toSlot.requiredSkill}`);
  }

  if (target && !target.skills.includes(fromSlot.requiredSkill)) {
    errors.push(`${target.name} lacks required skill: ${fromSlot.requiredSkill}`);
  }

  // Check time-off conflicts
  if (requestor.timeOffRequests.some((r: TimeOffRequest) => r.date === toSlot.date)) {
    errors.push(`${requestor.name} has time-off on ${toSlot.date}`);
  }

  if (target?.timeOffRequests.some((r: TimeOffRequest) => r.date === fromSlot.date)) {
    errors.push(`${target.name} has time-off on ${fromSlot.date}`);
  }

  // Check scheduling restrictions
  if (requestor.schedulingRestrictions?.noNights && toSlot.type === "NIGHT") {
    errors.push(`${requestor.name} is restricted from night shifts`);
  }

  if (target?.schedulingRestrictions?.noNights && fromSlot.type === "NIGHT") {
    errors.push(`${target.name} is restricted from night shifts`);
  }

  // Check for consecutive shifts after swap
  const requestorOtherShifts = allSlots.filter(s =>
    s.providerId === requestor.id &&
    s.date !== fromSlot.date &&
    Math.abs(parseISO(s.date).getTime() - parseISO(toSlot.date).getTime()) < 2 * 24 * 60 * 60 * 1000
  );

  if (requestorOtherShifts.length > 0) {
    warnings.push(`${requestor.name} has other shifts near this date`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function SwapManager() {
  const {
    providers,
    slots,
    swapRequests,
    createSwapRequest,
    approveSwapRequest,
    rejectSwapRequest,
    currentUser
  } = useScheduleStore();

  const [isCreating, setIsCreating] = useState(false);
  const [selectedRequestor, setSelectedRequestor] = useState<string>("");
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const isScheduler = currentUser?.role === "ADMIN" || currentUser?.role === "SCHEDULER";

  const filteredRequests = swapRequests.filter(r => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  const handleCreateRequest = () => {
    if (!selectedRequestor || !fromDate || !toDate) return;

    const requestor = providers.find(p => p.id === selectedRequestor);
    const target = selectedTarget ? providers.find(p => p.id === selectedTarget) : undefined;

    if (!requestor) return;

    // Find the slots
    const fromSlot = slots.find(s => s.date === fromDate && s.providerId === requestor.id);
    const toSlot = slots.find(s => s.date === toDate && (target ? s.providerId === target.id : true));

    const validation = validateSwapRequest(requestor, target, fromSlot, toSlot, slots);

    createSwapRequest({
      requestorId: selectedRequestor,
      targetProviderId: selectedTarget || undefined,
      fromDate,
      fromShiftType: fromSlot?.type || "DAY",
      toDate,
      toShiftType: toSlot?.type || "DAY",
      notes,
      validationErrors: validation.errors,
    });

    setIsCreating(false);
    setSelectedRequestor("");
    setSelectedTarget("");
    setFromDate("");
    setToDate("");
    setNotes("");
  };

  const getProviderName = (id: string) => providers.find(p => p.id === id)?.name || "Unknown";
  const getProvider = (id: string) => providers.find(p => p.id === id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="satin-panel p-6 bg-white/60 rounded-[2rem] border border-slate-200/40"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-primary/5 rounded-2xl text-primary">
            <ArrowRightLeft className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl font-serif text-slate-900">Swap Management</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
              {swapRequests.filter(r => r.status === "pending").length} Pending Requests
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all"
        >
          Request Swap
        </motion.button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(["all", "pending", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${filter === f
              ? "bg-primary text-white"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
          >
            {f}
            {f === "pending" && swapRequests.filter(r => r.status === "pending").length > 0 && (
              <span className="ml-1.5 bg-error text-white text-[8px] px-1.5 py-0.5 rounded-full">
                {swapRequests.filter(r => r.status === "pending").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Create Request Form */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-200/60 space-y-4">
              <h3 className="text-sm font-bold text-slate-700">New Swap Request</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Requestor</label>
                  <select
                    title="Select Requestor"
                    value={selectedRequestor}
                    onChange={(e) => setSelectedRequestor(e.target.value)}
                    className="w-full bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select provider...</option>
                    {providers.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Target (Optional)</label>
                  <select
                    title="Select Target"
                    value={selectedTarget}
                    onChange={(e) => setSelectedTarget(e.target.value)}
                    className="w-full bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Any provider...</option>
                    {providers.filter(p => p.id !== selectedRequestor).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Your Shift Date</label>
                  <input
                    type="date"
                    title="Your Shift Date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Desired Shift Date</label>
                  <input
                    type="date"
                    title="Desired Shift Date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Reason for swap, special considerations..."
                  className="w-full bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none h-20"
                />
              </div>

              {/* Validation Preview */}
              {selectedRequestor && fromDate && toDate && (
                <div className="p-3 bg-white rounded-xl border border-slate-200/60">
                  {(() => {
                    const requestor = getProvider(selectedRequestor);
                    const target = selectedTarget ? getProvider(selectedTarget) : undefined;
                    const fromSlot = slots.find(s => s.date === fromDate && s.providerId === selectedRequestor);
                    const toSlot = slots.find(s => s.date === toDate && (selectedTarget ? s.providerId === selectedTarget : true));

                    if (!requestor) return null;

                    const validation = validateSwapRequest(requestor, target, fromSlot, toSlot, slots);

                    return (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Validation Check</p>
                        {validation.errors.length > 0 && (
                          <div className="space-y-1">
                            {validation.errors.map((error, i) => (
                              <div key={i} className="flex items-center gap-2 text-[10px] text-error">
                                <AlertCircle className="w-3 h-3" />
                                {error}
                              </div>
                            ))}
                          </div>
                        )}
                        {validation.warnings.length > 0 && (
                          <div className="space-y-1">
                            {validation.warnings.map((warning, i) => (
                              <div key={i} className="flex items-center gap-2 text-[10px] text-warning">
                                <AlertCircle className="w-3 h-3" />
                                {warning}
                              </div>
                            ))}
                          </div>
                        )}
                        {validation.errors.length === 0 && validation.warnings.length === 0 && (
                          <div className="flex items-center gap-2 text-[10px] text-success">
                            <Check className="w-3 h-3" />
                            All checks passed
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRequest}
                  disabled={!selectedRequestor || !fromDate || !toDate}
                  className="bg-primary text-white px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Request
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swap Requests List */}
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
              <RotateCcw className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500">No swap requests</p>
            <p className="text-xs text-slate-400 mt-1">
              {filter === "all" ? "Create a new request to get started" : `No ${filter} requests`}
            </p>
          </div>
        ) : (
          filteredRequests.map((request) => {
            const requestor = getProvider(request.requestorId);
            const target = request.targetProviderId ? getProvider(request.targetProviderId) : undefined;

            return (
              <motion.div
                key={request.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 bg-white/40 rounded-2xl border transition-all ${request.status === "pending" ? "border-warning/30" :
                  request.status === "approved" ? "border-success/30" :
                    request.status === "rejected" ? "border-error/30" :
                      "border-slate-200/40"
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${request.status === "pending" ? "bg-warning/10 text-warning" :
                        request.status === "approved" ? "bg-success/10 text-success" :
                          request.status === "rejected" ? "bg-error/10 text-error" :
                            "bg-slate-100 text-slate-500"
                        }`}>
                        {request.status}
                      </span>
                      <span className="text-[9px] text-slate-400">
                        {format(parseISO(request.requestedAt), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>

                    {/* Swap Details */}
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">{requestor?.name}</span>
                      </div>
                      <ArrowRightLeft className="w-3.5 h-3.5 text-slate-300" />
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">
                          {target?.name || "Any provider"}
                        </span>
                      </div>
                    </div>

                    {/* Shift Details */}
                    <div className="grid grid-cols-2 gap-4 text-[10px] text-slate-500 mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        <span>From: <strong className="text-slate-700">{request.fromDate}</strong> ({request.fromShiftType})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        <span>To: <strong className="text-slate-700">{request.toDate}</strong> ({request.toShiftType})</span>
                      </div>
                    </div>

                    {/* Validation Errors */}
                    {request.validationErrors && request.validationErrors.length > 0 && (
                      <div className="p-2 bg-error/5 rounded-lg border border-error/20 mb-3">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-error mb-1">Issues</p>
                        {request.validationErrors.map((error, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px] text-error">
                            <AlertCircle className="w-3 h-3" />
                            {error}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Notes */}
                    {request.notes && (
                      <p className="text-[10px] text-slate-500 italic">
                        "{request.notes}"
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {request.status === "pending" && isScheduler && (
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => approveSwapRequest(request.id, currentUser!.id)}
                        className="p-2 bg-success/10 text-success rounded-xl hover:bg-success/20 transition-colors"
                        title="Approve Swap"
                      >
                        <Check className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => rejectSwapRequest(request.id, currentUser!.id, "Declined by scheduler")}
                        className="p-2 bg-error/10 text-error rounded-xl hover:bg-error/20 transition-colors"
                        title="Reject Swap"
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    </div>
                  )}

                  {request.status !== "pending" && (
                    <div className="text-[9px] text-slate-400 text-right">
                      {request.resolvedBy && (
                        <p>by {getProviderName(request.resolvedBy)}</p>
                      )}
                      {request.resolvedAt && (
                        <p>{format(parseISO(request.resolvedAt), "MMM d")}</p>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
