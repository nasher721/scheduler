import { Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ViewMode } from '../ViewToggle';
import { LoadingFallback } from './LoadingFallback';

// Lazy-load view components for code splitting and faster initial load
const AnalyticsDashboard = lazy(() =>
  import('../AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard }))
);
const ScheduleWorkspace = lazy(() =>
  import('../schedule/ScheduleWorkspace').then((m) => ({ default: m.ScheduleWorkspace }))
);
const ShiftRequestBoard = lazy(() =>
  import('../ShiftRequestBoard').then((m) => ({ default: m.ShiftRequestBoard }))
);
const RuleBuilder = lazy(() =>
  import('../RuleBuilder').then((m) => ({ default: m.RuleBuilder }))
);
const SchedulingStrategyWorkbench = lazy(() =>
  import('../SchedulingStrategyWorkbench').then((m) => ({ default: m.SchedulingStrategyWorkbench }))
);
const SwapManager = lazy(() =>
  import('../SwapManager').then((m) => ({ default: m.SwapManager }))
);
const HolidayTracker = lazy(() =>
  import('../HolidayTracker').then((m) => ({ default: m.HolidayTracker }))
);
const ConflictDashboard = lazy(() =>
  import('../ConflictDashboard').then((m) => ({ default: m.ConflictDashboard }))
);
const NotificationCenter = lazy(() =>
  import('../NotificationCenter').then((m) => ({ default: m.NotificationCenter }))
);
const PredictiveInsights = lazy(() =>
  import('../PredictiveInsights').then((m) => ({ default: m.PredictiveInsights }))
);
const ScheduleTemplates = lazy(() =>
  import('../ScheduleTemplates').then((m) => ({ default: m.ScheduleTemplates }))
);
const AITestPanel = lazy(() =>
  import('../AITestPanel').then((m) => ({ default: m.AITestPanel }))
);
const SmartHub = lazy(() =>
  import('../SmartHub').then((m) => ({ default: m.SmartHub }))
);

interface ViewContentProps {
  viewMode: ViewMode;
}

function ViewSwitch({ viewMode }: ViewContentProps) {
  switch (viewMode) {
    case 'analytics':
      return <AnalyticsDashboard />;
    case 'schedule':
      return <ScheduleWorkspace />;
    case 'shift-requests':
      return <ShiftRequestBoard />;
    case 'rules':
      return <RuleBuilder />;
    case 'strategy':
      return <SchedulingStrategyWorkbench />;
    case 'swaps':
      return <SwapManager />;
    case 'holidays':
      return <HolidayTracker />;
    case 'conflicts':
      return <ConflictDashboard />;
    case 'notifications':
      return <NotificationCenter />;
    case 'predictive':
      return <PredictiveInsights />;
    case 'templates':
      return <ScheduleTemplates />;
    case 'ai-test':
      return <AITestPanel />;
    case 'smarthub':
      return <SmartHub />;
    default:
      return <ScheduleWorkspace />;
  }
}

/**
 * Renders the active scheduler view with Suspense and a loading fallback.
 * Views are lazy-loaded for better initial load and code splitting.
 */
export function ViewContent({ viewMode }: ViewContentProps) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <ViewSwitch viewMode={viewMode} />
        </motion.div>
      </AnimatePresence>
    </Suspense>
  );
}
