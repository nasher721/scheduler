import { ProviderManager } from "./components/ProviderManager";
import { Calendar } from "./components/Calendar";
import { useScheduleStore } from "./store";
import {
  Calendar as CalendarIcon,
  Wand2,
  XCircle,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  exportScheduleToExcel,
  importScheduleFromExcel,
} from "./lib/excelUtils";
import { useRef } from "react";

export default function App() {
  const { autoAssign, clearAssignments, assignShift } = useScheduleStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor),
  );

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
      } catch (err) {
        alert("Failed to parse Excel schedule.");
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen p-6 md:p-8 flex flex-col gap-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200/60">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-blue-600/10 rounded-xl">
                <CalendarIcon className="w-7 h-7 text-blue-600" />
              </div>
              Neuro ICU Schedule
            </h1>
            <p className="text-slate-500 mt-2 text-sm leading-relaxed max-w-xl">
              Semi-automated schedule builder. Drag and drop physicians into
              slots, or use the auto-assign algorithm to quickly fill open
              shifts based on targets and constraints.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImport}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg shadow-sm transition-all"
            >
              <Upload className="w-4 h-4" />
              Import Excel
            </button>
            <button
              onClick={exportScheduleToExcel}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg shadow-sm transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export Excel
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1"></div>
            <button
              onClick={clearAssignments}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition-all"
            >
              <XCircle className="w-4 h-4" />
              Clear Plan
            </button>
            <button
              onClick={autoAssign}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-600/20 transition-all"
            >
              <Wand2 className="w-4 h-4" />
              Auto-Fill
            </button>
          </div>
        </header>

        {/* Main Layout */}
        <main className="flex flex-col xl:flex-row gap-8 items-start">
          <ProviderManager />

          <div className="flex-1 w-full overflow-x-auto pb-8">
            <Calendar />
          </div>
        </main>
      </div>
    </DndContext>
  );
}
