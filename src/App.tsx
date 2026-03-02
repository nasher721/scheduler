import { ProviderManager } from "./components/ProviderManager";
import { Calendar } from "./components/Calendar";
import { MonthlyCalendar } from "./components/MonthlyCalendar";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { RuleBuilder } from "./components/RuleBuilder";
import { ViewToggle, type ViewMode } from "./components/ViewToggle";
import { ToastContainer } from "./components/Toast";
import { getProviderCounts, useScheduleStore } from "./store";
import {
  Calendar as CalendarIcon,
  XCircle,
  FileSpreadsheet,
  Upload,
  AlertTriangle,
  Save,
  FolderOpen,
  Trash,
  TrendingUp,
  Users,
  AlertCircle,
  Zap,
  Sparkles,
  Undo2,
  Redo2,
  Printer
} from "lucide-react";
import "./styles/PrintStyles.css";
import { DndContext, type DragEndEvent, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { exportScheduleToExcel, importScheduleFromExcel } from "./lib/excelUtils";
import { loadScheduleState, saveScheduleState } from "./lib/api";
import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function App() {
  const {
    autoAssign,
    clearAssignments,
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
    customRules,
    auditLog,
    showToast,
  } = useScheduleStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [scenarioName, setScenarioName] = useState("");

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  const assigned = slots.filter((slot) => slot.providerId).length;
  const coverage = Math.round((assigned / Math.max(slots.length, 1)) * 100);
  const counts = useMemo(() => getProviderCounts(slots, providers), [slots, providers]);
  const overloaded = providers.filter((p) => {
    const c = counts[p.id];
    return c && (
      c.weekDays > p.targetWeekDays
      || c.weekendDays > p.targetWeekendDays
      || c.weekNights > p.targetWeekNights
      || c.weekendNights > p.targetWeekendNights
    );
  });
  const criticalUnfilled = slots.filter((slot) => slot.priority === "CRITICAL" && !slot.providerId).length;
  const skillMismatchRisk = slots.filter((slot) => {
    if (!slot.providerId) return false;
    const provider = providers.find((p) => p.id === slot.providerId);
    return provider ? !provider.skills.includes(slot.requiredSkill) : false;
  }).length;
  const fatigueExposure = providers.filter((p) => counts[p.id] && counts[p.id].weekNights + counts[p.id].weekendNights > p.targetWeekNights + p.targetWeekendNights).length;

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
        await importScheduleFromExcel(file);
      } catch {
        alert("Failed to parse Excel schedule.");
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
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

  const handleServerLoad = async () => {
    try {
      const result = await loadScheduleState();
      if (!result.state) {
        showToast({ type: "warning", title: "No Server State", message: "No saved server-side schedule found yet." });
        return;
      }

      useScheduleStore.setState((current) => ({
        ...current,
        providers: result.state!.providers as typeof current.providers,
        startDate: result.state!.startDate,
        numWeeks: result.state!.numWeeks,
        slots: result.state!.slots as typeof current.slots,
        scenarios: result.state!.scenarios as typeof current.scenarios,
        customRules: result.state!.customRules as typeof current.customRules,
        auditLog: result.state!.auditLog as typeof current.auditLog,
      }));

      showToast({ type: "success", title: "Loaded from Server", message: "Backend data restored into the app." });
    } catch {
      showToast({ type: "error", title: "Load Failed", message: "Unable to fetch persisted state from API server." });
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="min-h-screen p-6 md:p-8 lg:p-10 flex flex-col gap-8 relative z-10">
        {/* Header Section */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex flex-col gap-6"
        >
          <div className="print-header">
            <h1 className="text-3xl font-bold">Neuro ICU Staffing Schedule</h1>
            <p className="text-slate-600">Generated on {new Date().toLocaleDateString()} | Starting: {startDate} | {numWeeks} Weeks</p>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 no-print">
            <div className="flex items-start gap-4">
              {/* Logo */}
              <motion.div
                whileHover={{ scale: 1.05, rotate: -2 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className="p-3 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/25"
              >
                <CalendarIcon className="w-8 h-8 text-white" />
              </motion.div>

              <div>
                <h1 className="text-3xl lg:text-4xl font-bold tracking-tight bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-transparent">
                  Neuro ICU Schedule
                </h1>
                <p className="text-sm text-slate-500 mt-1.5 max-w-xl leading-relaxed">
                  Intelligent scheduling with skill-aware staffing, fatigue guardrails, preference-weighted auto-fill, and real-time analytics.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <input
                title="Import File"
                aria-label="Import File"
                type="file"
                accept=".xlsx"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImport}
              />

              {/* Undo/Redo */}
              <div className="flex items-center gap-1">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleUndo}
                  disabled={!canUndo()}
                  className={`btn btn-ghost btn-icon ${!canUndo() ? 'opacity-40 cursor-not-allowed' : ''}`}
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleRedo}
                  disabled={!canRedo()}
                  className={`btn btn-ghost btn-icon ${!canRedo() ? 'opacity-40 cursor-not-allowed' : ''}`}
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 className="w-4 h-4" />
                </motion.button>
              </div>

              <div className="w-px h-6 bg-slate-200 mx-1" />

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-secondary btn-sm"
              >
                <Upload className="w-4 h-4" />
                Import
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={exportScheduleToExcel}
                className="btn btn-secondary btn-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => window.print()}
                className="btn btn-secondary btn-sm"
              >
                <Printer className="w-4 h-4" />
                Print/PDF
              </motion.button>

              <div className="w-px h-6 bg-slate-200 mx-1" />

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={clearAssignments}
                className="btn btn-ghost btn-sm"
              >
                <XCircle className="w-4 h-4" />
                Clear
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={autoAssign}
                className="btn btn-primary btn-sm"
              >
                <Sparkles className="w-4 h-4" />
                Auto-Fill
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleServerSave}
                className="btn btn-secondary btn-sm"
              >
                Save API
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleServerLoad}
                className="btn btn-secondary btn-sm"
              >
                Load API
              </motion.button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="stat-card"
            >
              <TrendingUp className="stat-icon w-5 h-5 text-emerald-500" />
              <p className="stat-value">{coverage}%</p>
              <p className="stat-label">Coverage</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="stat-card"
            >
              <Users className="stat-icon w-5 h-5 text-blue-500" />
              <p className="stat-value">{assigned}<span className="text-base font-normal text-slate-400">/{slots.length}</span></p>
              <p className="stat-label">Assigned</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="stat-card"
            >
              <AlertCircle className="stat-icon w-5 h-5 text-rose-500" />
              <p className="stat-value text-rose-600">{criticalUnfilled}</p>
              <p className="stat-label">Critical</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="stat-card"
            >
              <Zap className="stat-icon w-5 h-5 text-amber-500" />
              <p className="stat-value text-amber-600">{skillMismatchRisk}</p>
              <p className="stat-label">Skill Risk</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="stat-card"
            >
              <p className="stat-label mb-2">Start Date</p>
              <input
                title="Start Date"
                aria-label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setScheduleRange(e.target.value, numWeeks)}
                className="input-base text-sm font-medium"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="stat-card"
            >
              <p className="stat-label mb-2">Weeks</p>
              <input
                title="Number of Weeks"
                aria-label="Number of Weeks"
                type="number"
                min={1}
                max={12}
                value={numWeeks}
                onChange={(e) => setScheduleRange(startDate, Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
                className="input-base input-number text-sm font-medium"
              />
            </motion.div>
          </div>

          {/* Scenario Manager */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-panel-light p-4"
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex flex-1 gap-2">
                <input
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="New scenario name..."
                  className="input-base flex-1"
                />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { createScenario(scenarioName); setScenarioName(""); }}
                  className="btn btn-primary btn-sm whitespace-nowrap"
                >
                  <Save className="w-4 h-4" />
                  Save
                </motion.button>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                {scenarios.length === 0 ? (
                  <p className="text-xs text-slate-400 px-2">No saved scenarios</p>
                ) : (
                  <AnimatePresence>
                    {scenarios.map((scenario) => (
                      <motion.div
                        key={scenario.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors text-xs"
                      >
                        <span className="font-medium text-slate-700">{scenario.name}</span>
                        <button
                          onClick={() => loadScenario(scenario.id)}
                          className="p-1 hover:bg-white rounded-full transition-colors"
                          title="Load"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                        </button>
                        <button
                          onClick={() => deleteScenario(scenario.id)}
                          className="p-1 hover:bg-white rounded-full transition-colors"
                          title="Delete"
                        >
                          <Trash className="w-3.5 h-3.5 text-rose-500" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </motion.div>

          {/* Alert Banner */}
          <AnimatePresence>
            {(lastActionMessage || overloaded.length > 0 || fatigueExposure > 0) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                  <div className="p-1 bg-amber-100 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 text-sm text-amber-800">
                    {lastActionMessage && <p>{lastActionMessage}</p>}
                    {overloaded.length > 0 && (
                      <p className="mt-1 font-medium">
                        Overloaded: {overloaded.map((p) => p.name).join(", ")}
                      </p>
                    )}
                    {fatigueExposure > 0 && (
                      <p className="mt-1">
                        <span className="font-medium">Fatigue alert:</span> {fatigueExposure} provider(s) exceed night shift targets.
                      </p>
                    )}
                  </div>
                  {lastActionMessage && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={clearMessage}
                      className="text-xs font-medium text-amber-700 hover:text-amber-900 px-2 py-1 rounded-lg hover:bg-amber-100 transition-colors"
                    >
                      Dismiss
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.header>

        {/* Main Content */}
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col xl:flex-row gap-8 items-start flex-1"
        >
          <ProviderManager />
          <div className="flex-1 w-full flex flex-col min-w-0">
            <div className="flex justify-end mb-4">
              <ViewToggle view={viewMode} onChange={setViewMode} />
            </div>
            <div className="w-full overflow-x-auto pb-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={viewMode}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {viewMode === "analytics" ? (
                    <AnalyticsDashboard />
                  ) : viewMode === "calendar" ? (
                    <MonthlyCalendar />
                  ) : viewMode === "rules" ? (
                    <RuleBuilder />
                  ) : (
                    <Calendar />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.main>
      </div>

      {/* Toast Container */}
      <ToastContainer />
    </DndContext>
  );
}
