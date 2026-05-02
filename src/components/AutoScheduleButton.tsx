import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Zap, Loader2, AlertTriangle } from "lucide-react";
import { useScheduleStore } from "@/store";
import { multiAgentOptimize, buildOptimizationPreview, applyOptimizationResult } from "@/lib/api";
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

  const {
    slots,
    providers,
    startDate,
    numWeeks,
    scenarios,
    customRules,
    showToast,
    openChangePreviewWithMultiAgentResult,
  } = useScheduleStore();

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
        scenarios,
        customRules,
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
      const confidenceScore = Number(result.metrics?.objectiveScore ?? 0);
      const hardViolationCount = Number(result.metrics?.hardViolationCount ?? 0);
      const hasHighConfidence = confidenceScore >= 0.8;
      const hasNoViolations = hardViolationCount === 0;

      // Auto-apply if high confidence and no violations
      if (hasHighConfidence && hasNoViolations) {
        setStage("applying");
        try {
          const applyResponse = await applyOptimizationResult(result, null);

          if (applyResponse.ok) {
            setStage("complete");
            showToast({
              type: "success",
              title: "Schedule optimized",
              message: `Applied with ${Math.round(confidenceScore * 100)}% confidence.`,
            });

            // Reset to idle after brief display
            setTimeout(() => setStage("idle"), 2000);
          } else {
            // Fall back to preview if apply failed
            setErrorResult(result);
            setStage("error");
          }
        } catch {
          // Fall back to preview on error
          setErrorResult(result);
          setStage("error");
        }
      } else {
        // Low confidence or violations - show preview
        setErrorResult(result);
        setStage("error");
      }
    } catch (err) {
      setStage("error");
      showToast({
        type: "error",
        title: "Smart Schedule failed",
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
    showToast,
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
