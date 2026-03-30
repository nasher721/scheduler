import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useBroadcast } from "@/hooks/useBroadcast";
import { useScheduleStore } from "@/store";
import { format, parseISO } from "date-fns";
import type { BroadcastChannel, MarketplaceShift, ShiftSlot, Provider } from "@/types";
import {
  Send,
  Loader2,
  AlertCircle,
  MessageSquare,
  Mail,
  Bell,
  X,
  Users,
  Clock,
  Zap
} from "lucide-react";

interface BroadcastPanelProps {
  shift: MarketplaceShift | null;
  isOpen: boolean;
  onClose: () => void;
  onBroadcastSuccess?: (shiftId: string) => void;
}

const CHANNEL_OPTIONS: { value: BroadcastChannel; label: string; icon: typeof MessageSquare }[] = [
  { value: "sms", label: "SMS", icon: MessageSquare },
  { value: "email", label: "Email", icon: Mail },
  { value: "push", label: "Push", icon: Bell },
];

export function BroadcastPanel({ shift, isOpen, onClose, onBroadcastSuccess }: BroadcastPanelProps) {
  const store = useScheduleStore();
  const { dispatch, isDispatching, error } = useBroadcast();
  
  const [selectedChannel, setSelectedChannel] = useState<BroadcastChannel>("sms");
  const [isExpanded, setIsExpanded] = useState(false);

  const slot = useMemo(() => {
    if (!shift) return null;
    return store.slots.find((s: ShiftSlot) => s.id === shift.slotId) || null;
  }, [shift, store.slots]);

  const eligibleProviders = useMemo(() => {
    if (!slot) return [];
    return store.providers.filter((provider: Provider) => {
      const hasSkill = Array.isArray(provider.skills) 
        ? provider.skills.includes(slot.requiredSkill) 
        : true;
      const isOff = Array.isArray(provider.timeOffRequests)
        ? provider.timeOffRequests.some((request: { date: string }) => request?.date === slot.date)
        : false;
      return hasSkill && !isOff;
    });
  }, [slot, store.providers]);

  const shiftDate = slot ? format(parseISO(slot.date), "EEE, MMM d") : "";
  const shiftTime = slot?.type || "";

  const handleDispatch = async () => {
    if (!shift || eligibleProviders.length === 0) return;
    
    try {
      await dispatch(shift.id, selectedChannel, eligibleProviders.map((p: Provider) => p.id));
      onBroadcastSuccess?.(shift.id);
      store.showToast({
        type: "success",
        title: "Broadcast Sent",
        message: `Notified ${eligibleProviders.length} providers via ${selectedChannel}`,
      });
    } catch {
      store.showToast({
        type: "error",
        title: "Broadcast Failed",
        message: error || "Failed to send broadcast",
      });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && shift && (
        <>
          <motion.button
            type="button"
            aria-label="Close broadcast panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[55] bg-slate-900/40"
            onClick={onClose}
          />
          
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="broadcast-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed top-0 right-0 z-[60] flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-orange-50">
                  <Zap className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h2 id="broadcast-title" className="text-lg font-bold text-slate-900">
                    Broadcast Alert
                  </h2>
                  <p className="text-sm text-slate-500">
                    {shiftTime} • {shiftDate}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Coverage Status</span>
                  {shift.lifecycleState === "POSTED" && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Waiting
                    </span>
                  )}
                  {shift.lifecycleState === "BROADCASTING" && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      Active
                    </span>
                  )}
                  {shift.lifecycleState === "CLAIMED" && (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Claimed
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span>{eligibleProviders.length} eligible</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4 text-slate-400" />
                    <span>{shift.broadcastRecipients.length} notified</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-sm font-medium text-slate-700">
                  Notification Channel
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {CHANNEL_OPTIONS.map((channel) => (
                    <button
                      key={channel.value}
                      type="button"
                      onClick={() => setSelectedChannel(channel.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-all",
                        selectedChannel === channel.value
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <channel.icon className="h-5 w-5" />
                      <span className="text-sm font-medium">{channel.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex w-full items-center justify-between text-sm font-medium text-slate-700 hover:text-slate-900"
                >
                  <span>Eligible Providers ({eligibleProviders.length})</span>
                  <span className={cn("transition-transform", isExpanded && "rotate-180")}>
                    ▼
                  </span>
                </button>
                
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-200 max-h-48 overflow-y-auto">
                        {eligibleProviders.map((provider: Provider) => (
                          <div
                            key={provider.id}
                            className="flex items-center gap-2 px-3 py-2"
                          >
                            <div className="h-6 w-6 rounded-full bg-slate-300 flex items-center justify-center text-xs font-medium text-slate-600">
                              {provider.name.charAt(0)}
                            </div>
                            <span className="text-sm text-slate-700">{provider.name}</span>
                          </div>
                        ))}
                        {eligibleProviders.length === 0 && (
                          <div className="px-3 py-4 text-center text-sm text-slate-500">
                            No eligible providers found
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Error</p>
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 p-4">
              <button
                type="button"
                onClick={handleDispatch}
                disabled={isDispatching || eligibleProviders.length === 0}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all",
                  eligibleProviders.length === 0
                    ? "cursor-not-allowed bg-slate-100 text-slate-400"
                    : "bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700"
                )}
              >
                {isDispatching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Dispatch to {eligibleProviders.length} Providers</span>
                  </>
                )}
              </button>
              
              {eligibleProviders.length > 0 && (
                <p className="mt-2 text-center text-xs text-slate-500">
                  <Clock className="inline h-3 w-3 mr-0.5" />
                  Recipients will be notified immediately via {selectedChannel}
                </p>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
