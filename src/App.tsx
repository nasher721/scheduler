import { lazy, Suspense } from "react";
import { useState, useEffect } from "react";
const CopilotPanel = lazy(() => import("./components/CopilotPanel").then(m => ({ default: m.CopilotPanel })));
const ProviderAvailabilityPanel = lazy(() => import("./components/ProviderAvailabilityPanel").then(m => ({ default: m.ProviderAvailabilityPanel })));

const ProviderManager = lazy(() => import("./components/ProviderManager").then(m => ({ default: m.ProviderManager })));
const LandingPage = lazy(() => import("./components/LandingPage").then(m => ({ default: m.LandingPage })));
const ScheduleChangePreview = lazy(() => import("./components/ScheduleChangePreview").then(m => ({ default: m.ScheduleChangePreview })));
const Login = lazy(() => import("./components/Login").then(m => ({ default: m.Login })));
const ProviderDashboard = lazy(() => import("./components/ProviderDashboard").then(m => ({ default: m.ProviderDashboard })));
const OnboardingTour = lazy(() => import("./components/OnboardingTour").then(m => ({ default: m.OnboardingTour })));
const AdminReadinessBanner = lazy(() => import("./components/schedule/AdminReadinessBanner").then(m => ({ default: m.AdminReadinessBanner })));
import { SparkAnnotation } from "spark-banana";
import { ViewToggle, type ViewMode } from "./components/ViewToggle";
import { NotificationBanner } from "./components/NotificationBanner";
import { ExportMenu } from "./components/ExportMenu";
import { ToastContainer } from "./components/Toast";
import { ErrorBoundary, ViewContent } from "./components/layout";
import { useScheduleStore } from "./store";
import { InstallPrompt } from "./components/InstallPrompt";
import { useOnboardingTour } from "@/hooks/useOnboardingTour";
import { TourPrompt } from "@/components/TourPrompt";
import { ThemeToggle } from "./components/ThemeToggle";
import { useNetworkStatus } from "./hooks/usePWA";
import { useAnomalyAlerts } from "./hooks/useAnomalyAlerts";
import {
  AlertTriangle,
  Save,
  Trash,
  AlertCircle,
  Sparkles,
  Undo2,
  Redo2,
  Bot,
  Layers,
  Menu,
  X,
  Users,
  MoreHorizontal,
  Upload,
  RefreshCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import "./styles/PrintStyles.css";
import { DndContext, type DragEndEvent, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { applyScheduleImport, hasImportRollback, parseScheduleImportFile, rollbackLastImport, getAiHeaderMapping, type ImportFieldKey, type ImportPreviewResult } from "./lib/excelUtils";
import { saveScheduleState, loadScheduleState, multiAgentOptimize, buildOptimizationPreview } from "./lib/api";
import { AutoScheduleButton } from "./components/AutoScheduleButton";
import type { OptimizationPreview } from "./components/ScheduleChangePreview";
import { useScheduleReadiness } from "./components/schedule/useScheduleReadiness";
import { supabase } from "./lib/supabase";
import { useMemo, useRef, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { motion, AnimatePresence } from "framer-motion";
import { buildScheduleRiskDigest } from "@/lib/scheduleRisk";

export default function App() {
  // Select only the fields this component uses (shallow-compared) — a bare
  // useScheduleStore() subscribes to the whole store and re-renders the
  // entire admin tree on every toast, copilot, or marketplace mutation.
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
    restoreLastKnownGoodSchedule,
  } = useScheduleStore(
    useShallow((s) => ({
      autoAssign: s.autoAssign,
      assignShift: s.assignShift,
      startDate: s.startDate,
      numWeeks: s.numWeeks,
      setScheduleRange: s.setScheduleRange,
      slots: s.slots,
      providers: s.providers,
      scenarios: s.scenarios,
      createScenario: s.createScenario,
      loadScenario: s.loadScenario,
      deleteScenario: s.deleteScenario,
      lastActionMessage: s.lastActionMessage,
      clearMessage: s.clearMessage,
      undo: s.undo,
      redo: s.redo,
      canUndo: s.canUndo,
      canRedo: s.canRedo,
      clearStaff: s.clearStaff,
      clearSchedule: s.clearSchedule,
      customRules: s.customRules,
      auditLog: s.auditLog,
      showToast: s.showToast,
      currentUser: s.currentUser,
      initialize: s.initialize,
      isCopilotOpen: s.isCopilotOpen,
      toggleCopilot: s.toggleCopilot,
      showChangePreview: s.showChangePreview,
      changePreviewData: s.changePreviewData,
      closeChangePreview: s.closeChangePreview,
      applyAllAISuggestions: s.applyAllAISuggestions,
      rejectAISuggestions: s.rejectAISuggestions,
      openChangePreviewWithMultiAgentResult: s.openChangePreviewWithMultiAgentResult,
      restoreLastKnownGoodSchedule: s.restoreLastKnownGoodSchedule,
    })),
  );

  // Mobile sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
  const [showLanding, setShowLanding] = useState(() => {
    if (typeof window !== "undefined" && window.location.hash === "#admin") return false;
    return !currentUser;
  });
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);
  const [showMoreOps, setShowMoreOps] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const [isMultiAgentOptimizing, setIsMultiAgentOptimizing] = useState(false);
  const [showAvailabilityPanel, setShowAvailabilityPanel] = useState(() => {
    const stored = localStorage.getItem('nicu-availability-panel-open');
    return stored !== 'false';
  });
  const isOnline = useNetworkStatus();
  const { alerts: anomalyAlerts } = useAnomalyAlerts();
  const onboarding = useOnboardingTour();

  const safeSlots = useMemo(() => Array.isArray(slots) ? slots : [], [slots]);
  const safeProviders = useMemo(() => Array.isArray(providers) ? providers : [], [providers]);

  const runMultiAgentOptimize = useCallback(async () => {
    setIsMultiAgentOptimizing(true);
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
  }, [safeSlots, safeProviders, startDate, numWeeks, scenarios, customRules, auditLog, showToast, openChangePreviewWithMultiAgentResult]);
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
                scenarios: state.scenarios ?? [],
                customRules: state.customRules ?? [],
                auditLog: state.auditLog ?? [],
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
      conflicts: "Conflicts",
      notifications: "Alerts",
      predictive: "ML Insights",
      templates: "Templates",
      "ai-test": "AI Test",
      smarthub: "SmartHub",
    };
    const segment = titles[viewMode] ?? "Schedule";
    document.title = `${segment} · Neuro ICU Staffing`;
  }, [currentUser, viewMode]);

  const scheduleReadiness = useScheduleReadiness({
    slots: safeSlots,
    providers: safeProviders,
    customRules,
    anomalyAlertCount: anomalyAlerts.length,
    autoSaveStatus,
    isOnline,
  });

  const riskDigest = useMemo(
    () => buildScheduleRiskDigest(safeSlots, safeProviders, customRules, anomalyAlerts.length),
    [safeSlots, safeProviders, customRules, anomalyAlerts.length],
  );
  const assigned = riskDigest.filledSlots;
  const coverage = riskDigest.coveragePercent;
  const criticalUnfilled = riskDigest.criticalUnfilledCount;
  const skillMismatchRisk = riskDigest.skillMismatchCount;
  const fatigueExposure = riskDigest.fatigueExposureCount;
  const overloaded = riskDigest.overloadedProviders;

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
      return <Suspense><LandingPage onLogin={() => setShowLanding(false)} /></Suspense>;
    }
    return (
      <>
        <Suspense><Login /></Suspense>
        <ToastContainer />
      </>
    );
  }

  if (currentUser.role === "CLINICIAN") {
    return (
      <>
        <Suspense><ProviderDashboard /></Suspense>
        <ToastContainer />
      </>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="relative min-h-dvh bg-background text-foreground">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="command-shell sticky top-0 z-30 border-b border-border/80 bg-surface/95 px-3 py-3 shadow-sm backdrop-blur-xl no-print sm:px-5"
        >
          <div className="mx-auto flex max-w-[1800px] flex-col gap-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground-muted">
                    <span>Neuro ICU Staffing</span>
                    <span>/</span>
                    <span className="text-primary capitalize">{viewMode}</span>
                  </div>
                  <h1 className="truncate text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-2xl">
                    Admin Command Center
                  </h1>
                </div>

                {currentUser && (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowUserMenu(v => !v)}
                      className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-2 text-sm font-medium text-foreground hover:bg-secondary/70 transition-colors"
                      title="User menu"
                      aria-label="Open user menu"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                        {currentUser.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                      </div>
                      <span className="hidden sm:inline">{currentUser.name?.split(' ')[0] || 'User'}</span>
                    </button>

                    {showUserMenu && (
                      <>
                        <button
                          type="button"
                          className="fixed inset-0 z-30 cursor-default"
                          onClick={() => setShowUserMenu(false)}
                          aria-label="Close menu"
                        />
                        <div className="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-border bg-surface p-3 shadow-xl">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                              {currentUser.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">{currentUser.name}</p>
                              <p className="truncate text-xs text-foreground-muted">{currentUser.email}</p>
                            </div>
                          </div>
                          <div className="mt-3 border-t border-border pt-3">
                            <span className={cn(
                              "inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
                              currentUser.role === "ADMIN"
                                ? "bg-primary/10 text-primary"
                                : "bg-success/10 text-success"
                            )}>
                              {currentUser.role === "ADMIN" ? "Admin" : "Clinician"}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 xl:min-w-[620px]">
                <div className="ops-stat">
                  <span className="ops-stat-label">Coverage</span>
                  <span className="ops-stat-value">{coverage}%</span>
                  <span className={cn("ops-stat-dot", coverage >= 95 ? "bg-success" : "bg-warning")} />
                </div>
                <div className="ops-stat">
                  <span className="ops-stat-label">Filled</span>
                  <span className="ops-stat-value">{assigned}/{safeSlots.length}</span>
                </div>
                <div className="ops-stat">
                  <span className="ops-stat-label">Critical gaps</span>
                  <span className={cn("ops-stat-value", criticalUnfilled > 0 ? "text-error" : "text-success")}>{criticalUnfilled}</span>
                </div>
                <div className="ops-stat">
                  <span className="ops-stat-label">Skill risk</span>
                  <span className={cn("ops-stat-value", skillMismatchRisk > 0 ? "text-warning" : "text-success")}>{skillMismatchRisk}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  title="Import"
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImport}
                />

                <div className="command-group">
                  <button onClick={handleUndo} disabled={!canUndo()} className="command-icon" title="Undo" aria-label="Undo"><Undo2 className="w-4 h-4" /></button>
                  <button onClick={handleRedo} disabled={!canRedo()} className="command-icon" title="Redo" aria-label="Redo"><Redo2 className="w-4 h-4" /></button>
                </div>

                <div className="command-group">
                  <label className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-foreground-secondary">
                    <span>Start</span>
                    <input type="date" title="Start Date" aria-label="Start Date" value={startDate} onChange={(e) => setScheduleRange(e.target.value, numWeeks)} className="w-[8.75rem] rounded-md border border-border bg-surface px-2 py-1 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </label>
                  <label className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-foreground-secondary">
                    <input type="number" min={1} max={12} title="Weeks" aria-label="Weeks" value={numWeeks} onChange={(e) => setScheduleRange(startDate, Math.min(12, Math.max(1, Number(e.target.value) || 1)))} className="w-10 rounded-md border border-border bg-surface px-1 py-1 text-center text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    <span>wks</span>
                  </label>
                </div>

                <div className="command-group">
                  <button onClick={() => fileInputRef.current?.click()} className="command-button" title="Import schedule from Excel">
                    <Upload className="w-3.5 h-3.5" />
                    Import
                  </button>
                  <ExportMenu />
                </div>

                <div className="command-group">
                  <AutoScheduleButton />
                  <motion.button type="button" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={autoAssign} className="command-button text-primary">
                    <Sparkles className="w-3.5 h-3.5" />
                    Auto-Fill
                  </motion.button>
                  <motion.button type="button" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={runMultiAgentOptimize} disabled={isMultiAgentOptimizing} className="command-button text-primary disabled:opacity-50">
                    <Bot className="w-3.5 h-3.5" />
                    {isMultiAgentOptimizing ? "Optimizing..." : "Optimize"}
                  </motion.button>
                </div>

                {/* More Operations Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowMoreOps(v => !v)}
                    className={cn("command-button", showMoreOps && "bg-secondary text-foreground")}
                    title="More schedule operations"
                    aria-label="More operations"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                    <span className="hidden sm:inline">More</span>
                  </button>

                  {showMoreOps && (
                    <>
                      <button
                        type="button"
                        className="fixed inset-0 z-30 cursor-default"
                        onClick={() => setShowMoreOps(false)}
                        aria-label="Close operations menu"
                      />
                      <div className="absolute left-0 z-40 mt-1.5 w-56 rounded-xl border border-border bg-surface p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                        {canRollbackImport && (
                          <button
                            type="button"
                            onClick={() => { setShowMoreOps(false); handleRollbackImport(); }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors"
                          >
                            <RefreshCcw className="w-3.5 h-3.5 text-foreground-muted" />
                            Rollback Latest Import
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => { setShowMoreOps(false); handleServerSave(); }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors"
                        >
                          <Save className="w-3.5 h-3.5 text-foreground-muted" />
                          Save State to Cloud
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowMoreOps(false); restoreLastKnownGoodSchedule(); }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                        >
                          <RefreshCcw className="w-3.5 h-3.5 text-primary" />
                          Restore Last Good Schedule
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowMoreOps(false); setShowScenarios(v => !v); }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors"
                        >
                          <Layers className="w-3.5 h-3.5 text-foreground-muted" />
                          Manage Scenarios
                        </button>
                        <div className="my-1 border-t border-border" />
                        <button
                          type="button"
                          onClick={() => { setShowMoreOps(false); handleClearSchedule(); }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-warning hover:bg-warning/10 transition-colors"
                        >
                          <Trash className="w-3.5 h-3.5" />
                          Clear Assignments
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowMoreOps(false); handleClearStaff(); }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-error hover:bg-error/10 transition-colors"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Reset Staff Profiles
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {autoSaveStatus !== "idle" && (
                  <span className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-semibold",
                    (autoSaveStatus === "saving" || autoSaveStatus === "pending") && "bg-primary/10 text-primary animate-pulse",
                    autoSaveStatus === "saved" && "bg-success/10 text-success",
                    autoSaveStatus === "error" && "bg-error/10 text-error"
                  )}>
                    {autoSaveStatus === "pending" ? "Pending" : autoSaveStatus === "saving" ? "Saving" : autoSaveStatus === "saved" ? "Saved" : "Save failed"}
                  </span>
                )}

                <div className="command-group">
                  <button
                    type="button"
                    onClick={() => setViewMode("notifications")}
                    className={cn("command-button", anomalyAlerts.length > 0 && "bg-warning/10 text-warning border-warning/20")}
                    title="View alerts"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    {anomalyAlerts.length} alerts
                  </button>
                  <button
                    type="button"
                    onClick={toggleCopilot}
                    className={cn("command-button", isCopilotOpen && "bg-primary text-primary-foreground")}
                    title="AI Assistant"
                    aria-label="Toggle AI assistant"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    AI
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const newValue = !showAvailabilityPanel;
                      setShowAvailabilityPanel(newValue);
                      localStorage.setItem('nicu-availability-panel-open', String(newValue));
                    }}
                    className={cn("command-button", showAvailabilityPanel && "bg-primary text-primary-foreground")}
                    title="Staff Dashboard"
                    aria-label="Toggle staff dashboard"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Staff
                  </button>
                  <ThemeToggle variant="icon" />
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5">
                  <div className={cn("h-2 w-2 rounded-full", isOnline ? "bg-success" : "bg-error")} />
                  <span className={cn("text-xs font-semibold", isOnline ? "text-success" : "text-error")}>{isOnline ? "Online" : "Offline"}</span>
                </div>
              </div>
            </div>

            {/* Scenarios Drawer (conditionally visible) */}
            <AnimatePresence>
              {showScenarios && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-t border-border/70 pt-2"
                >
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    <span className="text-xs font-semibold text-foreground-muted shrink-0 flex items-center gap-1">
                      <Layers className="w-3 h-3" /> Scenarios:
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <input
                        value={scenarioName}
                        onChange={(e) => setScenarioName(e.target.value)}
                        placeholder="New scenario name..."
                        className="w-36 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none"
                      />
                      <button title="Save scenario" aria-label="Save scenario" onClick={() => { createScenario(scenarioName); setScenarioName(""); }} className="command-icon"><Save className="w-3.5 h-3.5" /></button>
                    </div>
                    <AnimatePresence>
                      {scenarios.map((scenario) => (
                        <motion.div
                          key={scenario.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          className="group flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-all hover:border-primary/40"
                          onClick={() => loadScenario(scenario.id)}
                        >
                          {scenario.name}
                          <button
                            title="Delete scenario"
                            aria-label="Delete scenario"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete scenario "${scenario.name}"?`)) {
                                deleteScenario(scenario.id);
                              }
                            }}
                            className="p-0.5 text-error opacity-0 transition-opacity group-hover:opacity-100 hover:scale-110"
                          >
                            <Trash className="w-3 h-3" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {(lastActionMessage || overloaded.length > 0 || fatigueExposure > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex max-w-3xl items-start gap-3 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-foreground-secondary"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <div className="min-w-0 flex-1 leading-relaxed">
                    {lastActionMessage && <p className="font-semibold text-foreground">{lastActionMessage}</p>}
                    {overloaded.length > 0 && <p>Overload: {overloaded.map(p => p.providerName).join(", ")}</p>}
                    {fatigueExposure > 0 && <p>Fatigue: {fatigueExposure} exposure(s).</p>}
                  </div>
                  <button onClick={clearMessage} className="shrink-0 text-xs font-semibold text-warning hover:text-foreground">Dismiss</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.header>

        <div className="mx-auto grid max-w-[1800px] grid-cols-1 gap-4 px-3 py-4 sm:px-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="hidden min-w-0 flex-col gap-4 xl:flex">
            <Suspense><ProviderManager /></Suspense>
            {showAvailabilityPanel && (
              <Suspense fallback={<div className="rounded-lg border border-border bg-surface p-4 text-sm text-foreground-muted">Loading staff dashboard...</div>}>
                <ProviderAvailabilityPanel
                  isOpen={true}
                  onClose={() => setShowAvailabilityPanel(false)}
                  displayMode="inline"
                  defaultView="dashboard"
                />
              </Suspense>
            )}
          </aside>

          <motion.main
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="min-w-0 flex flex-col gap-4"
          >
            <NotificationBanner
              criticalGaps={criticalUnfilled}
              skillRisks={skillMismatchRisk}
              fatigueExposures={fatigueExposure}
              onViewDetails={() => setViewMode("notifications")}
            />

            <div className="satin-panel p-3">
              <ViewToggle view={viewMode} onChange={setViewMode} />
            </div>

            {viewMode === 'schedule' && (
              <Suspense>
                <AdminReadinessBanner
                  readiness={scheduleReadiness}
                  onViewAlerts={() => setViewMode("notifications")}
                />
              </Suspense>
            )}

            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="fixed bottom-4 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg xl:hidden"
              aria-label="Open staff sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <AnimatePresence>
              {isSidebarOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsSidebarOpen(false)}
                    className="fixed inset-0 z-40 bg-black/45 xl:hidden"
                    aria-hidden="true"
                  />
                  <motion.aside
                    initial={{ x: "-100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "-100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed bottom-0 left-0 top-0 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-y-auto border-r border-border bg-surface shadow-2xl xl:hidden"
                  >
                    <div className="flex items-center justify-between border-b border-border p-4">
                      <span className="text-sm font-semibold text-foreground">Staff rail</span>
                      <button
                        type="button"
                        onClick={() => setIsSidebarOpen(false)}
                        className="rounded-md p-1 transition-colors hover:bg-secondary"
                        aria-label="Close sidebar"
                      >
                        <X className="w-5 h-5 text-foreground-muted" />
                      </button>
                    </div>
                    <div className="p-4">
                      <Suspense><ProviderManager /></Suspense>
                    </div>
                  </motion.aside>
                </>
              )}
            </AnimatePresence>

            <div className="w-full pb-16">
              <ErrorBoundary>
                <ViewContent viewMode={viewMode} />
              </ErrorBoundary>
            </div>
          </motion.main>
        </div>
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
                  <div className="flex items-start gap-3 mb-3">
                    <span className="w-5 h-5 flex-shrink-0 mt-0.5 text-warning">⚠</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">Column mapping required</p>
                      <p className="text-xs text-foreground-muted mt-0.5">Map Excel columns to schedule fields below, then click "Re-validate" or use "AI Smart Map" for automatic mapping.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(["date", "night", "dayG20", "dayH22", "dayAkron", "consults", "dayAmet", "dayNmet", "jeopardy", "recovery", "vacation"] as ImportFieldKey[]).map((field) => (
                      <label key={field} className="flex flex-col gap-1 text-sm text-foreground-secondary">
                        <span className="font-medium text-foreground">{field} {field === "date" && <span className="text-warning ml-1">*</span>}</span>
                        <select value={columnMapping[field] ?? ""} onChange={(e) => setColumnMapping((prev) => ({ ...prev, [field]: e.target.value }))} className="input-base rounded-lg py-2" required={field === "date"}>
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
      {!onboarding.hasSeenTour && (
        <TourPrompt
          onStart={onboarding.startTour}
          onDismiss={onboarding.completeTour}
        />
      )}
      {isCopilotOpen && (
        <Suspense fallback={<div className="w-80 bg-card p-4">Loading...</div>}>
          <CopilotPanel isOpen={isCopilotOpen} onToggle={toggleCopilot} />
        </Suspense>
      )}

      <Suspense>
        <OnboardingTour
          isOpen={onboarding.isOpen}
          onClose={onboarding.closeTour}
          onComplete={onboarding.completeTour}
        />
      </Suspense>

      {/* AI Change Preview Modal */}
      {showChangePreview && !!changePreviewData && (
        <Suspense>
          <ScheduleChangePreview
            preview={changePreviewData as OptimizationPreview}
            isOpen={showChangePreview}
            onClose={closeChangePreview}
            onAccept={applyAllAISuggestions}
            onReject={rejectAISuggestions}
          />
        </Suspense>
      )}

      {import.meta.env.DEV && (
        <SparkAnnotation projectRoot={import.meta.env.VITE_SPARK_PROJECT_ROOT as string} />
      )}
    </DndContext>
  );
}
