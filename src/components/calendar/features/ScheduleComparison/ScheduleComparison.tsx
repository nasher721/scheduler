/**
 * ScheduleComparison Component
 * 
 * Side-by-side schedule comparison with diff highlighting.
 * Compare current schedule with scenarios, history, or AI suggestions.
 * 
 * Part of Phase 3: Visualization & Analytics
 */

import { useState, useMemo } from 'react';
import { useScheduleStore, type ShiftSlot, type Provider } from '@/store';
import type { ScheduleComparison as ScheduleComparisonType, ChangeDiff } from '@/types/calendar';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GitCompare,
  ArrowRight,
  Plus,
  Minus,
  Edit3,
  Check,
  X,
  History,
  Sparkles,
  Save,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatShiftType } from '../../utils/accessibilityUtils';

interface ScheduleComparisonProps {
  isOpen: boolean;
  onClose: () => void;
}

// Mock scenarios for comparison
type ComparisonSource = 'scenario' | 'history' | 'ai-suggestion' | 'snapshot';

interface ComparisonOption {
  id: string;
  name: string;
  type: ComparisonSource;
  date: string;
  description?: string;
}

const MOCK_COMPARISONS: ComparisonOption[] = [
  {
    id: 'scenario-1',
    name: 'Weekend Heavy',
    type: 'scenario',
    date: '2024-03-01T10:00:00Z',
    description: 'More weekend coverage'
  },
  {
    id: 'ai-opt-1',
    name: 'AI Optimization',
    type: 'ai-suggestion',
    date: '2024-03-06T14:30:00Z',
    description: 'Optimized for fairness'
  },
  {
    id: 'history-1',
    name: 'Last Week',
    type: 'history',
    date: '2024-02-28T09:00:00Z',
    description: 'Published schedule'
  }
];

