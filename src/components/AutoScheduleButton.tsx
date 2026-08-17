import { useShallow } from 'zustand/react/shallow';
import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Zap, Loader2, AlertTriangle, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { useScheduleStore } from "@/store";
import { multiAgentOptimize, buildOptimizationPreview } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { MultiAgentOptimizeResult } from "@/lib/api/multiAgentOptimize";

type ProgressStage = "idle" | "analyzing" | "optimizing" | "applying" | "complete" | "error" | "confirm";

const STAGE_LABELS: Record<ProgressStage, string> = {
  idle: "Smart Schedule",
  analyzing: "Analyzing schedule...",
  optimizing: "Optimizing...",
  applying: "Applying...",
  complete: "Applied!",
  error: "Retry",
  confirm: "Confirm Auto-Fill",
};

const STAGE_ICONS: Record<ProgressStage, React.ElementType> = {
  idle: Zap,
  analyzing: Loader2,
  optimizing: Loader2,
  applying: Loader2,
  complete: Sparkles,
  error: AlertTriangle,
  confirm: AlertCircle,
};

interface AutoScheduleButtonProps {
  className?: string;
}

export function AutoScheduleButton({ className }: AutoScheduleButtonProps) {
  const [stage, setStage] = useState<ProgressStage>("idle");
  const [errorResult, setErrorResult] = useState<MultiAgentOptimizeResult | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const { slots, providers, startDate, numWeeks, scenarios, customRules, auditLog, showToast, openChangePreviewWithMultiAgentResult } = useScheduleStore(useShallow((s) => ({ slots: s.slots, providers: s.providers, startDate: s.startDate, numWeeks: s.numWeeks, scenarios: s.scenarios, customRules: s.customRules, auditLog: s.auditLog, showToast: s.showToast, openChangePreviewWithMultiAgentResult: s.openChangePreviewWithMultiAgentResult })));

  const safeSlots = useMemo(() => Array.isArray(slots) ? slots : [], [slots]);
  const safeProviders = useMemo(() => Array.isArray(providers) ? providers : [], [providers]);

  const unfilledCount = safeSlots.filter(s => !s.providerId).length;
  const criticalUnfilledCount = safeSlots.filter(s => !s.providerId && s.servicePriority === "CRITICAL").length;

  const isDisabled = safeProviders.length === 0 || (stage !== "idle" && stage !== "confirm" && stage !== "error");

  const runSmartSchedule = useCallback(async () => {
    setShowConfirmation(false);
    setErrorResult(null);
    setStage("analyzing");
    try {
      const scheduleState = {
        slots: safeSlots,
        providers: safeProviders,
        startDate,
        numWeeks,
        scenarios: Array.isArray(scenarios) ? scenarios : [],
        customRules: Array.isArray(customRules) ? customRules : [],
        auditLog: Array.isArray(auditLog) ? auditLog : [],
      };

      setStage("optimizing");
      const result = await multiAgentOptimize(scheduleState);

      if (!result?.success || !result.schedule) {
        setErrorResult(result);
        setStage("error");
        showToast({
          type: "error",
          title: "Optimization failed",
          message: "No schedule result returned. Click to review partial results or retry.",
        });
        return;
      }

      const rawScore = Number(result.metrics?.objectiveScore ?? 0);
      const confidencePct = rawScore > 1 ? Math.min(100, Math.round(rawScore)) : Math.round(rawScore * 100);
      const preview = buildOptimizationPreview(result, safeSlots, safeProviders);
      openChangePreviewWithMultiAgentResult(preview, result);
      setStage("idle");
      showToast({
        type: "info",
        title: "Optimization Ready for Review",
        message: `Generated schedule proposal with ${confidencePct}% confidence. Please review changes before applying.`,
      });
    } catch (err) {
      setErrorResult(null);
      setStage("error");
      showToast({
        type: "error",
        title: "Optimization Failed",
        message: err instanceof Error ? err.message : "Multi-agent optimize request failed. Click to retry.",
      });
    }
  }, [
    safeSlots,
    safeProviders,
    startDate,
    numWeeks,
    scenarios,
    customRules,
    auditLog,
    slots,
    showToast,
    openChangePreviewWithMultiAgentResult,
  ]);

  const handleClick = useCallback(() => {
    if (stage === "error") {
      if (errorResult) {
        const preview = buildOptimizationPreview(errorResult, safeSlots, safeProviders);
        openChangePreviewWithMultiAgentResult(preview, errorResult);
        setStage("idle");
        setErrorResult(null);
      } else {
        setShowConfirmation(true);
        setStage("confirm");
      }
    } else if (stage === "idle") {
      if (unfilledCount === 0) {
        showToast({ type: "info", title: "No Unfilled Shifts", message: "All shifts are already assigned." });
        return;
      }
      setShowConfirmation(true);
      setStage("confirm");
    }
  }, [stage, errorResult, runSmartSchedule, safeSlots, safeProviders, openChangePreviewWithMultiAgentResult, unfilledCount, showToast]);

  const handleConfirm = useCallback(() => {
    runSmartSchedule();
  }, [runSmartSchedule]);

  const handleCancel = useCallback(() => {
    setShowConfirmation(false);
    setStage("idle");
  }, []);

  const Icon = STAGE_ICONS[stage];
  const label = STAGE_LABELS[stage];
  const isLoading = stage === "analyzing" || stage === "optimizing" || stage === "applying";

  const getButtonStyle = () => {
    const base = "px-4 py-2 rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 transition-colors";

    if (stage === "complete") {
      return `${base} bg-success border border-success text-success-foreground`;
    }
    if (stage === "error") {
      return `${base} bg-warning border border-warning/20 text-warning hover:bg-warning/10`;
    }
    if (stage === "confirm") {
      return `${base} bg-warning border border-warning/30 text-warning-foreground animate-pulse`;
    }
    if (isLoading) {
      return `${base} bg-primary/10 border border-primary/20 text-primary animate-pulse`;
    }
    if (stage === "idle") {
      return `${base} bg-gradient-to-r from-primary to-primary/80 border border-primary text-primary-foreground hover:opacity-90`;
    }
    return base;
  };

  if (showConfirmation) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        onClick={handleCancel}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-warning/10 rounded-xl text-warning">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Confirm Auto-Fill</h3>
              <p className="text-sm text-slate-500">This will auto-assign all unfilled shifts</p>
            </div>
          </div>
          
          <div className="space-y-3 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Total unfilled shifts</span>
              <span className="font-semibold text-slate-900">{unfilledCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Critical unfilled shifts</span>
              <span className="font-semibold text-rose-600">{criticalUnfilledCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Providers available</span>
              <span className="font-semibold text-slate-900">{safeProviders.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Date range</span>
              <span className="font-semibold text-slate-900">{numWeeks} week(s) from {startDate}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleConfirm}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-white rounded-lg font-semibold shadow-sm flex items-center justify-center gap-2 transition-colors hover:opacity-90"
            >
              <CheckCircle className="w-4 h-4" />
              Confirm & Run
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCancel}
              className="flex-1 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors hover:bg-slate-50"
            >
              <XCircle className="w-4 h-4" />
              Cancel
            </motion.button>
          </div>

          <p className="mt-4 text-xs text-slate-400 text-center">
            You can review all changes before applying. Rollback is available after applying.
          </p>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.button
      type="button"
      whileHover={!isDisabled ? { scale: 1.02 } : undefined}
      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
      onClick={handleClick}
      disabled={isDisabled}
      className={cn(getButtonStyle(), isDisabled && "opacity-50 cursor-not-allowed", className)}
      title={isDisabled ? "Add providers to enable Smart Schedule" : label}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5" />
      )}
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{stage === "idle" ? "Smart" : label}</span>
    </motion.button>
  );
}