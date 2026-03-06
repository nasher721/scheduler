/**
 * CalendarContainer Component
 * 
 * Main container component for the enhanced calendar interface.
 * Integrates all Phase 1 features: keyboard navigation, filters, accessibility.
 * 
 * Part of Phase 1: UX & Accessibility
 */

import { useState, useCallback, useEffect } from 'react';
import { useScheduleStore } from '@/store';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { HotkeysProvider } from 'react-hotkeys-hook';
import { motion, AnimatePresence } from 'framer-motion';

// Calendar components
import {
  useCalendarKeyboard,
  KeyboardHelpModal,
  useKeyboardHelp,
  KeyboardHelpButton,
  FilterPanel,
  FilterChips,
  FilterToggleButton,
  useFilters
} from './index';

// Icons
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Grid3X3,
  List,
  BarChart3,
  CalendarDays,
  Clock4,
  X
} from 'lucide-react';

// UI Components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// View components (will be imported from views/)
import { EnhancedCalendar } from '../EnhancedCalendar';

interface CalendarContainerProps {
  className?: string;
}

const VIEW_ICONS = {
  grid: Grid3X3,
  list: List,
  bar: BarChart3,
  week: CalendarDays,
  month: CalendarIcon,
  timeline: Clock4
};

const VIEW_LABELS = {
  grid: 'Grid',
  list: 'List',
  bar: 'Bar',
  week: 'Week',
  month: 'Month',
  timeline: 'Timeline'
};

export function CalendarContainer({ className }: CalendarContainerProps) {
  // Store access
  const {
    scheduleViewport,
    setCalendarPresentationMode,
    shiftWeekOffset,
    slots,
    providers,
    currentUser
  } = useScheduleStore();

  // Hooks
  const { filteredSlots, activeFilterCount, filterSummary } = useFilters();
  const { isOpen: isKeyboardHelpOpen, close: closeKeyboardHelp } = useKeyboardHelp();
  useCalendarKeyboard(); // Initialize keyboard shortcuts

  // UI State
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [showFilterChips, setShowFilterChips] = useState(true);

  // Responsive
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');

  // Current view
  const currentView = scheduleViewport.calendarPresentationMode;
  const CurrentViewIcon = VIEW_ICONS[currentView];

  // Handle view change
  const handleViewChange = useCallback((view: typeof currentView) => {
    setCalendarPresentationMode(view);
  }, [setCalendarPresentationMode]);

  // Coverage stats
  const coverageStats = {
    filled: filteredSlots.filter(s => s.providerId).length,
    total: filteredSlots.length,
    critical: filteredSlots.filter(s => s.servicePriority === 'CRITICAL' && !s.providerId).length
  };

  return (
    <HotkeysProvider>
      <TooltipProvider>
        <div className={cn('flex flex-col lg:flex-row h-full bg-slate-50/50', className)}>
          {/* Skip Link */}
          <a
            href="#calendar-main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-3 focus:bg-white focus:shadow-lg focus:rounded-lg"
          >
            Skip to calendar
          </a>

          {/* Filter Panel - Desktop Sidebar */}
          {!isMobile && (
            <aside
              className={cn(
                'border-r bg-white transition-all duration-300',
                isFilterPanelOpen ? 'w-80' : 'w-0 overflow-hidden'
              )}
              aria-hidden={!isFilterPanelOpen}
            >
              <FilterPanel
                isOpen={isFilterPanelOpen}
                onClose={() => setIsFilterPanelOpen(false)}
                className="h-full"
              />
            </aside>
          )}

          {/* Filter Panel - Mobile Drawer */}
          {isMobile && (
            <Sheet open={isFilterPanelOpen} onOpenChange={setIsFilterPanelOpen}>
              <SheetContent side="left" className="w-full sm:w-80 p-0">
                <FilterPanel
                  isOpen={true}
                  onClose={() => setIsFilterPanelOpen(false)}
                  className="h-full"
                />
              </SheetContent>
            </Sheet>
          )}

          {/* Main Content */}
          <main id="calendar-main" className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <header className="flex flex-col gap-4 p-4 lg:p-6 bg-white border-b">
              {/* Top Row */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                {/* Left: Title & Navigation */}
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-primary/10 rounded-xl">
                    <CalendarIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold text-slate-900">Calendar</h1>
                    <p className="text-sm text-slate-500">
                      {coverageStats.filled} of {coverageStats.total} shifts filled
                      {coverageStats.critical > 0 && (
                        <span className="ml-2 text-rose-600 font-medium">
                          • {coverageStats.critical} critical unfilled
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Keyboard Help */}
                  <KeyboardHelpButton className="hidden sm:flex" />

                  {/* Filter Toggle */}
                  <FilterToggleButton
                    isActive={isFilterPanelOpen}
                    onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                    activeCount={activeFilterCount}
                  />

                  {/* AI Assistant */}
                  <Button
                    onClick={() => useScheduleStore.getState().toggleCopilot()}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hidden sm:flex"
                  >
                    AI Assistant
                  </Button>
                </div>
              </div>

              {/* Second Row: Navigation & View Selector */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* Week Navigation */}
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => shiftWeekOffset(-1)}
                        aria-label="Previous week"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Previous week (←)</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => shiftWeekOffset(1)}
                        aria-label="Next week"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Next week (→)</TooltipContent>
                  </Tooltip>

                  <span className="text-sm text-slate-500 px-2">
                    Week {scheduleViewport.currentWeekOffset === 0 ? '(Current)' : scheduleViewport.currentWeekOffset > 0 ? `+${scheduleViewport.currentWeekOffset}` : scheduleViewport.currentWeekOffset}
                  </span>
                </div>

                {/* View Selector */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  {(['grid', 'list', 'bar', 'week', 'month', 'timeline'] as const).map((view) => {
                    const Icon = VIEW_ICONS[view];
                    const isActive = currentView === view;

                    return (
                      <Tooltip key={view}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleViewChange(view)}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                              isActive
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                            )}
                            aria-pressed={isActive}
                            aria-label={`${VIEW_LABELS[view]} view`}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="hidden md:inline">{VIEW_LABELS[view]}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {VIEW_LABELS[view]} view (Ctrl+{Object.keys(VIEW_LABELS).indexOf(view) + 1})
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>

              {/* Filter Chips */}
              <AnimatePresence>
                {activeFilterCount > 0 && showFilterChips && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2"
                  >
                    <FilterChips />
                    <button
                      onClick={() => setShowFilterChips(false)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                      aria-label="Hide filter chips"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </header>

            {/* Calendar Content */}
            <div className="flex-1 overflow-hidden p-4 lg:p-6">
              <div className="h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Use existing EnhancedCalendar for now */}
                <EnhancedCalendar />
              </div>
            </div>
          </main>

          {/* Keyboard Help Modal */}
          <KeyboardHelpModal isOpen={isKeyboardHelpOpen} onClose={closeKeyboardHelp} />
        </div>
      </TooltipProvider>
    </HotkeysProvider>
  );
}

// Mobile-optimized header component
function MobileCalendarHeader({
  onFilterClick,
  onWeekChange
}: {
  onFilterClick: () => void;
  onWeekChange: (delta: number) => void;
}) {
  const { scheduleViewport } = useScheduleStore();

  return (
    <div className="lg:hidden flex items-center justify-between p-3 bg-white border-b">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => onWeekChange(-1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="text-sm font-medium">
          Week {scheduleViewport.currentWeekOffset === 0 ? 'Current' : scheduleViewport.currentWeekOffset}
        </span>
        <Button variant="ghost" size="icon" onClick={() => onWeekChange(1)}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onFilterClick}>
          <Filter className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
