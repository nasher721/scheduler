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

  const runMultiAgentOptimize = useCallback(async () => {
    setIsMultiAgentOptimizing(true);
    try {
      const scheduleState = { slots, providers, startDate, numWeeks, scenarios, customRules };
      const result = await multiAgentOptimize(scheduleState);
      if (!result?.success || !result.schedule) {
        showToast({ type: "error", title: "Optimization failed", message: "No schedule result returned." });
        return;
      }
      const preview = buildOptimizationPreview(result, slots, providers);
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
  }, [slots, providers, startDate, numWeeks, scenarios, customRules, showToast, openChangePreviewWithMultiAgentResult]);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  // ── Autosave: debounce 4s after any slot or provider change ───────────
  const performSave = useCallback(async () => {
    setAutoSaveStatus("saving");
    try {
      await saveScheduleState({
        providers,
        startDate,
        numWeeks,
        slots,
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
  }, [providers, startDate, numWeeks, slots, scenarios, customRules, auditLog]);

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

  const assigned = slots.filter((slot) => slot.providerId).length;
  const coverage = Math.round((assigned / Math.max(slots.length, 1)) * 100);
  const counts = useMemo(() => getProviderCounts(slots, providers), [slots, providers]);
  const overloaded = providers.filter((p) => {
    const c = counts[p.id];
    return c && (
      c.weekDays > p.targetWeekDays
      || c.weekendDays > p.targetWeekendDays
      || (c.weekNights + c.weekendNights) > p.targetWeekNights
    );
  });
  const criticalUnfilled = slots.filter((slot) => slot.priority === "CRITICAL" && !slot.providerId).length;
  const skillMismatchRisk = slots.filter((slot) => {
    if (!slot.providerId) return false;
    const provider = providers.find((p) => p.id === slot.providerId);
    return provider ? !provider.skills.includes(slot.requiredSkill) : false;
  }).length;
  const fatigueExposure = providers.filter((p) => counts[p.id] && counts[p.id].weekNights + counts[p.id].weekendNights > p.targetWeekNights).length;

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
        providers,
        startDate,
        numWeeks,
        slots,
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
    if (providers.length === 0) {
      showToast({ type: "info", title: "No Staff to Clear", message: "There are no provider profiles to remove." });
      return;
    }

    if (window.confirm("Remove all staff profiles, clear assignments, and delete staffing rules?")) {
      clearStaff();
    }
  };

  const handleClearSchedule = () => {
    if (slots.every((slot) => !slot.providerId) && scenarios.length === 0) {
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
      <div className="min-h-screen p-6 md:p-8 lg:p-10 flex flex-col gap-10 relative z-10">
        {/* Header Section */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-10"
        >
          {/* Institutional Branding & Action Row */}
          <div className="flex flex-col gap-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 border-b border-slate-200/60 pb-10">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-[1px] bg-primary opacity-40" />
                  <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary/80">Department of Neurology</span>
                </div>
                <h1 className="text-6xl lg:text-7xl tracking-tighter text-slate-900 leading-[0.85]">
                  Neuro <span className="font-serif italic text-primary">ICU</span> <span className="text-slate-300 font-extralight">Staffing</span>
                </h1>
                <p className="text-sm text-slate-500 mt-4 max-w-md font-medium leading-relaxed">
                  High-fidelity orchestration for clinical environments.
                  Synchronizing coverage, fatigue logic, and risk-mitigated assignment.
                </p>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2 flex-wrap bg-slate-100/40 p-1.5 rounded-2xl border border-slate-200/50 backdrop-blur-sm">
                <input
                  title="Import"
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImport}
                />

                <div className="flex items-center gap-1 bg-white/80 rounded-xl p-1 shadow-sm border border-slate-200/50">
                  <button onClick={handleUndo} disabled={!canUndo()} className="p-2 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-10" title="Undo"><Undo2 className="w-4 h-4" /></button>
                  <button onClick={handleRedo} disabled={!canRedo()} className="p-2 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-10" title="Redo"><Redo2 className="w-4 h-4" /></button>
                </div>

                <div className="w-px h-6 bg-slate-200/60 mx-1" />

                <div className="flex items-center gap-1">
                  <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors">Import</button>
                  <button onClick={handleRollbackImport} disabled={!canRollbackImport} className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 disabled:opacity-40 transition-colors">Rollback</button>
                </div>

                <div className="w-px h-6 bg-slate-200/60 mx-1" />

                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={autoAssign}
                    className="px-5 py-2 bg-white border border-blue-100 text-primary rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-sm flex items-center gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Auto-Fill
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={runMultiAgentOptimize}
                    disabled={isMultiAgentOptimizing}
                    className="px-5 py-2 bg-white border border-violet-200 text-violet-700 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-sm flex items-center gap-2 disabled:opacity-60"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    {isMultiAgentOptimizing ? "Optimizing…" : "Optimize (AI)"}
                  </motion.button>
                  {/* Autosave status chip */}
                  {autoSaveStatus !== "idle" && (
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${autoSaveStatus === "saving" || autoSaveStatus === "pending"
                      ? "bg-blue-100 text-blue-600 animate-pulse"
                      : autoSaveStatus === "saved"
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-rose-100 text-rose-600"
                      }`}>
                      {autoSaveStatus === "pending" ? "Pending…" : autoSaveStatus === "saving" ? "Saving…" : autoSaveStatus === "saved" ? "✓ Saved" : "Save Failed"}
                    </span>
                  )}
                  <button onClick={handleServerSave} className="p-2 text-slate-400 hover:text-primary transition-colors" title="Sync to server now"><Save className="w-4 h-4" /></button>
                  <button onClick={handleClearSchedule} className="p-2 text-slate-400 hover:text-amber-600 transition-colors" title="Clear Schedule"><Trash className="w-4 h-4" /></button>
                  <button onClick={handleClearStaff} className="p-2 text-slate-400 hover:text-rose-600 transition-colors" title="Clear Staff"><AlertTriangle className="w-4 h-4" /></button>
                  <div className="w-px h-6 bg-slate-200/60 mx-1" />
                  {anomalyAlerts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setViewMode("analytics")}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold uppercase tracking-wider hover:bg-amber-200 transition-colors"
                      title="View anomaly alerts in Analytics"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      {anomalyAlerts.length} alert{anomalyAlerts.length !== 1 ? "s" : ""}
                    </button>
                  )}
                  <button
                    onClick={toggleCopilot}
                    className={cn(
                      "p-2 rounded-lg transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider",
                      isCopilotOpen ? "bg-primary text-white" : "text-slate-400 hover:text-primary"
                    )}
                    title="AI Assistant"
                  >
                    <Bot className="w-4 h-4" />
                    <span className="hidden sm:inline">AI</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Situational Awareness Bar */}
          <div className="flex flex-col xl:flex-row gap-6 no-print">
            <div className="flex-1 stone-panel p-8 flex items-center justify-between gap-10">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Tactical Coverage</span>
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-extralight tracking-tighter text-slate-900">{coverage}%</span>
                  <div className={`w-2.5 h-2.5 rounded-full ${coverage >= 95 ? 'bg-emerald-500 shadow-[0_0_12px_hsla(160,84%,39%,0.4)]' : 'bg-amber-500'}`} />
                </div>
              </div>

              <div className="h-12 w-[1px] bg-slate-100" />

              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Unit Allocation</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-medium text-slate-800">{assigned}</span>
                  <span className="text-xs text-slate-400">/ {slots.length}</span>
                </div>
              </div>

              <div className="flex-1 max-w-[240px] h-1 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${coverage}%` }}
                  className="h-full bg-primary relative"
                >
                  <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite]" />
                </motion.div>
              </div>

              <div className="h-12 w-[1px] bg-slate-100" />

              {/* Network Status */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Connection</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_12px_hsla(160,84%,39%,0.4)]' : 'bg-rose-500'}`} />
                  <span className={`text-xs font-bold ${isOnline ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            <div className="stone-panel p-8 flex items-center gap-16">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center border border-rose-100/50">
                  <AlertCircle className="w-6 h-6 text-rose-500" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-rose-600 tracking-tighter leading-none">{criticalUnfilled}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1.5">Critical Gaps</p>
                </div>
              </div>
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center border border-amber-100/50">
                  <Zap className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-amber-600 tracking-tighter leading-none">{skillMismatchRisk}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1.5">Skill Risk</p>
                </div>
              </div>
            </div>

            <div className="satin-panel p-6 flex flex-col justify-center gap-4">
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Deployment</span>
                  <input type="date" title="Start Date" aria-label="Start Date" value={startDate} onChange={(e) => setScheduleRange(e.target.value, numWeeks)} className="bg-transparent border-none p-0 text-xs font-bold text-slate-900 focus:ring-0" />
                </div>
                <div className="w-[1px] h-6 bg-slate-200" />
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Horizon</span>
                  <div className="flex items-center gap-1">
                    <input type="number" min={1} max={12} title="Number of Weeks" aria-label="Number of Weeks" value={numWeeks} onChange={(e) => setScheduleRange(startDate, Math.min(12, Math.max(1, Number(e.target.value) || 1)))} className="bg-transparent border-none p-0 w-6 text-xs font-bold text-slate-900 focus:ring-0" />
                    <span className="text-[9px] font-medium text-slate-400 uppercase">wks</span>
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* Scenario Ledger */}
          <div className="flex items-center gap-4 no-print overflow-x-auto pb-2 scrollbar-hide">
            <div className="flex items-center gap-2 mr-4">
              <input
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="New Strategy Name..."
                className="bg-transparent border-b border-slate-200 py-1 text-xs font-medium focus:border-primary outline-none transition-colors w-40"
              />
              <button title="Save Scenario" aria-label="Save Scenario" onClick={() => { createScenario(scenarioName); setScenarioName(""); }} className="p-2 text-slate-400 hover:text-primary"><Save className="w-4 h-4" /></button>
            </div>

            <AnimatePresence>
              {scenarios.map((scenario) => (
                <motion.div
                  key={scenario.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="shrink-0 flex items-center gap-3 px-4 py-2 rounded-xl border border-slate-100 bg-white shadow-sm hover:border-blue-200 transition-all cursor-pointer group"
                  onClick={() => loadScenario(scenario.id)}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{scenario.name}</span>
                  <button title="Delete Scenario" aria-label="Delete Scenario" onClick={(e) => { e.stopPropagation(); deleteScenario(scenario.id); }} className="opacity-0 group-hover:opacity-100 transition-opacity"><Trash className="w-3 h-3 text-rose-400 hover:text-rose-600" /></button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Alerts */}
          <AnimatePresence>
            {(lastActionMessage || overloaded.length > 0 || fatigueExposure > 0) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="stone-panel bg-amber-50/50 border-amber-200/50 p-4 flex items-start gap-3 shadow-none"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                <div className="flex-1 text-xs text-amber-900/80 leading-relaxed">
                  {lastActionMessage && <p className="font-bold text-amber-900">{lastActionMessage}</p>}
                  {overloaded.length > 0 && <p>System Overload: {overloaded.map(p => p.name).join(", ")}</p>}
                  {fatigueExposure > 0 && <p>Fatigue Boundary: {fatigueExposure} critical exposure(s) detected.</p>}
                </div>
                <button onClick={clearMessage} className="text-[10px] font-bold uppercase tracking-widest text-amber-700 hover:text-amber-900">Dismiss</button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.header>

        {/* Main Content Arena */}
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col xl:flex-row gap-10 items-start flex-1"
        >
          <div className="w-full xl:w-80 shrink-0">
            <ProviderManager />
          </div>

          <div className="flex-1 w-full flex flex-col min-w-0">
            <div className="satin-panel p-4 rounded-2xl border border-slate-200/50 mb-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Navigation</p>
                  <p className="text-xs text-slate-500 mt-1">Use top tabs for core workflow and dropdowns for supporting modules.</p>
                </div>
                <ExportMenu />
              </div>
              <div className="mt-3">
                <ViewToggle view={viewMode} onChange={setViewMode} />
              </div>
            </div>

            <div className="w-full pb-20">
              <ErrorBoundary>
                <ViewContent viewMode={viewMode} />
              </ErrorBoundary>
            </div>
          </div>
        </motion.main>
      </div>

      <AnimatePresence>
        {isImportOpen && importPreview && (
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} className="bg-white rounded-2xl w-full max-w-5xl p-6 max-h-[85vh] overflow-auto">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Import Preview (Dry Run)</h3>
                  <p className="text-sm text-slate-500">{importPreview.validRows} valid / {importPreview.invalidRows} invalid rows across {importPreview.totalRows} parsed rows.</p>
                </div>
                <button onClick={() => setIsImportOpen(false)} className="text-slate-500 hover:text-slate-900">Close</button>
              </div>

              {importPreview.requiresMapping && (
                <div className="mb-5 border rounded-xl p-4 bg-amber-50/50 border-amber-200">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 mb-3">Column Mapping Required</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(["date", "night", "dayG20", "dayH22", "dayAkron", "consults", "dayAmet", "dayNmet", "jeopardy", "recovery", "vacation"] as ImportFieldKey[]).map((field) => (
                      <label key={field} className="flex flex-col gap-1 text-xs text-slate-700">
                        <span className="font-semibold">{field}</span>
                        <select value={columnMapping[field] ?? ""} onChange={(e) => setColumnMapping((prev) => ({ ...prev, [field]: e.target.value }))} className="border rounded-lg px-2 py-1.5">
                          <option value="">Select column</option>
                          {importPreview.availableHeaders.map((header) => <option key={header} value={header}>{header}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button onClick={() => rerunImportPreview(importPreview.fileName)} className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors">Re-validate Mapping</button>
                    <button
                      onClick={handleSmartMap}
                      disabled={isAiMapping}
                      className="px-3 py-2 text-xs font-semibold rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isAiMapping ? 'animate-pulse' : ''}`} />
                      {isAiMapping ? 'AI is analyzing...' : 'AI Smart Map'}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="border rounded-xl p-4">
                  <h4 className="text-sm font-semibold mb-2">Issues</h4>
                  <ul className="space-y-1 text-xs text-slate-700 max-h-64 overflow-auto">
                    {importPreview.issues.map((issue, idx) => (
                      <li key={`${issue.code}-${idx}`} className="flex gap-2">
                        <span className={issue.type === "error" ? "text-rose-600" : "text-amber-700"}>{issue.type.toUpperCase()}</span>
                        <span>{issue.message} {issue.action ? `• ${issue.action}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border rounded-xl p-4">
                  <h4 className="text-sm font-semibold mb-2">Row Preview</h4>
                  <div className="max-h-64 overflow-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="text-slate-500"><tr><th>Date</th><th>Assignments</th><th>Status</th></tr></thead>
                      <tbody>
                        {importPreview.rows.slice(0, 30).map((row, idx) => (
                          <tr key={`${row.date}-${idx}`} className="border-t">
                            <td className="py-1 pr-2">{row.date || "Invalid"}</td>
                            <td className="py-1 pr-2">{Object.values(row.assignments).flat().slice(0, 3).join(", ") || "—"}</td>
                            <td className="py-1">{row.issues.some((issue) => issue.type === "error") ? "Invalid" : row.issues.length ? "Warning" : "Valid"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setIsImportOpen(false)} className="px-4 py-2 rounded-lg border">Cancel</button>
                <button onClick={handleApplyImport} disabled={importPreview.requiresMapping} className="px-4 py-2 rounded-lg bg-slate-900 text-white disabled:opacity-50">Apply Import</button>
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