export function ScheduleComparison({ isOpen, onClose }: ScheduleComparisonProps) {
  const { slots, providers, scenarios } = useScheduleStore();
  const [selectedComparisonId, setSelectedComparisonId] = useState<string>('');
  const [comparisonMode, setComparisonMode] = useState<'split' | 'overlay'>('split');
  const [selectedDiffs, setSelectedDiffs] = useState<Set<string>>(new Set());

  // Get current schedule as baseline
  const baseline = useMemo(() => ({
    id: 'current',
    name: 'Current Schedule',
    slots: slots,
    timestamp: new Date().toISOString()
  }), [slots]);

  // Get comparison data
  const comparison = useMemo(() => {
    if (!selectedComparisonId) return null;
    
    const option = MOCK_COMPARISONS.find(c => c.id === selectedComparisonId);
    if (!option) return null;

    // Generate mock comparison slots with some changes
    const comparisonSlots = slots.map(slot => {
      // Randomly modify some slots for demo
      if (Math.random() > 0.8) {
        return {
          ...slot,
          providerId: slot.providerId ? 
            providers[Math.floor(Math.random() * providers.length)]?.id || null 
            : providers[0]?.id || null
        };
      }
      return slot;
    });

    return {
      id: option.id,
      name: option.name,
      slots: comparisonSlots,
      timestamp: option.date
    };
  }, [selectedComparisonId, slots, providers]);

  // Calculate differences
  const diffs = useMemo<ChangeDiff[]>(() => {
    if (!comparison) return [];

    const changes: ChangeDiff[] = [];
    const baselineMap = new Map(baseline.slots.map(s => [s.id, s]));
    const comparisonMap = new Map(comparison.slots.map(s => [s.id, s]));

    // Find modified and removed slots
    baseline.slots.forEach(baselineSlot => {
      const comparisonSlot = comparisonMap.get(baselineSlot.id);
      
      if (!comparisonSlot) {
        changes.push({
          type: 'removed',
          slotId: baselineSlot.id,
          oldValue: baselineSlot
        });
      } else if (baselineSlot.providerId !== comparisonSlot.providerId) {
        changes.push({
          type: 'modified',
          slotId: baselineSlot.id,
          field: 'providerId',
          oldValue: baselineSlot.providerId,
          newValue: comparisonSlot.providerId
        });
      }
    });

    // Find added slots
    comparison.slots.forEach(comparisonSlot => {
      if (!baselineMap.has(comparisonSlot.id)) {
        changes.push({
          type: 'added',
          slotId: comparisonSlot.id,
          newValue: comparisonSlot
        });
      }
    });

    return changes;
  }, [baseline, comparison]);

  // Group diffs by date
  const diffsByDate = useMemo(() => {
    const grouped = new Map<string, ChangeDiff[]>();
    
    diffs.forEach(diff => {
      const slot = diff.type === 'removed' ? diff.oldValue as ShiftSlot : 
                   diff.type === 'added' ? diff.newValue as ShiftSlot :
                   baseline.slots.find(s => s.id === diff.slotId);
      
      if (slot) {
        const date = slot.date;
        if (!grouped.has(date)) grouped.set(date, []);
        grouped.get(date)?.push(diff);
      }
    });

    return new Map([...grouped.entries()].sort());
  }, [diffs, baseline.slots]);

  // Statistics
  const stats = useMemo(() => ({
    added: diffs.filter(d => d.type === 'added').length,
    removed: diffs.filter(d => d.type === 'removed').length,
    modified: diffs.filter(d => d.type === 'modified').length,
    total: diffs.length
  }), [diffs]);

  const handleApplySelected = () => {
    // TODO: Apply selected changes
    console.log('Applying changes:', Array.from(selectedDiffs));
  };

  const toggleDiff = (slotId: string) => {
    setSelectedDiffs(prev => {
      const next = new Set(prev);
      if (next.has(slotId)) {
        next.delete(slotId);
      } else {
        next.add(slotId);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitCompare className="w-5 h-5 text-primary" />
              <CardTitle>Compare Schedules</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="p-4 border-b space-y-4">
          {/* Comparison Selector */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Compare with
              </label>
              <Select value={selectedComparisonId} onValueChange={setSelectedComparisonId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a schedule to compare..." />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_COMPARISONS.map(option => (
                    <SelectItem key={option.id} value={option.id}>
                      <div className="flex items-center gap-2">
                        {option.type === 'scenario' && <Save className="w-4 h-4" />}
                        {option.type === 'ai-suggestion' && <Sparkles className="w-4 h-4" />}
                        {option.type === 'history' && <History className="w-4 h-4" />}
                        <span>{option.name}</span>
                        <span className="text-xs text-slate-400">
                          ({format(parseISO(option.date), 'MMM d, h:mm a')})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* View Mode */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                View Mode
              </label>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setComparisonMode('split')}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    comparisonMode === 'split' ? 'bg-white shadow-sm' : 'text-slate-600'
                  )}
                >
                  Split
                </button>
                <button
                  onClick={() => setComparisonMode('overlay')}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    comparisonMode === 'overlay' ? 'bg-white shadow-sm' : 'text-slate-600'
                  )}
                >
                  Overlay
                </button>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          {stats.total > 0 && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  <Plus className="w-3 h-3 mr-1" />
                  {stats.added} added
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                  <Minus className="w-3 h-3 mr-1" />
                  {stats.removed} removed
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  <Edit3 className="w-3 h-3 mr-1" />
                  {stats.modified} changed
                </Badge>
              </div>
              <div className="flex-1" />
              <Button 
                size="sm" 
                onClick={handleApplySelected}
                disabled={selectedDiffs.size === 0}
              >
                <Check className="w-4 h-4 mr-2" />
                Apply Selected ({selectedDiffs.size})
              </Button>
            </div>
          )}
        </div>

        <CardContent className="flex-1 overflow-hidden p-0">
          {!comparison ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <GitCompare className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-slate-500">Select a schedule to compare</p>
            </div>
          ) : comparisonMode === 'split' ? (
            <SplitView
              baseline={baseline}
              comparison={comparison}
              diffs={diffs}
              selectedDiffs={selectedDiffs}
              onToggleDiff={toggleDiff}
              providers={providers}
            />
          ) : (
            <OverlayView
              diffsByDate={diffsByDate}
              baseline={baseline}
              comparison={comparison}
              selectedDiffs={selectedDiffs}
              onToggleDiff={toggleDiff}
              providers={providers}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Split view showing both schedules side by side
function SplitView({
  baseline,
  comparison,
  diffs,
  selectedDiffs,
  onToggleDiff,
  providers
}: {
  baseline: { name: string; slots: ShiftSlot[] };
  comparison: { name: string; slots: ShiftSlot[] };
  diffs: ChangeDiff[];
  selectedDiffs: Set<string>;
  onToggleDiff: (slotId: string) => void;
  providers: Provider[];
}) {
  const diffSlotIds = new Set(diffs.map(d => d.slotId));

  return (
    <div className="grid grid-cols-2 h-full">
      {/* Baseline */}
      <div className="border-r">
        <div className="p-3 bg-slate-50 border-b font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-slate-400" />
          {baseline.name}
          <span className="text-xs text-slate-400">(Current)</span>
        </div>
        <ScrollArea className="h-[calc(100%-40px)]">
          <div className="p-4 space-y-3">
            {baseline.slots.slice(0, 20).map(slot => {
              const hasDiff = diffSlotIds.has(slot.id);
              const provider = providers.find(p => p.id === slot.providerId);
              
              return (
                <div
                  key={slot.id}
                  className={cn(
                    'p-3 rounded-lg border transition-colors',
                    hasDiff ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{formatShiftType(slot.type)}</p>
                      <p className="text-xs text-slate-500">
                        {format(parseISO(slot.date), 'MMM d')} • {slot.serviceLocation}
                      </p>
                    </div>
                    {provider ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs">
                          {provider.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm">{provider.name}</span>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-slate-400">Unfilled</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Comparison */}
      <div>
        <div className="p-3 bg-slate-50 border-b font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary" />
          {comparison.name}
        </div>
        <ScrollArea className="h-[calc(100%-40px)]">
          <div className="p-4 space-y-3">
            {comparison.slots.slice(0, 20).map(slot => {
              const diff = diffs.find(d => d.slotId === slot.id);
              const isSelected = selectedDiffs.has(slot.id);
              const provider = providers.find(p => p.id === slot.providerId);
              
              return (
                <div
                  key={slot.id}
                  onClick={() => diff && onToggleDiff(slot.id)}
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-colors',
                    diff ? 'border-primary bg-primary/5' : 'border-slate-200',
                    isSelected && 'ring-2 ring-primary ring-offset-2'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {diff && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleDiff(slot.id)}
                          className="rounded border-slate-300"
                        />
                      )}
                      <div>
                        <p className="font-medium text-sm">{formatShiftType(slot.type)}</p>
                        <p className="text-xs text-slate-500">
                          {format(parseISO(slot.date), 'MMM d')} • {slot.serviceLocation}
                        </p>
                      </div>
                    </div>
                    {provider ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs">
                          {provider.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm">{provider.name}</span>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-slate-400">Unfilled</Badge>
                    )}
                  </div>
                  
                  {diff && (
                    <div className="mt-2 pt-2 border-t border-dashed">
                      <DiffBadge diff={diff} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// Overlay view showing only differences
function OverlayView({
  diffsByDate,
  baseline,
  comparison,
  selectedDiffs,
  onToggleDiff,
  providers
}: {
  diffsByDate: Map<string, ChangeDiff[]>;
  baseline: { slots: ShiftSlot[] };
  comparison: { slots: ShiftSlot[] };
  selectedDiffs: Set<string>;
  onToggleDiff: (slotId: string) => void;
  providers: Provider[];
}) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {Array.from(diffsByDate.entries()).map(([date, dateDiffs]) => (
          <div key={date}>
            <h3 className="font-medium text-slate-900 mb-3 sticky top-0 bg-white py-2 border-b">
              {format(parseISO(date), 'EEEE, MMMM do')}
            </h3>
            <div className="space-y-2">
              {dateDiffs.map(diff => {
                const isSelected = selectedDiffs.has(diff.slotId);
                const baselineSlot = baseline.slots.find(s => s.id === diff.slotId);
                const comparisonSlot = comparison.slots.find(s => s.id === diff.slotId);
                
                return (
                  <div
                    key={diff.slotId}
                    onClick={() => onToggleDiff(diff.slotId)}
                    className={cn(
                      'p-4 rounded-lg border cursor-pointer transition-all',
                      diff.type === 'added' ? 'bg-emerald-50 border-emerald-200' :
                      diff.type === 'removed' ? 'bg-rose-50 border-rose-200' :
                      'bg-amber-50 border-amber-200',
                      isSelected && 'ring-2 ring-primary ring-offset-2'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleDiff(diff.slotId)}
                        className="mt-1 rounded border-slate-300"
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <DiffBadge diff={diff} />
                          <span className="font-medium">
                            {baselineSlot?.type || comparisonSlot?.type}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500">
                            {baselineSlot?.serviceLocation || comparisonSlot?.serviceLocation}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm">
                          {diff.type === 'modified' && (
                            <>
                              <div className="flex items-center gap-2 text-slate-500">
                                <span>From:</span>
                                {diff.oldValue ? (
                                  <ProviderBadge providerId={diff.oldValue as string} providers={providers} />
                                ) : (
                                  <span className="text-slate-400">Unfilled</span>
                                )}
                              </div>
                              <ArrowRight className="w-4 h-4 text-slate-400" />
                            </>
                          )}
                          
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">
                              {diff.type === 'removed' ? 'Was:' : 'To:'}
                            </span>
                            {diff.newValue || comparisonSlot?.providerId ? (
                              <ProviderBadge 
                                providerId={(diff.newValue as string) || comparisonSlot?.providerId} 
                                providers={providers} 
                              />
                            ) : (
                              <span className="text-slate-400">Unfilled</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        
        {diffsByDate.size === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Check className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
            <p>No differences found</p>
            <p className="text-sm">The schedules are identical</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// Badge showing diff type
function DiffBadge({ diff }: { diff: ChangeDiff }) {
  const config = {
    added: { icon: Plus, className: 'bg-emerald-100 text-emerald-700', label: 'Added' },
    removed: { icon: Minus, className: 'bg-rose-100 text-rose-700', label: 'Removed' },
    modified: { icon: Edit3, className: 'bg-amber-100 text-amber-700', label: 'Changed' }
  };
  
  const { icon: Icon, className, label } = config[diff.type];
  
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', className)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// Provider badge
function ProviderBadge({ providerId, providers }: { providerId?: string | null; providers: Provider[] }) {
  const provider = providers.find(p => p.id === providerId);
  
  if (!provider) return <span className="text-slate-400">Unfilled</span>;
  
  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs">
        {provider.name.charAt(0).toUpperCase()}
      </div>
      <span className="text-slate-700">{provider.name}</span>
    </div>
  );
}

// Button to open comparison
export function ScheduleComparisonButton({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={className}
      >
        <GitCompare className="w-4 h-4 mr-2" />
        Compare
      </Button>
      <ScheduleComparison isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
