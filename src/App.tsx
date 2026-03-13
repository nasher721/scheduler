import { ProviderManager } from "./components/ProviderManager";
import { LandingPage } from "./components/LandingPage";
import { CopilotPanel } from "./components/CopilotPanel";
import { ScheduleChangePreview, type OptimizationPreview } from "./components/ScheduleChangePreview";
import { SparkAnnotation } from "spark-banana";
import { ViewToggle, type ViewMode } from "./components/ViewToggle";
import { ExportMenu } from "./components/ExportMenu";
import { ToastContainer } from "./components/Toast";
import { ErrorBoundary, ViewContent } from "./components/layout";
import { getProviderCounts, useScheduleStore } from "./store";
import { Login } from "./components/Login";
import { ProviderDashboard } from "./components/ProviderDashboard";
import { InstallPrompt } from "./components/InstallPrompt";
import { useNetworkStatus } from "./hooks/usePWA";
import { useAnomalyAlerts } from "./hooks/useAnomalyAlerts";
import {
  AlertTriangle,
  Save,
  Trash,
  AlertCircle,
  Zap,
  Sparkles,
  Undo2,
  Redo2,
  Bot
} from "lucide-react";
import { cn } from "@/lib/utils";
import "./styles/PrintStyles.css";
import { DndContext, type DragEndEvent, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { applyScheduleImport, hasImportRollback, parseScheduleImportFile, rollbackLastImport, getAiHeaderMapping, type ImportFieldKey, type ImportPreviewResult } from "./lib/excelUtils";
import { saveScheduleState, loadScheduleState, multiAgentOptimize, buildOptimizationPreview } from "./lib/api";
import { supabase } from "./lib/supabase";
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function App() {
  const {
    autoAssign,
    assignShift,
    startDate,
    numWeeks,
    setScheduleRange,
    slots,
    providers,
    scenarios,
    createScenario,
    loadScenario,
    deleteScenario,
    lastActionMessage,
    clearMessage,
    undo,
    redo,
    canUndo,
    canRedo,
    clearStaff,
    clearSchedule,
    customRules,
    auditLog,
    showToast,
    currentUser,
    initialize,
    isCopilotOpen,
    toggleCopilot,
    showChangePreview,
    changePreviewData,
    closeChangePreview,
    applyAllAISuggestions,
    rejectAISuggestions,
    openChangePreviewWithMultiAgentResult,
  } = useScheduleStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Handle hash-based routing for admin access - auto-login for #admin
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#admin' && !currentUser) {
      // Auto-login as admin for development/demo purposes
      const adminLogin = async () => {
        try {
          await useScheduleStore.getState().login('admin@neuroicu.com');
        } catch {
          // If login fails, user stays on Login screen
        }
      };
      adminLogin();
    }
  }, [currentUser]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("schedule");
  const [scenarioName, setScenarioName] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<Partial<Record<ImportFieldKey, string>>>({});
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [canRollbackImport, setCanRollbackImport] = useState(hasImportRollback());
  const [isAiMapping, setIsAiMapping] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const [isMultiAgentOptimizing, setIsMultiAgentOptimizing] = useState(false);
  const isOnline = useNetworkStatus();
  const { alerts: anomalyAlerts } = useAnomalyAlerts();

  const safeSlots = Array.isArray(slots) ? slots : [];
  const safeProviders = Array.isArray(providers) ? providers : [];

  const runMultiAgentOptimize = useCallback(async () => {
    setIsMultiAgentOptimizing(true);
    try {
      const scheduleState = { slots: safeSlots, providers: safeProviders, startDate, numWeeks, scenarios, customRules };
      const result = await multiAgentOptimize(scheduleState);
      if (!result?.success || !result.schedule) {
        showToast({ type: "error", title: "Optimization failed", message: "No schedule result returned." });
        return;
      }
      const preview = buildOptimizationPreview(result, safeSlots, safeProviders);
      openChangePreviewWithMultiAgentResult(preview as OptimizationPreview, result);
    } catch (err) {
      showToast({
        type: "error",
        title: "Optimization failed",
        message: err instanceof Error ? err.message : "Multi-agent optimize request failed.",
      });
    } finally {
      setIsMultiAgentOptimizing(false);
    }
  }, [safeSlots, safeProviders, startDate, numWeeks, scenarios, customRules, showToast, openChangePreviewWithMultiAgentResult]);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  // ── Autosave: debounce 4s after any slot or provider change ───────────
  const performSave = useCallback(async () => {
    setAutoSaveStatus("saving");
    try {
      await saveScheduleState({
        providers: safeProviders,
        startDate,
        numWeeks,
        slots: safeSlots,
        scenarios,
        customRules,
        auditLog,
      });
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 2000);
    } catch {
      setAutoSaveStatus("error");
      setTimeout(() => setAutoSaveStatus("idle"), 3000);
    }
  }, [safeProviders, startDate, numWeeks, safeSlots, scenarios, customRules, auditLog]);

  useEffect(() => {
    // Don't autosave if not logged in or offline
    if (!currentUser || !isOnline) return;
    setAutoSaveStatus("pending");
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      performSave();
    }, 4000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, providers]);

  // ── Real-time: reload when another client mutates slots in Supabase ───
  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase
      .channel("slots-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "slots" },
        async () => {
          try {
            const { state } = await loadScheduleState();
            if (state) {
              useScheduleStore.setState({
                providers: state.providers,
                slots: state.slots,
                startDate: state.startDate,
                numWeeks: state.numWeeks,
              });
            }
          } catch {
            // ignore realtime reload errors silently
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // Document title for accessibility and browser tab (Next.js-style metadata awareness)
  useEffect(() => {
    if (!currentUser || currentUser.role === "CLINICIAN") return;
    const titles: Record<ViewMode, string> = {
      schedule: "Schedule",
      "shift-requests": "Shift Requests",
      analytics: "Insights",
      rules: "Governance",
      strategy: "Strategy",
      swaps: "Swaps",
      holidays: "Holidays",
      conflicts: "Command",
      notifications: "Alerts",
      predictive: "ML Insights",
      templates: "Templates",
      "ai-test": "AI Test",
    };
    const segment = titles[viewMode] ?? "Schedule";
    document.title = `${segment} · Neuro ICU Staffing`;
  }, [currentUser, viewMode]);

  const assigned = safeSlots.filter((slot) => slot?.providerId).length;
  const coverage = Math.round((assigned / Math.max(safeSlots.length, 1)) * 100);
  const counts = useMemo(() => getProviderCounts(safeSlots, safeProviders), [safeSlots, safeProviders]);
  const overloaded = safeProviders.filter((p) => {
    const c = counts[p.id];
    return c && (
      c.weekDays > p.targetWeekDays
      || c.weekendDays > p.targetWeekendDays
      || (c.weekNights + c.weekendNights) > p.targetWeekNights
    );
  });
  const criticalUnfilled = safeSlots.filter((slot) => slot?.priority === "CRITICAL" && !slot?.providerId).length;
  const skillMismatchRisk = safeSlots.filter((slot) => {
    if (!slot?.providerId) return false;
    const provider = safeProviders.find((p) => p.id === slot.providerId);
    return provider ? !(provider.skills ?? []).includes(slot.requiredSkill) : false;
  }).length;
  const fatigueExposure = safeProviders.filter((p) => counts[p.id] && counts[p.id].weekNights + counts[p.id].weekendNights > p.targetWeekNights).length;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.data.current?.providerId) {
      assignShift(over.id as string, active.data.current.providerId);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const preview = await parseScheduleImportFile(file, columnMapping);
        setImportPreview(preview);
        setColumnMapping(preview.mapping);
        setIsImportOpen(true);
      } catch {
        showToast({ type: "error", title: "Import failed", message: "File could not be parsed. Confirm that the workbook has a header row and date column." });
      }
    }
  };

  const rerunImportPreview = async (fileName: string) => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || file.name !== fileName) return;
    const preview = await parseScheduleImportFile(file, columnMapping);
    setImportPreview(preview);
  };

  const handleSmartMap = async () => {
    if (!importPreview) return;
    setIsAiMapping(true);
    try {
      const { mapping, confidence } = await getAiHeaderMapping(importPreview.rows.map(r => ({ ...r.assignments, date: r.date })));
      if (Object.keys(mapping).length > 0) {
        setColumnMapping(prev => ({ ...prev, ...mapping }));
        showToast({
          type: "success",
          title: "Smart Mapping Applied",
          message: `AI suggested ${Object.keys(mapping).length} mappings with ${Math.round(confidence * 100)}% confidence.`,
        });
      } else {
        showToast({ type: "info", title: "Smart Map", message: "AI could not find a better mapping than the current one." });
      }
    } catch {
      showToast({ type: "error", title: "Smart Map Failed", message: "Unable to reach the AI engine." });
    } finally {
      setIsAiMapping(false);
    }
  };

  const handleApplyImport = () => {
    if (!importPreview) return;
    const result = applyScheduleImport(importPreview);
    if (result.success) {
      showToast({
        type: "success",
        title: "Import applied",
        message: `Applied ${result.appliedAssignments} assignments. Skipped ${result.skippedRows} invalid rows.`,
      });
      setCanRollbackImport(hasImportRollback());
      setIsImportOpen(false);
    } else {
      showToast({
        type: "error",
        title: "Import failed",
        message: result.error?.message || "An unexpected error occurred during import.",
      });
    }
  };

  const handleRollbackImport = () => {
    const didRollback = rollbackLastImport();
    if (!didRollback) return;
    showToast({ type: "info", title: "Import rolled back", message: "Restored the schedule state before the latest import." });
    setCanRollbackImport(false);
  };

  const handleUndo = () => {
    if (canUndo()) undo();
  };

  const handleRedo = () => {
    if (canRedo()) redo();
  };

  const handleServerSave = async () => {
    try {
      await saveScheduleState({
        providers: safeProviders,
        startDate,
        numWeeks,
        slots: safeSlots,
        scenarios,
        customRules,
        auditLog,
      });
      showToast({ type: "success", title: "Saved to Server", message: "Current schedule state is now persisted on the backend." });
    } catch {
      showToast({ type: "error", title: "Save Failed", message: "Unable to reach API server." });
    }
  };

  const handleClearStaff = () => {
    if (safeProviders.length === 0) {
      showToast({ type: "info", title: "No Staff to Clear", message: "There are no provider profiles to remove." });
      return;
    }

    if (window.confirm("Remove all staff profiles, clear assignments, and delete staffing rules?")) {
      clearStaff();
    }
  };

  const handleClearSchedule = () => {
    if (safeSlots.every((slot) => !slot?.providerId) && scenarios.length === 0) {
      showToast({ type: "info", title: "Schedule Already Clear", message: "There are no assignments or scenarios to reset." });
      return;
    }

    if (window.confirm("Clear all assignments and reset saved scenarios for this planning window?")) {
      clearSchedule();
    }
  };


  if (!currentUser) {
    // Skip landing page for #admin hash - auto-login will handle it
    const isAdminHash = window.location.hash === '#admin';
    if (showLanding && !isAdminHash) {
      return <LandingPage onLogin={() => setShowLanding(false)} />;
    }
    return (
      <>
        <Login />
        <ToastContainer />
      </>
    );
  }

  if (currentUser.role === "CLINICIAN") {
    return (
      <>
        <ProviderDashboard />
        <ToastContainer />
      </>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-8 max-w-[1600px] mx-auto relative z-10">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-6"
        >
          {/* Branding + Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-4xl sm:text-5xl tracking-tight text-foreground leading-tight font-serif italic">
                Neuro <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">ICU</span> Staffing
              </h1>
              <p className="text-sm text-foreground-muted mt-1.5 max-w-md">
                Coverage, fatigue logic, risk-mitigated assignment.
              </p>
            </div>

            {/* Action Toolbar */}
            <div className="flex items-center gap-1.5 flex-wrap rounded-xl bg-secondary/60 p-1.5 border border-border">
                <input
                  title="Import"
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImport}
                />

                <div className="flex items-center gap-0.5 rounded-lg bg-surface p-0.5 border border-border">
                  <button onClick={handleUndo} disabled={!canUndo()} className="p-2 rounded-md hover:bg-secondary transition-colors disabled:opacity-30 text-foreground-muted" title="Undo" aria-label="Undo"><Undo2 className="w-4 h-4" /></button>
                  <button onClick={handleRedo} disabled={!canRedo()} className="p-2 rounded-md hover:bg-secondary transition-colors disabled:opacity-30 text-foreground-muted" title="Redo" aria-label="Redo"><Redo2 className="w-4 h-4" /></button>
                </div>
                <div className="w-px h-5 bg-border mx-0.5" />
                <div className="flex items-center gap-0.5">
                  <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 text-sm font-medium text-foreground-muted hover:text-foreground rounded-lg transition-colors">Import</button>
                  <button onClick={handleRollbackImport} disabled={!canRollbackImport} className="px-3 py-2 text-sm font-medium text-foreground-muted hover:text-foreground disabled:opacity-40 rounded-lg transition-colors">Rollback</button>
                </div>
                <div className="w-px h-5 bg-border mx-0.5" />
                <div className="flex items-center gap-1.5">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={autoAssign}
                    className="px-4 py-2 bg-surface border border-primary/20 text-primary rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 hover:bg-primary/5 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Auto-Fill
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={runMultiAgentOptimize}
                    disabled={isMultiAgentOptimizing}
                    className="px-4 py-2 bg-surface border border-primary/20 text-primary rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 disabled:opacity-50 hover:bg-primary/5 transition-colors"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    {isMultiAgentOptimizing ? "Optimizing…" : "Optimize (AI)"}
                  </motion.button>
                  {autoSaveStatus !== "idle" && (
                    <span className={cn(
                      "text-xs font-medium px-2.5 py-1 rounded-full",
                      (autoSaveStatus === "saving" || autoSaveStatus === "pending") && "bg-primary/10 text-primary animate-pulse",
                      autoSaveStatus === "saved" && "bg-success/10 text-success",
                      autoSaveStatus === "error" && "bg-error/10 text-error"
                    )}>
                      {autoSaveStatus === "pending" ? "Pending" : autoSaveStatus === "saving" ? "Saving" : autoSaveStatus === "saved" ? "Saved" : "Save failed"}
                    </span>
                  )}
                  <button onClick={handleServerSave} className="p-2 text-foreground-muted hover:text-primary rounded-lg transition-colors" title="Sync to server" aria-label="Save to server"><Save className="w-4 h-4" /></button>
                  <button onClick={handleClearSchedule} className="p-2 text-foreground-muted hover:text-warning rounded-lg transition-colors" title="Clear schedule" aria-label="Clear schedule"><Trash className="w-4 h-4" /></button>
                  <button onClick={handleClearStaff} className="p-2 text-foreground-muted hover:text-error rounded-lg transition-colors" title="Clear staff" aria-label="Clear staff"><AlertTriangle className="w-4 h-4" /></button>
                  <div className="w-px h-5 bg-border mx-0.5" />
                  {anomalyAlerts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setViewMode("analytics")}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-warning/10 text-warning border border-warning/20 text-sm font-medium hover:opacity-90 transition-opacity"
                      title="View anomaly alerts"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      {anomalyAlerts.length} alert{anomalyAlerts.length !== 1 ? "s" : ""}
                    </button>
                  )}
                  <button
                    onClick={toggleCopilot}
                    className={cn(
                      "p-2 rounded-lg transition-colors flex items-center gap-1.5 text-sm font-medium",
                      isCopilotOpen ? "bg-primary text-primary-foreground" : "text-foreground-muted hover:text-primary"
                    )}
                    title="AI Assistant"
                    aria-label="Toggle AI assistant"
                  >
                    <Bot className="w-4 h-4" />
                    <span className="hidden sm:inline">AI</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* One compact awareness strip */}
          <div className="stone-panel p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 no-print">
            <div className="flex items-center gap-6 sm:gap-8 flex-wrap">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-light tracking-tight text-foreground">{coverage}%</span>
                <span className="text-xs text-foreground-muted">coverage</span>
                <div className={cn("w-2 h-2 rounded-full", coverage >= 95 ? "bg-success" : "bg-warning")} />
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <span className="font-medium text-foreground">{assigned}</span>
                <span className="text-foreground-muted">/ {safeSlots.length} slots</span>
              </div>
              <div className="h-4 w-px bg-border hidden sm:block" />
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <span className="text-foreground-muted">Start</span>
                  <input type="date" title="Start Date" aria-label="Start Date" value={startDate} onChange={(e) => setScheduleRange(e.target.value, numWeeks)} className="bg-transparent border-none p-0 text-sm font-medium text-foreground focus:ring-0 focus:outline-none" />
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="number" min={1} max={12} title="Weeks" aria-label="Weeks" value={numWeeks} onChange={(e) => setScheduleRange(startDate, Math.min(12, Math.max(1, Number(e.target.value) || 1)))} className="bg-transparent border-none p-0 w-8 text-sm font-medium text-foreground text-center focus:ring-0 focus:outline-none" />
                  <span className="text-foreground-muted">wks</span>
                </label>
              </div>
              <div className="h-4 w-px bg-border hidden sm:block" />
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-success" : "bg-error")} />
                <span className={cn("text-sm font-medium", isOnline ? "text-success" : "text-error")}>{isOnline ? "Online" : "Offline"}</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-error">{criticalUnfilled}</span>
                <span className="text-xs text-foreground-muted">critical gaps</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-warning">{skillMismatchRisk}</span>
                <span className="text-xs text-foreground-muted">skill risk</span>
              </div>
            </div>
          </div>


          {/* Scenarios */}
          <div className="flex items-center gap-3 no-print overflow-x-auto pb-1 scrollbar-hide">
            <div className="flex items-center gap-2 shrink-0">
              <input
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="New scenario…"
                className="bg-transparent border-b border-border py-1.5 text-sm font-medium text-foreground placeholder:text-foreground-muted focus:border-primary outline-none transition-colors w-36"
              />
              <button title="Save scenario" aria-label="Save scenario" onClick={() => { createScenario(scenarioName); setScenarioName(""); }} className="p-2 text-foreground-muted hover:text-primary rounded-lg transition-colors"><Save className="w-4 h-4" /></button>
            </div>
            <AnimatePresence>
              {scenarios.map((scenario) => (
                <motion.div
                  key={scenario.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface hover:border-primary/30 transition-all cursor-pointer group text-sm font-medium text-foreground"
                  onClick={() => loadScenario(scenario.id)}
                >
                  {scenario.name}
                  <button title="Delete scenario" aria-label="Delete scenario" onClick={(e) => { e.stopPropagation(); deleteScenario(scenario.id); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-error hover:text-error"><Trash className="w-3 h-3" /></button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Alerts */}
          <AnimatePresence>
            {(lastActionMessage || overloaded.length > 0 || fatigueExposure > 0) && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="stone-panel bg-warning/5 border-warning/20 p-4 flex items-start gap-3"
              >
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <div className="flex-1 text-sm text-foreground-secondary leading-relaxed">
                  {lastActionMessage && <p className="font-semibold text-foreground">{lastActionMessage}</p>}
                  {overloaded.length > 0 && <p>Overload: {overloaded.map(p => p.name).join(", ")}</p>}
                  {fatigueExposure > 0 && <p>Fatigue: {fatigueExposure} exposure(s).</p>}
                </div>
                <button onClick={clearMessage} className="text-sm font-medium text-warning hover:text-foreground transition-colors shrink-0">Dismiss</button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.header>

        {/* Main content */}
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex flex-col xl:flex-row gap-6 items-start flex-1 min-w-0"
        >
          <aside className="w-full xl:w-72 shrink-0">
            <ProviderManager />
          </aside>
          <div className="flex-1 w-full min-w-0 flex flex-col gap-4">
            <div className="satin-panel p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <ViewToggle view={viewMode} onChange={setViewMode} />
              <ExportMenu />
            </div>
            <div className="w-full pb-16">
              <ErrorBoundary>
                <ViewContent viewMode={viewMode} />
              </ErrorBoundary>
            </div>
          </div>
        </motion.main>
      </div>

      <AnimatePresence>
        {isImportOpen && importPreview && (
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }} className="bg-surface border border-border rounded-2xl w-full max-w-4xl p-6 max-h-[85vh] overflow-auto shadow-xl">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Import preview</h3>
                  <p className="text-sm text-foreground-muted mt-0.5">{importPreview.validRows} valid / {importPreview.invalidRows} invalid of {importPreview.totalRows} rows.</p>
                </div>
                <button onClick={() => setIsImportOpen(false)} className="text-sm font-medium text-foreground-muted hover:text-foreground transition-colors p-1">Close</button>
              </div>

              {importPreview.requiresMapping && (
                <div className="mb-5 rounded-xl p-4 bg-warning/5 border border-warning/20">
                  <p className="text-sm font-medium text-foreground mb-3">Column mapping</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(["date", "night", "dayG20", "dayH22", "dayAkron", "consults", "dayAmet", "dayNmet", "jeopardy", "recovery", "vacation"] as ImportFieldKey[]).map((field) => (
                      <label key={field} className="flex flex-col gap-1 text-sm text-foreground-secondary">
                        <span className="font-medium text-foreground">{field}</span>
                        <select value={columnMapping[field] ?? ""} onChange={(e) => setColumnMapping((prev) => ({ ...prev, [field]: e.target.value }))} className="input-base rounded-lg py-2">
                          <option value="">Select column</option>
                          {importPreview.availableHeaders.map((header) => <option key={header} value={header}>{header}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => rerunImportPreview(importPreview.fileName)} className="px-3 py-2 text-sm font-medium rounded-lg bg-foreground text-primary-foreground hover:opacity-90 transition-opacity">Re-validate</button>
                    <button
                      onClick={handleSmartMap}
                      disabled={isAiMapping}
                      className="px-3 py-2 text-sm font-medium rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 flex items-center gap-2 disabled:opacity-50 transition-colors"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isAiMapping ? "animate-pulse" : ""}`} />
                      {isAiMapping ? "Analyzing…" : "AI Smart Map"}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl p-4 border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-2">Issues</h4>
                  <ul className="space-y-1.5 text-sm text-foreground-secondary max-h-56 overflow-auto">
                    {importPreview.issues.map((issue, idx) => (
                      <li key={`${issue.code}-${idx}`} className="flex gap-2">
                        <span className={cn("font-medium shrink-0", issue.type === "error" ? "text-error" : "text-warning")}>{issue.type}</span>
                        <span>{issue.message} {issue.action ? `· ${issue.action}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl p-4 border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-2">Row preview</h4>
                  <div className="max-h-56 overflow-auto text-sm">
                    <table className="w-full text-left">
                      <thead className="text-foreground-muted text-xs font-medium"><tr><th className="pb-2">Date</th><th className="pb-2">Assignments</th><th className="pb-2">Status</th></tr></thead>
                      <tbody className="text-foreground-secondary">
                        {importPreview.rows.slice(0, 30).map((row, idx) => (
                          <tr key={`${row.date}-${idx}`} className="border-t border-border">
                            <td className="py-1.5 pr-2">{row.date || "—"}</td>
                            <td className="py-1.5 pr-2">{Object.values(row.assignments).flat().slice(0, 3).join(", ") || "—"}</td>
                            <td className="py-1.5">{row.issues.some((i) => i.type === "error") ? "Invalid" : row.issues.length ? "Warning" : "Valid"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => setIsImportOpen(false)} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors">Cancel</button>
                <button onClick={handleApplyImport} disabled={importPreview.requiresMapping} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">Apply import</button>
              </div>
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>

      <ToastContainer />
      <InstallPrompt />
      <CopilotPanel isOpen={isCopilotOpen} onToggle={toggleCopilot} />

      {/* AI Change Preview Modal */}
      {showChangePreview && !!changePreviewData && (
        <ScheduleChangePreview
          preview={changePreviewData as OptimizationPreview}
          isOpen={showChangePreview}
          onClose={closeChangePreview}
          onAccept={applyAllAISuggestions}
          onReject={rejectAISuggestions}
        />
      )}

      {import.meta.env.DEV && (
        <SparkAnnotation projectRoot={import.meta.env.VITE_SPARK_PROJECT_ROOT as string} />
      )}
    </DndContext>
  );
}
