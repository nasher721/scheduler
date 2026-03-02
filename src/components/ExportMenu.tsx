import { useState } from "react";
import { Calendar, ChevronDown, Download, FileSpreadsheet, Printer } from "lucide-react";
import { exportScheduleToExcel } from "../lib/excelUtils";
import { generateProviderICal } from "../lib/icalUtils";
import { useScheduleStore } from "../store";

export function ExportMenu() {
  const { providers, slots } = useScheduleStore();
  const [isOpen, setIsOpen] = useState(false);

  const handlePersonalExport = (providerId: string) => {
    const provider = providers.find((entry) => entry.id === providerId);
    if (!provider) return;
    generateProviderICal(provider, slots);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((value) => !value)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-slate-800 transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Export
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 p-3">
          <div className="space-y-2">
            <button
              onClick={() => {
                exportScheduleToExcel();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg hover:bg-slate-50"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">Institutional Excel (.xlsx)</span>
            </button>

            <button
              onClick={() => {
                window.print();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg hover:bg-slate-50"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">Print / Save PDF</span>
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-2">Personal iCal (.ics)</p>
            <div className="max-h-52 overflow-auto pr-1 space-y-1">
              {providers.length > 0 ? (
                providers.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => handlePersonalExport(provider.id)}
                    className="w-full flex items-center justify-between text-left px-3 py-2 rounded-lg hover:bg-slate-50"
                  >
                    <span className="text-sm font-medium text-slate-700">{provider.name}</span>
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                ))
              ) : (
                <p className="text-xs text-slate-500 px-2 py-1">Add providers to unlock personal calendar exports.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
