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
  Trash,
  Users,
  Upload,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import "./styles/PrintStyles.css";
import { DndContext, type DragEndEvent, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { applyScheduleImport, hasImportRollback, parseScheduleImportFile, rollbackLastImport, type ImportFieldKey, type ImportPreviewResult } from "./lib/excelUtils";
import { saveScheduleState, loadScheduleState } from "./lib/api";
import { AutoScheduleButton } from "./components/AutoScheduleButton";
import type { OptimizationPreview } from "./components/ScheduleChangePreview";
import { useScheduleReadiness } from "./components/schedule/useScheduleReadiness";
import { supabase, supabaseStatus } from "./lib/supabase";
import { useMemo, useRef, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { motion, AnimatePresence } from "framer-motion";
import { buildScheduleRiskDigest } from "@/lib/scheduleRisk";
import { weekOffsetForDate } from "./components/schedule/scheduleViewportUtils";
import { parseISO } from "date-fns";
import { ImportPreviewDialog } from "./components/schedule/ImportPreviewDialog";

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
  const [isImportBusy, setIsImportBusy] = useState(false);
  const importFileRef = useRef<File | null>(null);
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
    return stored === 'true';
  });
  const isOnline = useNetworkStatus();
  const { alerts: anomalyAlerts } = useAnomalyAlerts();
  const onboarding = useOnboardingTour();

  useEffect(() => {
    if (!showStaffRail || window.matchMedia('(min-width: 1280px)').matches) return;
    const frame = requestAnimationFrame(() => {
      const team = document.getElementById('physician-team');
      team?.focus();
      team?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [showStaffRail]);

  const safeSlots = useMemo(() => Array.isArray(slots) ? slots : [], [slots]);
  const safeProviders = useMemo(() => Array.isArray(providers) ? providers : [], [providers]);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  // ── Autosave: debounce 4s after any slot or provider change ───────────
  const performSave = useCallback(async () => {
    setAutoSaveStatus("saving");
    try {
      const result = await saveScheduleState({
        providers: safeProviders,
        startDate,
        numWeeks,
        slots: safeSlots,
        scenarios,
        customRules,
        auditLog,
      });
      setAutoSaveStatus(result.offline ? "local" : "saved");
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
    if (!currentUser || supabaseStatus.isPlaceholder) return;
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

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    importFileRef.current = file;
    setIsImportBusy(true);
    try {
      const preview = await parseScheduleImportFile(file);
      setImportPreview(preview);
      setColumnMapping(preview.mapping);
      setIsImportOpen(true);
    } catch {
      showToast({ type: "error", title: "Import failed", message: "File could not be parsed. Confirm that the workbook has a header row and date column." });
    } finally {
      setIsImportBusy(false);
    }
  };

  const rerunImportPreview = async () => {
    const file = importFileRef.current;
    if (!file) return;
    setIsImportBusy(true);
    try {
      const preview = await parseScheduleImportFile(file, columnMapping);
      setImportPreview(preview);
      setColumnMapping(preview.mapping);
    } catch {
      showToast({ type: "error", title: "Validation failed", message: "Check the column mapping and try again." });
    } finally {
      setIsImportBusy(false);
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
      const result = await saveScheduleState({
        providers: safeProviders,
        startDate,
        numWeeks,
        slots: safeSlots,
        scenarios,
        customRules,
        auditLog,
      });
      setAutoSaveStatus(result.offline ? "local" : "saved");
      showToast({ type: result.offline ? "info" : "success", title: result.offline ? "Saved on this device" : "Saved to cloud", message: result.offline ? "Cloud storage is unavailable. Export a workbook to share or back up this schedule." : "The current schedule has been saved to cloud storage." });
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
                {isScheduleView && (
                  <button
                    type="button"
                    onClick={toggleStaffRail}
                    aria-pressed={showStaffRail}
                    title="Staff panel"
                    aria-label="Toggle staff panel"
                    className={cn(
                      "flex h-11 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm transition-colors",
                      showStaffRail ? "bg-secondary text-foreground" : "text-foreground-secondary hover:bg-secondary/70",
                    )}
                  >
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">Staff</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleCopilot}
                  aria-pressed={isCopilotOpen}
                  title="AI assistant"
                  aria-label="Toggle AI assistant"
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-md border transition-colors",
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
          accept=".xlsx,.xls,.csv"
          className="hidden"
          ref={fileInputRef}
          onChange={handleImport}
        />

        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4">
          {isScheduleView ? (
            <section className="flex flex-col justify-between gap-4 pb-1 sm:flex-row sm:items-center" aria-label="Scheduling workspace">
              <div>
                <h1 className="text-[30px] font-semibold leading-tight tracking-tight sm:text-[36px]">Coverage, clearly.</h1>
                <p className="mt-2 text-sm text-foreground-secondary sm:text-base">Your team. Every service. One shared schedule.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={isImportBusy} onClick={() => fileInputRef.current?.click()} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-primary/50 bg-surface px-4 text-sm font-medium text-primary sm:flex-none"><Upload className="h-4 w-4" aria-hidden="true" />{isImportBusy ? "Reading workbook…" : "Import Excel"}</button>
                <button type="button" onClick={() => setIsExportOpen(true)} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover sm:flex-none"><Download className="h-4 w-4" aria-hidden="true" />Export schedule</button>
              </div>
            </section>
          ) : (
            <div className="pb-2"><h1 className="text-3xl font-semibold">{VIEW_META[viewMode].title}</h1><p className="mt-2 text-sm text-foreground-secondary">{VIEW_META[viewMode].hint}</p></div>
          )}
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
                onViewOpenShifts={() => {
                  const state = useScheduleStore.getState();
                  state.resetScheduleViewportFilters();
                  state.setShowUnfilledOnly(true);
                  const firstOpen = safeSlots.find((slot) => slot.type !== "VACATION" && !slot.providerId);
                  const offset = firstOpen ? weekOffsetForDate(startDate, parseISO(firstOpen.date)) : null;
                  if (offset !== null) state.setCurrentWeekOffset(offset);
                }}
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
              <aside id="physician-team" tabIndex={-1} className="no-print flex min-w-0 scroll-mt-20 flex-col gap-4 outline-none" aria-label="Physician team">
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
          {isScheduleView && <div className="no-print flex flex-wrap items-center gap-3 border-t border-border pt-4"><AutoScheduleButton /><p className="text-sm text-foreground-secondary">Review suggested assignments before applying them to the schedule.</p></div>}
        </div>
      </AppShell>

      {isImportOpen && importPreview && (
        <ImportPreviewDialog
          preview={importPreview}
          mapping={columnMapping}
          busy={isImportBusy}
          onMappingChange={(field, value) => setColumnMapping((previous) => ({ ...previous, [field]: value }))}
          onValidate={rerunImportPreview}
          onApply={handleApplyImport}
          onClose={() => setIsImportOpen(false)}
        />
      )}

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
