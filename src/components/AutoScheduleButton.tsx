import { useShallow } from 'zustand/react/shallow';
import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Zap, Loader2, AlertTriangle } from "lucide-react";
import { useScheduleStore } from "@/store";
import { multiAgentOptimize, buildOptimizationPreview } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { MultiAgentOptimizeResult } from "@/lib/api/multiAgentOptimize";

type ProgressStage = "idle" | "analyzing" | "optimizing" | "applying" | "complete" | "error";

const STAGE_LABELS: Record<ProgressStage, string> = {
  idle: "Smart Schedule",
  analyzing: "Analyzing schedule...",
  optimizing: "Optimizing...",
  applying: "Applying...",
  complete: "Applied!",
  error: "Review changes",
};

const STAGE_ICONS: Record<ProgressStage, React.ElementType> = {
  idle: Zap,
  analyzing: Loader2,
  optimizing: Loader2,
  applying: Loader2,
  complete: Sparkles,
  error: AlertTriangle,
};

interface AutoScheduleButtonProps {
  /** Additional CSS classes */
  className?: string;
}

export function AutoScheduleButton({ className }: AutoScheduleButtonProps) {
  const [stage, setStage] = useState<ProgressStage>("idle");
  const [errorResult, setErrorResult] = useState<MultiAgentOptimizeResult | null>(null);

  const { slots, providers, startDate, numWeeks, scenarios, customRules, auditLog, showToast, openChangePreviewWithMultiAgentResult } = useScheduleStore(useShallow((s) => ({ slots: s.slots, providers: s.providers, startDate: s.startDate, numWeeks: s.numWeeks, scenarios: s.scenarios, customRules: s.customRules, auditLog: s.auditLog, showToast: s.showToast, openChangePreviewWithMultiAgentResult: s.openChangePreviewWithMultiAgentResult })));

  const safeSlots = useMemo(() => Array.isArray(slots) ? slots : [], [slots]);
  const safeProviders = useMemo(() => Array.isArray(providers) ? providers : [], [providers]);

  // Disabled when no providers exist
  const isDisabled = safeProviders.length === 0 || stage !== "idle";

  const runSmartSchedule = useCallback(async () => {
    // Reset state
    setErrorResult(null);

    // Stage 1: Analyzing
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

      // Stage 2: Optimizing
      setStage("optimizing");
      const result = await multiAgentOptimize(scheduleState);

      if (!result?.success || !result.schedule) {
        setStage("error");
        showToast({
          type: "error",
          title: "Optimization failed",
          message: "No schedule result returned.",
        });
        return;
      }

      // Check confidence score and hard violations
      const rawScore = Number(result.metrics?.objectiveScore ?? 0);
      const confidencePct = rawScore > 1 ? Math.min(100, Math.round(rawScore)) : Math.round(rawScore * 100);
      // Always open the review and preview step for safe user approval
      const preview = buildOptimizationPreview(result, safeSlots, safeProviders);
      openChangePreviewWithMultiAgentResult(preview, result);
      setStage("idle");
      showToast({
        type: "info",
        title: "Optimization Ready for Review",
        message: `Generated schedule proposal with ${confidencePct}% confidence. Please review changes before applying.`,
      });
    } catch (err) {
      setStage("error");
      showToast({
        type: "error",
        title: "Optimization Failed",
        message: err instanceof Error ? err.message : "Multi-agent optimize request failed.",
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
    if (stage === "error" && errorResult) {
      // Show preview on error stage click
      const preview = buildOptimizationPreview(errorResult, safeSlots, safeProviders);
      openChangePreviewWithMultiAgentResult(preview, errorResult);
      setStage("idle");
      setErrorResult(null);
    } else if (stage === "idle") {
      runSmartSchedule();
    }
  }, [stage, errorResult, runSmartSchedule, safeSlots, safeProviders, openChangePreviewWithMultiAgentResult]);

  const Icon = STAGE_ICONS[stage];
  const label = STAGE_LABELS[stage];
  const isLoading = stage === "analyzing" || stage === "optimizing" || stage === "applying";

  // Determine button style based on stage
  const getButtonStyle = () => {
    const base =
      "px-4 py-2 rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 transition-colors";

    if (stage === "complete") {
      return `${base} bg-success border border-success text-success-foreground`;
    }
    if (stage === "error") {
      return `${base} bg-warning border border-warning/20 text-warning hover:bg-warning/10`;
    }
    if (isLoading) {
      return `${base} bg-primary/10 border border-primary/20 text-primary animate-pulse`;
    }
    if (stage === "idle") {
      return `${base} bg-gradient-to-r from-primary to-primary/80 border border-primary text-primary-foreground hover:opacity-90`;
    }
    return base;
  };

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
