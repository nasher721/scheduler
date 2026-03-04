import { useState } from "react";
import type { ShiftSlot, Provider } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Check, 
  RotateCcw, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  User,
  Calendar
} from "lucide-react";

export interface ScheduleChange {
  id: string;
  type: 'assign' | 'remove' | 'swap' | 'modify';
  slotId: string;
  slot?: ShiftSlot;
  fromProviderId?: string | null;
  toProviderId?: string | null;
  fromProvider?: Provider;
  toProvider?: Provider;
  reason: string;
  impact?: 'positive' | 'negative' | 'neutral';
}

export interface OptimizationPreview {
  objectiveScore: number;
  objectiveScoreBefore: number;
  coverageScore: number;
  fairnessScore: number;
  fatigueScore: number;
  changes: ScheduleChange[];
  warnings?: string[];
}

interface ScheduleChangePreviewProps {
  preview: OptimizationPreview;
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  onReject: () => void;
  onModify?: () => void;
}

export function ScheduleChangePreview({
  preview,
  isOpen,
  onClose,
  onAccept,
  onReject,
  onModify
}: ScheduleChangePreviewProps) {
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);

  const toggleChange = (id: string) => {
    setExpandedChanges(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAccept = async () => {
    setIsApplying(true);
    await onAccept();
    setIsApplying(false);
  };

  const scoreChange = preview.objectiveScore - preview.objectiveScoreBefore;
  const isImprovement = scoreChange > 0;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Optimization Result</h2>
                <p className="text-blue-100 text-sm">
                  {preview.changes.length} changes recommended
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Score Overview */}
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-slate-600">Overall Score</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {preview.objectiveScoreBefore}
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className={`text-2xl font-bold ${isImprovement ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {preview.objectiveScore}
                  </span>
                  <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                    isImprovement ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {isImprovement ? '+' : ''}{scoreChange}
                  </span>
                </div>
              </div>

              {/* Metric Breakdown */}
              <div className="grid grid-cols-3 gap-3">
                <ScoreMetric 
                  label="Coverage"
                  value={preview.coverageScore}
                  icon={<Calendar className="w-4 h-4" />}
                />
                <ScoreMetric 
                  label="Fairness"
                  value={preview.fairnessScore}
                  icon={<User className="w-4 h-4" />}
                />
                <ScoreMetric 
                  label="Fatigue Risk"
                  value={preview.fatigueScore}
                  icon={<AlertTriangle className="w-4 h-4" />}
                />
              </div>
            </div>

            {/* Warnings */}
            {preview.warnings && preview.warnings.length > 0 && (
              <div className="px-6 py-3 bg-amber-50 border-b border-amber-100">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-amber-800">Considerations</span>
                    <ul className="mt-1 space-y-1">
                      {preview.warnings.map((warning, idx) => (
                        <li key={idx} className="text-xs text-amber-700">{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Changes List */}
            <div className="p-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                Proposed Changes ({preview.changes.length})
              </h3>
              <div className="space-y-2">
                {preview.changes.map((change) => (
                  <ChangeItem
                    key={change.id}
                    change={change}
                    isExpanded={expandedChanges.has(change.id)}
                    onToggle={() => toggleChange(change.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <button
              onClick={onReject}
              disabled={isApplying}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Decline All
            </button>
            <div className="flex items-center gap-3">
              {onModify && (
                <button
                  onClick={onModify}
                  disabled={isApplying}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Modify
                </button>
              )}
              <button
                onClick={handleAccept}
                disabled={isApplying}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isApplying ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Accept All
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ScoreMetric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const getColor = (v: number) => {
    if (v >= 80) return 'text-emerald-600';
    if (v >= 60) return 'text-amber-600';
    return 'text-rose-600';
  };

  return (
    <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-3">
      <div className="text-slate-400">{icon}</div>
      <div>
        <div className={`text-lg font-bold ${getColor(value)}`}>{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}

function ChangeItem({ 
  change, 
  isExpanded, 
  onToggle 
}: { 
  change: ScheduleChange; 
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const getChangeIcon = () => {
    switch (change.type) {
      case 'assign':
        return <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center"><User className="w-3 h-3 text-emerald-600" /></div>;
      case 'remove':
        return <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center"><X className="w-3 h-3 text-rose-600" /></div>;
      case 'swap':
        return <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center"><RotateCcw className="w-3 h-3 text-blue-600" /></div>;
      default:
        return <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center"><Sparkles className="w-3 h-3 text-slate-600" /></div>;
    }
  };

  const getChangeTitle = () => {
    switch (change.type) {
      case 'assign':
        return `Assign ${change.toProvider?.name || 'provider'}`;
      case 'remove':
        return `Remove ${change.fromProvider?.name || 'provider'}`;
      case 'swap':
        return `Swap ${change.fromProvider?.name} → ${change.toProvider?.name}`;
      default:
        return 'Modify assignment';
    }
  };

  const getImpactIcon = () => {
    switch (change.impact) {
      case 'positive':
        return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />;
      case 'negative':
        return <TrendingDown className="w-3.5 h-3.5 text-rose-500" />;
      default:
        return <Minus className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
      >
        {getChangeIcon()}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">{getChangeTitle()}</span>
            {getImpactIcon()}
          </div>
          <span className="text-xs text-slate-500">{change.slot?.type} shift • {change.slot?.date}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 bg-slate-50 text-sm text-slate-600">
              <p className="text-xs text-slate-500 mb-2">Reason:</p>
              <p>{change.reason}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


