import { useFatigueCheck } from '@/hooks/useFatigueCheck';
import { AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FatigueIndicatorProps {
  providerId: string;
  showDetails?: boolean;
  className?: string;
}

export function FatigueIndicator({ providerId, showDetails = false, className }: FatigueIndicatorProps) {
  const { fatigueMetrics } = useFatigueCheck(providerId);

  if (!fatigueMetrics) {
    return null;
  }

  const { consecutiveShiftsWorked, shiftsThisMonth, riskLevel } = fatigueMetrics;
  const isWarning = consecutiveShiftsWorked >= 3;

  const riskColors = {
    low: 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    medium: 'bg-amber-500/10 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    high: 'bg-red-500/10 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
  };

  const riskIconColors = {
    low: 'text-emerald-500',
    medium: 'text-amber-500',
    high: 'text-red-500',
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        className={cn(
          'relative overflow-hidden rounded-lg border px-3 py-2 transition-colors',
          isWarning ? riskColors.high : riskColors[riskLevel]
        )}
      >
        {isWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute inset-0 bg-red-500/5"
          />
        )}
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={cn('w-4 h-4', isWarning ? riskIconColors.high : riskIconColors[riskLevel])}
            />
            <span className="text-sm font-medium">
              {isWarning ? 'High Fatigue Risk' : `Risk Level: ${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}`}
            </span>
          </div>
          
          {isWarning && (
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">
              {consecutiveShiftsWorked} consecutive shifts
            </span>
          )}
        </div>

        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mt-2 pt-2 border-t border-current/20"
          >
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{consecutiveShiftsWorked} consecutive</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>{shiftsThisMonth} this month</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
