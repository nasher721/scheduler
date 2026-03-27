/**
 * PriorityLegend Component
 * 
 * Displays priority levels with a tooltip explanation.
 * Priority 1: CRITICAL — must-fill, patient safety dependent
 * Priority 2: HIGH — standard coverage requirements
 * Priority 3: LOW — optional/stretch coverage
 */

import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const priorityLevels = [
  {
    level: 1,
    label: 'CRITICAL',
    color: 'text-rose-600',
    bgColor: 'bg-rose-100',
    borderColor: 'border-rose-200',
    description: 'Must-fill shifts — patient safety dependent'
  },
  {
    level: 2,
    label: 'HIGH',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-200',
    description: 'Standard coverage requirements'
  },
  {
    level: 3,
    label: 'LOW',
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-200',
    description: 'Optional/stretch coverage'
  }
];

export function PriorityLegend({ className }: { className?: string }) {
  return (
    <div className={cn("relative group inline-flex items-center", className)}>
      <button
        type="button"
        className="inline-flex items-center justify-center w-5 h-5 text-foreground-muted hover:text-foreground transition-colors cursor-help"
        aria-label="Priority levels info"
      >
        <Info className="w-4 h-4" />
      </button>
      
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <div className="bg-background border border-border rounded-lg shadow-lg p-3 min-w-[220px]">
          <div className="text-xs font-semibold text-foreground mb-2">Priority Levels</div>
          <div className="space-y-2">
            {priorityLevels.map((priority) => (
              <div key={priority.level} className="flex items-start gap-2">
                <span className={cn(
                  "inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold shrink-0 mt-0.5",
                  priority.bgColor,
                  priority.color
                )}>
                  {priority.level}
                </span>
                <div className="flex flex-col">
                  <span className={cn("text-xs font-semibold", priority.color)}>
                    {priority.label}
                  </span>
                  <span className="text-[10px] text-foreground-muted">
                    {priority.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
          <div className="border-4 border-transparent border-t-border" />
        </div>
      </div>
    </div>
  );
}
