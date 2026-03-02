import { ProviderManager } from "./components/ProviderManager";
import { Calendar } from "./components/Calendar";
import { MonthlyCalendar } from "./components/MonthlyCalendar";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { RuleBuilder } from "./components/RuleBuilder";
import { ViewToggle, type ViewMode } from "./components/ViewToggle";
import { ToastContainer } from "./components/Toast";
import { getProviderCounts, useScheduleStore } from "./store";
import {
  AlertTriangle,
  Save,
  Trash,
  AlertCircle,
  Zap,
  Sparkles,
  Undo2,
  Redo2
} from "lucide-react";
import "./styles/PrintStyles.css";
import { DndContext, type DragEndEvent, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { importScheduleFromExcel } from "./lib/excelUtils";
import { saveScheduleState } from "./lib/api";
import { useMemo, useRef, useState } from "react";
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
    customRules,
    auditLog,
    showToast,
    isDirty,
    markClean,
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
      markClean();
      showToast({ type: "success", title: "Saved to Server", message: "Current schedule state is now persisted on the backend." });
    } catch {
      showToast({ type: "error", title: "Save Failed", message: "Unable to reach API server." });
    }
  };


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
                  <button
                    onClick={handleServerSave}
                    className={`relative p-2 transition-colors ${isDirty ? "text-amber-500 hover:text-amber-600" : "text-slate-400 hover:text-primary"}`}
                    title={isDirty ? "Unsaved changes — click to save" : "Sync API"}
                  >
                    <Save className="w-4 h-4" />
                    {isDirty && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />}
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
            <div className="flex justify-between items-center mb-6">
              <div className="h-[1px] flex-1 bg-slate-200/60 mr-8" />
              <ViewToggle view={viewMode} onChange={setViewMode} />
            </div>

            <div className="w-full pb-20">
              <AnimatePresence mode="wait">
                <motion.div
                  key={viewMode}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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

      <ToastContainer />
    </DndContext>
  );
}
