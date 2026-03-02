import { ProviderManager } from "./components/ProviderManager";
import { Calendar } from "./components/Calendar";
import { MonthlyCalendar } from "./components/MonthlyCalendar";
import { ViewToggle, type ViewMode } from "./components/ViewToggle";
import { getProviderCounts, useScheduleStore } from "./store";
import { Calendar as CalendarIcon, Wand2, XCircle, FileSpreadsheet, Upload, AlertTriangle } from "lucide-react";
import { DndContext, type DragEndEvent, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { exportScheduleToExcel, importScheduleFromExcel } from "./lib/excelUtils";
import { useMemo, useRef, useState } from "react";

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
    lastActionMessage,
    clearMessage,
  } = useScheduleStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");

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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="min-h-screen p-6 md:p-8 flex flex-col gap-8 relative z-10">
        <header className="flex flex-col gap-4 pb-6 border-b border-slate-200/60 mix-blend-multiply">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-b from-blue-500 to-blue-700 shadow-inner rounded-xl">
                  <CalendarIcon className="w-8 h-8 text-white drop-shadow-sm" />
                </div>
                <span className="bg-clip-text text-transparent bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500">Neuro ICU Schedule</span>
              </h1>
              <p className="text-slate-500 mt-2 text-sm leading-relaxed max-w-xl font-medium">Persistent, conflict-aware scheduling with editable staffing targets, smart auto-fill, and instant import/export.</p>
            </div>

            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <input type="file" accept=".xlsx" className="hidden" ref={fileInputRef} onChange={handleImport} />
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-emerald-700 bg-white/60 backdrop-blur-md border border-emerald-200 hover:bg-emerald-50 rounded-xl shadow-[0_2px_10px_rgb(16,185,129,0.1)] transition-all"><Upload className="w-4 h-4" />Import</button>
              <button onClick={exportScheduleToExcel} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-emerald-700 bg-white/60 backdrop-blur-md border border-emerald-200 hover:bg-emerald-50 rounded-xl shadow-[0_2px_10px_rgb(16,185,129,0.1)] transition-all"><FileSpreadsheet className="w-4 h-4" />Export</button>
              <div className="w-px h-6 bg-slate-300/50 mx-1" />
              <button onClick={clearAssignments} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 bg-white/60 backdrop-blur-md border border-slate-200 hover:bg-slate-50 rounded-xl shadow-sm transition-all"><XCircle className="w-4 h-4" />Clear Plan</button>
              <button onClick={autoAssign} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border border-blue-700/50 rounded-xl shadow-[0_4px_15px_rgb(37,99,235,0.3)] transition-all"><Wand2 className="w-4 h-4 drop-shadow-sm" />Auto-Fill</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="glass-panel rounded-xl px-4 py-3 text-left"><p className="text-xs text-slate-500">Coverage</p><p className="text-xl font-bold text-slate-800">{coverage}%</p></div>
            <div className="glass-panel rounded-xl px-4 py-3 text-left"><p className="text-xs text-slate-500">Assigned / Total</p><p className="text-xl font-bold text-slate-800">{assigned} / {slots.length}</p></div>
            <div className="glass-panel rounded-xl px-4 py-3 text-left"><p className="text-xs text-slate-500">Start Date</p><input type="date" value={startDate} onChange={(e) => setScheduleRange(e.target.value, numWeeks)} className="bg-transparent text-slate-800 font-semibold w-full" /></div>
            <div className="glass-panel rounded-xl px-4 py-3 text-left"><p className="text-xs text-slate-500">Weeks</p><input type="number" min={1} max={12} value={numWeeks} onChange={(e) => setScheduleRange(startDate, Math.min(12, Math.max(1, Number(e.target.value) || 1)))} className="bg-transparent text-slate-800 font-semibold w-full" /></div>
          </div>

          {(lastActionMessage || overloaded.length > 0) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <div className="flex-1">
                {lastActionMessage ? <p>{lastActionMessage}</p> : null}
                {overloaded.length > 0 ? <p className="mt-1">Over target: {overloaded.map((p) => p.name).join(", ")}.</p> : null}
              </div>
              {lastActionMessage ? <button onClick={clearMessage} className="text-amber-700 text-xs">Dismiss</button> : null}
            </div>
          )}
        </header>

        <main className="flex flex-col xl:flex-row gap-8 items-start">
          <ProviderManager />
          <div className="flex-1 w-full flex flex-col min-w-0">
            <div className="flex justify-end mb-2"><ViewToggle view={viewMode} onChange={setViewMode} /></div>
            <div className="w-full overflow-x-auto pb-8">{viewMode === "calendar" ? <MonthlyCalendar /> : <Calendar />}</div>
          </div>
        </main>
      </div>
    </DndContext>
  );
}
