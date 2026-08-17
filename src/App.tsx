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
const GlobalSearch = lazy(() => import("./components/GlobalSearch").then(m => ({ default: m.GlobalSearch })));
import { SparkAnnotation } from "spark-banana";
import { NotificationBanner } from "./components/NotificationBanner";
import { ToastContainer } from "./components/Toast";
import { AppShell, ErrorBoundary, ExportDialog, TopBar, ViewContent, VIEW_META, WorkspaceMenu, type SaveStatus, type ViewMode } from "./components/layout";
import { useScheduleStore } from "./store";
import { InstallPrompt } from "./components/InstallPrompt";
import { useOnboardingTour } from "@/hooks/useOnboardingTour";
import { TourPrompt } from "@/components/TourPrompt";
import { useNetworkStatus } from "./hooks/usePWA";
import { useAnomalyAlerts } from "./hooks/useAnomalyAlerts";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import {
  AlertTriangle,
  Bot,
  Layers,
  Save,
  Sparkles,
  Trash,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import "./styles/PrintStyles.css";
import { DndContext, type DragEndEvent, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { applyScheduleImport, hasImportRollback, parseScheduleImportFile, rollbackLastImport, getAiHeaderMapping, type ImportFieldKey, type ImportPreviewResult } from "./lib/excelUtils";
import { saveScheduleState, loadScheduleState } from "./lib/api";
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
      restoreLastKnownGoodSchedule: s.restoreLastKnownGoodSchedule,
    })),
  );

  // Mobile navigation drawer state
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<SaveStatus>("idle");
  const [showStaffRail, setShowStaffRail] = useState(() => {
    const stored = localStorage.getItem('nicu-availability-panel-open');
    return stored !== 'false';
  });
  const isOnline = useNetworkStatus();
  const { alerts: anomalyAlerts } = useAnomalyAlerts();
  const onboarding = useOnboardingTour();

  const safeSlots = useMemo(() => Array.isArray(slots) ? slots : [], [slots]);
  const safeProviders = useMemo(() => Array.isArray(providers) ? providers : [], [providers]);
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
    document.title = `${VIEW_META[viewMode].title} · Neuro ICU Staffing`;
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

  const toggleStaffRail = () => {
    const next = !showStaffRail;
    setShowStaffRail(next);
    localStorage.setItem('nicu-availability-panel-open', String(next));
  };

  useKeyboardShortcuts([
    { key: "k", meta: true, description: "Search", action: () => setIsSearchOpen(true), preventDefault: true },
    { key: "k", ctrl: true, description: "Search", action: () => setIsSearchOpen(true), preventDefault: true },
  ]);

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

  const isScheduleView = viewMode === "schedule";
  const showRail = isScheduleView && showStaffRail;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <AppShell
        view={viewMode}
        onViewChange={setViewMode}
        isSidebarOpen={isSidebarOpen}
        onSidebarOpenChange={setIsSidebarOpen}
        topBar={
          <TopBar
            title={VIEW_META[viewMode].title}
            hint={VIEW_META[viewMode].hint}
            saveStatus={autoSaveStatus}
            isOnline={isOnline}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenSidebar={() => setIsSidebarOpen(true)}
            actions={
              <div className="flex shrink-0 items-center gap-1.5">
                <AutoScheduleButton />
                {isScheduleView && (
                  <button
                    type="button"
                    onClick={toggleStaffRail}
                    aria-pressed={showStaffRail}
                    title="Staff panel"
                    aria-label="Toggle staff panel"
                    className={cn(
                      "hidden h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors xl:flex",
                      showStaffRail ? "bg-secondary text-foreground" : "text-foreground-secondary hover:bg-secondary/70",
                    )}
                  >
                    <Users className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleCopilot}
                  aria-pressed={isCopilotOpen}
                  title="AI assistant"
                  aria-label="Toggle AI assistant"
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
                    isCopilotOpen
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-foreground-secondary hover:bg-secondary/70",
                  )}
                >
                  <Bot className="h-4 w-4" />
                </button>
                <WorkspaceMenu
                  startDate={startDate}
                  numWeeks={numWeeks}
                  onScheduleRangeChange={setScheduleRange}
                  canUndo={canUndo()}
                  canRedo={canRedo()}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  onAutoFill={autoAssign}
                  onImport={() => fileInputRef.current?.click()}
                  onExport={() => setIsExportOpen(true)}
                  canRollbackImport={canRollbackImport}
                  onRollbackImport={handleRollbackImport}
                  onToggleScenarios={() => setShowScenarios((v) => !v)}
                  onSaveToServer={handleServerSave}
                  onRestoreLastGood={restoreLastKnownGoodSchedule}
                  onClearSchedule={handleClearSchedule}
                  onClearStaff={handleClearStaff}
                />
              </div>
            }
          />
        }
      >
        <input
          title="Import"
          type="file"
          accept=".xlsx"
          className="hidden"
          ref={fileInputRef}
          onChange={handleImport}
        />

        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4">
          <AnimatePresence>
            {showScenarios && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="no-print overflow-hidden"
              >
                <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-border bg-surface px-3 py-2 scrollbar-hide">
                  <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-foreground-muted">
                    <Layers className="h-3.5 w-3.5" /> Scenarios
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <input
                      value={scenarioName}
                      onChange={(e) => setScenarioName(e.target.value)}
                      placeholder="New scenario name…"
                      className="w-40 rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                    <button
                      title="Save scenario"
                      aria-label="Save scenario"
                      onClick={() => { createScenario(scenarioName); setScenarioName(""); }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Save className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {scenarios.map((scenario) => (
                    <div
                      key={scenario.id}
                      className="group flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40"
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
                        className="p-0.5 text-error opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Trash className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
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
                className="no-print flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/[0.07] px-3.5 py-2.5 text-sm text-foreground-secondary"
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

          {/* On the schedule the readiness line already reports gaps, risks and
              fatigue — two banners saying the same thing is the noise we removed. */}
          {isScheduleView ? (
            <Suspense>
              <AdminReadinessBanner
                readiness={scheduleReadiness}
                onViewAlerts={() => setViewMode("notifications")}
              />
            </Suspense>
          ) : (
            <NotificationBanner
              criticalGaps={criticalUnfilled}
              skillRisks={skillMismatchRisk}
              fatigueExposures={fatigueExposure}
              onViewDetails={() => setViewMode("notifications")}
            />
          )}

          <div className={cn("grid min-w-0 gap-4 pb-10", showRail && "xl:grid-cols-[minmax(0,1fr)_300px]")}>
            <div className="min-w-0">
              <ErrorBoundary>
                <ViewContent viewMode={viewMode} />
              </ErrorBoundary>
            </div>

            {showRail && (
              <aside className="no-print hidden min-w-0 flex-col gap-4 xl:flex">
                <Suspense><ProviderManager /></Suspense>
                <Suspense fallback={<div className="rounded-xl border border-border bg-surface p-4 text-sm text-foreground-muted">Loading staff dashboard…</div>}>
                  <ProviderAvailabilityPanel
                    isOpen={true}
                    onClose={() => toggleStaffRail()}
                    displayMode="inline"
                    defaultView="dashboard"
                  />
                </Suspense>
              </aside>
            )}
          </div>
        </div>
      </AppShell>

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

      <Suspense>
        <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      </Suspense>

      <AnimatePresence>
        {isExportOpen && <ExportDialog isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />}
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
