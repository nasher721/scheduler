import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useBroadcast } from "@/hooks/useBroadcast";
import { useScheduleStore } from "@/store";
import type { MarketplaceShift } from "@/types";
import {
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Zap
} from "lucide-react";

interface EscalationTrackerProps {
  shift: MarketplaceShift;
}

const DEFAULT_ESCALATION_MINUTES = 30;
const MAX_TIERS = 3;

export function EscalationTracker({ shift }: EscalationTrackerProps) {
  const store = useScheduleStore();
  const { escalate, isDispatching } = useBroadcast();
  const [timeRemaining, setTimeRemaining] = useState<number>(DEFAULT_ESCALATION_MINUTES * 60);
  const [currentTier, setCurrentTier] = useState<number>(1);

  const { getHistoryForShift } = useBroadcast();

  const historyEntries = useMemo(() => {
    return getHistoryForShift(shift.id);
  }, [getHistoryForShift, shift.id]);

  useEffect(() => {
    if (historyEntries.length > 0) {
      const latestEntry = historyEntries[historyEntries.length - 1];
      setCurrentTier(latestEntry.tier + 1);
    } else {
      setCurrentTier(1);
    }
  }, [historyEntries]);

  useEffect(() => {
    if (shift.lifecycleState === "CLAIMED" || shift.lifecycleState === "APPROVED") {
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          return DEFAULT_ESCALATION_MINUTES * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [shift.lifecycleState]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getProgressPercentage = (): number => {
    const totalSeconds = DEFAULT_ESCALATION_MINUTES * 60;
    return ((totalSeconds - timeRemaining) / totalSeconds) * 100;
  };

  const handleEscalate = async () => {
    if (currentTier >= MAX_TIERS || isDispatching) return;

    try {
      await escalate(shift.id, currentTier);
      setCurrentTier((prev) => prev + 1);
      setTimeRemaining(DEFAULT_ESCALATION_MINUTES * 60);
      store.showToast({
        type: "success",
        title: "Escalated",
        message: `Broadcast escalated to tier ${currentTier + 1}`,
      });
    } catch {
      store.showToast({
        type: "error",
        title: "Escalation Failed",
        message: "Failed to escalate broadcast",
      });
    }
  };

  const isClaimed = shift.lifecycleState === "CLAIMED" || shift.lifecycleState === "APPROVED";
  const canEscalate = !isClaimed && currentTier < MAX_TIERS && !isDispatching;
  const progressPercent = getProgressPercentage();
  const isUrgent = timeRemaining < 60;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-slate-600" />
          <span className="font-semibold text-slate-900">Escalation Status</span>
        </div>
        <div className="flex items-center gap-2">
          {isClaimed ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Claimed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
              Tier {currentTier} of {MAX_TIERS}
            </span>
          )}
        </div>
      </div>

      {!isClaimed && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Next escalation in</span>
              <span className={cn(
                "font-mono font-semibold",
                isUrgent ? "text-red-600" : "text-slate-900"
              )}>
                {formatTime(timeRemaining)}
              </span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
              <motion.div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  isUrgent ? "bg-red-500" : "bg-blue-500"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </div>
          </div>

          {isUrgent && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Urgent</p>
                <p className="text-sm text-amber-700">
                  No response yet. Consider escalating now.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleEscalate}
          disabled={!canEscalate}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all",
            canEscalate
              ? "bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700"
              : "cursor-not-allowed bg-slate-100 text-slate-400"
          )}
        >
          {isDispatching ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Escalating...</span>
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              <span>{isClaimed ? "Shift Claimed" : `Escalate to Tier ${currentTier + 1}`}</span>
            </>
          )}
        </button>
      </div>

      {historyEntries.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
            <Clock className="h-3.5 w-3.5" />
            <span>Previous tiers</span>
          </div>
          <div className="space-y-1.5">
            {historyEntries.slice(-3).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700">Tier {entry.tier}</span>
                  <span className="text-slate-500">via {entry.channel}</span>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(entry.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
