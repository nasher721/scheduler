import { useState } from "react";
import { useScheduleStore, getProviderCounts } from "../store";
import { Users, Plus, Trash2 } from "lucide-react";
import { DraggableProvider } from "./Calendar";
import { motion, AnimatePresence } from "framer-motion";

function ProgressBar({ target, current, label }: { target: number; current: number; label: string }) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const isOver = current > target;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 tracking-wider">
        <span>{label}</span>
        <span className={isOver ? "text-rose-500" : "text-slate-700"}>{current} / {target}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} className={`h-full rounded-full ${isOver ? "bg-rose-500" : "bg-blue-500"}`} />
      </div>
    </div>
  );
}

export function ProviderManager() {
  const { providers, addProvider, removeProvider, slots, updateProvider } = useScheduleStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const counts = getProviderCounts(slots, providers);

  const handleAdd = () => {
    if (!newName.trim()) return;
    addProvider({
      name: newName.trim(),
      targetWeekDays: 10,
      targetWeekendDays: 4,
      targetWeekNights: 3,
      targetWeekendNights: 2,
      unavailableDates: [],
    });
    setNewName("");
    setIsAdding(false);
  };

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass-panel rounded-2xl p-6 flex flex-col gap-6 w-full max-w-sm h-fit sticky top-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2 text-slate-800"><Users className="w-5 h-5" /> Staff Roster</h2>
        <button onClick={() => setIsAdding(true)} title="Add Staff" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <Plus className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex gap-2 overflow-hidden">
            <input
              autoFocus
              type="text"
              className="flex-1 border-b border-slate-300 bg-transparent px-2 py-1 outline-none focus:border-blue-500 transition-colors"
              placeholder="Physician Name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <button onClick={handleAdd} className="text-sm font-medium text-blue-600">Add</button>
            <button onClick={() => setIsAdding(false)} className="text-sm text-slate-500">Cancel</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-4">
        <AnimatePresence>
          {providers.map((p) => (
            <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} key={p.id} className="group relative bg-white/60 rounded-xl p-4 border border-white/80 shadow-[0_4px_15px_rgb(0,0,0,0.03)] flex flex-col gap-3 transition-all hover:shadow-[0_4px_20px_rgb(0,0,0,0.06)] hover:bg-white/90">
              <div className="flex justify-between items-start">
                <DraggableProvider id={p.id} name={p.name} />
                <button onClick={() => removeProvider(p.id)} title="Remove Staff" className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex flex-col gap-1">Wk Day
                  <input type="number" min={0} className="rounded-md border border-slate-200 px-2 py-1" value={p.targetWeekDays} onChange={(e) => updateProvider(p.id, { targetWeekDays: Number(e.target.value) || 0 })} />
                </label>
                <label className="flex flex-col gap-1">Wknd Day
                  <input type="number" min={0} className="rounded-md border border-slate-200 px-2 py-1" value={p.targetWeekendDays} onChange={(e) => updateProvider(p.id, { targetWeekendDays: Number(e.target.value) || 0 })} />
                </label>
                <label className="flex flex-col gap-1">Wk Night
                  <input type="number" min={0} className="rounded-md border border-slate-200 px-2 py-1" value={p.targetWeekNights} onChange={(e) => updateProvider(p.id, { targetWeekNights: Number(e.target.value) || 0 })} />
                </label>
                <label className="flex flex-col gap-1">Wknd Night
                  <input type="number" min={0} className="rounded-md border border-slate-200 px-2 py-1" value={p.targetWeekendNights} onChange={(e) => updateProvider(p.id, { targetWeekendNights: Number(e.target.value) || 0 })} />
                </label>
              </div>

              <label className="text-xs flex flex-col gap-1">Unavailable dates (comma-separated YYYY-MM-DD)
                <input
                  type="text"
                  className="rounded-md border border-slate-200 px-2 py-1"
                  value={p.unavailableDates.join(",")}
                  onChange={(e) => updateProvider(p.id, { unavailableDates: e.target.value.split(",").map((d) => d.trim()).filter(Boolean) })}
                />
              </label>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-1">
                <ProgressBar label="Wk Day" target={p.targetWeekDays} current={counts[p.id]?.weekDays || 0} />
                <ProgressBar label="Wknd Day" target={p.targetWeekendDays} current={counts[p.id]?.weekendDays || 0} />
                <ProgressBar label="Wk Night" target={p.targetWeekNights} current={counts[p.id]?.weekNights || 0} />
                <ProgressBar label="Wknd Night" target={p.targetWeekendNights} current={counts[p.id]?.weekendNights || 0} />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
