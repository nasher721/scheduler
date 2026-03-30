import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Filter, 
  ChevronDown,
  RotateCcw,
  Check
} from 'lucide-react';
import { format, addDays, startOfDay } from 'date-fns';
import { useTheme } from '@/hooks/useTheme';
import type { ShiftType } from '@/types';

interface MarketplaceFiltersProps {
  onFiltersChange?: (filters: MarketplaceFiltersState) => void;
  availableLocations?: string[];
  availableShiftTypes?: ShiftType[];
}

export interface MarketplaceFiltersState {
  dateRange: {
    start: string | null;
    end: string | null;
  };
  shiftTypes: ShiftType[];
  locations: string[];
}

const DEFAULT_SHIFT_TYPES: ShiftType[] = [
  'DAY', 'NIGHT', 'NMET', 'JEOPARDY', 'RECOVERY', 'CONSULTS', 'VACATION'
];

export function MarketplaceFilters({
  onFiltersChange,
  availableLocations = [],
  availableShiftTypes = DEFAULT_SHIFT_TYPES
}: MarketplaceFiltersProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [isExpanded, setIsExpanded] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({
    start: null,
    end: null,
  });
  const [selectedShiftTypes, setSelectedShiftTypes] = useState<ShiftType[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);

  const hasActiveFilters = useMemo(() => {
    return (
      dateRange.start !== null ||
      dateRange.end !== null ||
      selectedShiftTypes.length > 0 ||
      selectedLocations.length > 0
    );
  }, [dateRange, selectedShiftTypes, selectedLocations]);

  const handleDatePreset = (preset: 'today' | 'tomorrow' | 'week' | 'nextweek' | 'clear') => {
    const today = startOfDay(new Date());
    
    switch (preset) {
      case 'today':
        setDateRange({
          start: format(today, 'yyyy-MM-dd'),
          end: format(today, 'yyyy-MM-dd'),
        });
        break;
      case 'tomorrow':
        setDateRange({
          start: format(addDays(today, 1), 'yyyy-MM-dd'),
          end: format(addDays(today, 1), 'yyyy-MM-dd'),
        });
        break;
      case 'week':
        setDateRange({
          start: format(today, 'yyyy-MM-dd'),
          end: format(addDays(today, 7), 'yyyy-MM-dd'),
        });
        break;
      case 'nextweek':
        setDateRange({
          start: format(addDays(today, 7), 'yyyy-MM-dd'),
          end: format(addDays(today, 14), 'yyyy-MM-dd'),
        });
        break;
      case 'clear':
        setDateRange({ start: null, end: null });
        break;
    }
  };

  const handleShiftTypeToggle = (shiftType: ShiftType) => {
    setSelectedShiftTypes((prev) => {
      if (prev.includes(shiftType)) {
        return prev.filter((t) => t !== shiftType);
      }
      return [...prev, shiftType];
    });
  };

  const handleLocationToggle = (location: string) => {
    setSelectedLocations((prev) => {
      if (prev.includes(location)) {
        return prev.filter((l) => l !== location);
      }
      return [...prev, location];
    });
  };

  const handleClearAll = () => {
    setDateRange({ start: null, end: null });
    setSelectedShiftTypes([]);
    setSelectedLocations([]);
    onFiltersChange?.({
      dateRange: { start: null, end: null },
      shiftTypes: [],
      locations: [],
    });
  };

  const handleApply = () => {
    onFiltersChange?.({
      dateRange,
      shiftTypes: selectedShiftTypes,
      locations: selectedLocations,
    });
  };

  return (
    <div className={`rounded-xl border overflow-hidden ${
      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
    }`}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-4 text-left ${
          isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'
        } transition-colors`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            isDark ? 'bg-slate-700' : 'bg-slate-100'
          }`}>
            <Filter className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} />
          </div>
          <div>
            <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Filters
            </span>
            {hasActiveFilters && (
              <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
              }`}>
                Active
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {selectedShiftTypes.length + selectedLocations.length + (dateRange.start ? 1 : 0)} filters
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          } ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className={`px-4 pb-4 space-y-4 border-t ${
              isDark ? 'border-slate-700' : 'border-slate-200'
            }`}>
              <div className="pt-4">
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Date Range
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {[
                    { key: 'today', label: 'Today' },
                    { key: 'tomorrow', label: 'Tomorrow' },
                    { key: 'week', label: 'This Week' },
                    { key: 'nextweek', label: 'Next Week' },
                  ].map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handleDatePreset(preset.key as 'today' | 'tomorrow' | 'week' | 'nextweek')}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                        isDark
                          ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleDatePreset('clear')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                      isDark
                        ? 'text-slate-400 hover:text-slate-300'
                        : 'text-slate-500 hover:text-slate-600'
                    }`}
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <label htmlFor="filter-start-date" className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Start Date
                    </label>
                    <input
                      id="filter-start-date"
                      type="date"
                      value={dateRange.start || ''}
                      onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value || null }))}
                      className={`w-full px-3 py-2 rounded-lg border text-sm mt-1 ${
                        isDark
                          ? 'bg-slate-700 border-slate-600 text-white'
                          : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="filter-end-date" className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      End Date
                    </label>
                    <input
                      id="filter-end-date"
                      type="date"
                      value={dateRange.end || ''}
                      onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value || null }))}
                      min={dateRange.start || undefined}
                      className={`w-full px-3 py-2 rounded-lg border text-sm mt-1 ${
                        isDark
                          ? 'bg-slate-700 border-slate-600 text-white'
                          : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Shift Types
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableShiftTypes.map((shiftType) => (
                    <button
                      key={shiftType}
                      type="button"
                      onClick={() => handleShiftTypeToggle(shiftType)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                        selectedShiftTypes.includes(shiftType)
                          ? 'bg-blue-600 text-white'
                          : isDark
                            ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {selectedShiftTypes.includes(shiftType) && <Check className="w-3.5 h-3.5" />}
                      {shiftType}
                    </button>
                  ))}
                </div>
              </div>

              {availableLocations.length > 0 && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    Locations
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableLocations.map((location) => (
                      <button
                        key={location}
                        type="button"
                        onClick={() => handleLocationToggle(location)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                          selectedLocations.includes(location)
                            ? 'bg-blue-600 text-white'
                            : isDark
                              ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {selectedLocations.includes(location) && <Check className="w-3.5 h-3.5" />}
                        {location}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors min-h-[44px] ${
                      isDark
                        ? 'bg-slate-700 hover:bg-slate-600 text-white'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Clear All
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleApply}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors min-h-[44px]"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MarketplaceFilters;
