import React from 'react';
import { Download, Printer, Calendar as CalendarIcon, FileSpreadsheet } from 'lucide-react';
import { exportScheduleToExcel } from '../lib/excelUtils';
import { useScheduleStore } from '../store';
import { generateProviderICal } from '../lib/icalUtils';

export const ExportCenter: React.FC = () => {
    const { providers, slots } = useScheduleStore();

    const handlePrint = () => {
        window.print();
    };

    const handlePersonalExport = (providerId: string) => {
        const provider = providers.find(p => p.id === providerId);
        if (provider) {
            generateProviderICal(provider, slots);
        }
    };

    return (
        <div className="satin-panel p-6 mb-8 animate-staggered-entrance">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-serif text-slate-900 mb-1">Export Operations</h2>
                    <p className="text-sm text-slate-500 font-medium">Distribute the schedule across institutional and personal platforms.</p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={exportScheduleToExcel}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm transition-all hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Institutional Excel
                    </button>

                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all hover:border-slate-300 hover:bg-slate-50"
                    >
                        <Printer className="w-4 h-4" />
                        Print / Save PDF
                    </button>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Personal Calendar Sync (.ics)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {providers.map(provider => (
                        <button
                            key={provider.id}
                            onClick={() => handlePersonalExport(provider.id)}
                            className="group flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl transition-all hover:border-blue-200 hover:shadow-md"
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                    <CalendarIcon className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-semibold text-slate-700">{provider.name}</span>
                            </div>
                            <Download className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-400 transition-colors" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
