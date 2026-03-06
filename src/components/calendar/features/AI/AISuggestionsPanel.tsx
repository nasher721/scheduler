/**
 * AISuggestionsPanel Component
 * 
 * AI-powered scheduling suggestions with confidence scores and reasoning.
 * Allows users to review, accept, or reject AI recommendations.
 * 
 * Part of Phase 5: AI Features
 */

import { useState, useMemo } from 'react';
import { useScheduleStore } from '@/store';
import type { AISchedulingSuggestion, ShiftSlot, Provider } from '@/types/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Users,
  Star,
  Brain,
  Loader2,
  RefreshCw,
  Filter
} from 'lucide-react';

interface AISuggestionsPanelProps {
  /** Current slots to optimize */
  slots?: ShiftSlot[];
  /** Available providers */
  providers?: Provider[];
  /** Callback when suggestion is accepted */
  onAcceptSuggestion?: (suggestion: AISchedulingSuggestion) => void;
  /** Callback when all suggestions are applied */
  onApplyAll?: (suggestions: AISchedulingSuggestion[]) => void;
  /** Callback to generate new suggestions */
  onGenerateSuggestions?: () => Promise<AISchedulingSuggestion[]>;
  /** Additional CSS classes */
  className?: string;
}

// Mock AI suggestions for demonstration
const MOCK_SUGGESTIONS: AISchedulingSuggestion[] = [
  {
    id: 'ai-1',
    slotId: 'slot-123',
    providerId: 'provider-1',
    confidence: 0.92,
    reasoning: 'Dr. Chen has the lowest night shift count and prefers weekend nights. This balances workload across the team.',
    factors: {
      fairness: 0.95,
      preference: 0.88,
      skill: 0.92,
      workload: 0.94
    }
  },
  {
    id: 'ai-2',
    slotId: 'slot-145',
    providerId: 'provider-3',
    confidence: 0.87,
    reasoning: 'Matches skill requirements and maintains continuity with previous NMET shifts. Provider is under target for this shift type.',
    factors: {
      fairness: 0.85,
      preference: 0.90,
      skill: 0.95,
      workload: 0.78
    }
  },
  {
    id: 'ai-3',
    slotId: 'slot-167',
    providerId: 'provider-5',
    confidence: 0.81,
    reasoning: 'Fills critical weekend gap. Provider has indicated availability and has relevant credentials.',
    factors: {
      fairness: 0.75,
      preference: 0.82,
      skill: 0.88,
      workload: 0.80
    }
  }
];

/**
 * AI Scheduling Suggestions Panel
 * 
 * Displays AI-generated shift assignments with confidence scores,
 * reasoning explanations, and factor breakdowns.
 */
export function AISuggestionsPanel({
  slots,
  providers,
  onAcceptSuggestion,
  onApplyAll,
  onGenerateSuggestions,
  className
}: AISuggestionsPanelProps) {
  const storeSlots = useScheduleStore(state => state.slots);
  const storeProviders = useScheduleStore(state => state.providers);
  
  const allSlots = slots || storeSlots;
  const allProviders = providers || storeProviders;

  const [suggestions, setSuggestions] = useState<AISchedulingSuggestion[]>(MOCK_SUGGESTIONS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [filterConfidence, setFilterConfidence] = useState<number>(0.7);

  // Filter suggestions by confidence
  const filteredSuggestions = useMemo(() => {
    return suggestions.filter(s => s.confidence >= filterConfidence);
  }, [suggestions, filterConfidence]);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (suggestions.length === 0) return null;
    
    const avgConfidence = suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length;
    const highConfidence = suggestions.filter(s => s.confidence >= 0.9).length;
    const byFairness = suggestions.reduce((sum, s) => sum + s.factors.fairness, 0) / suggestions.length;
    
    return {
      avgConfidence,
      highConfidence,
      byFairness,
      total: suggestions.length,
      accepted: acceptedIds.size,
      rejected: rejectedIds.size
    };
  }, [suggestions, acceptedIds, rejectedIds]);

  // Generate new suggestions
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      if (onGenerateSuggestions) {
        const newSuggestions = await onGenerateSuggestions();
        setSuggestions(newSuggestions);
      } else {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        // Shuffle mock suggestions for demo
        setSuggestions(prev => [...prev].sort(() => Math.random() - 0.5));
      }
      setAcceptedIds(new Set());
      setRejectedIds(new Set());
    } finally {
      setIsGenerating(false);
    }
  };

  // Accept a suggestion
  const handleAccept = (suggestion: AISchedulingSuggestion) => {
    setAcceptedIds(prev => new Set([...prev, suggestion.id]));
    onAcceptSuggestion?.(suggestion);
  };

  // Reject a suggestion
  const handleReject = (suggestion: AISchedulingSuggestion) => {
    setRejectedIds(prev => new Set([...prev, suggestion.id]));
  };

  // Apply all accepted suggestions
  const handleApplyAll = () => {
    const accepted = suggestions.filter(s => acceptedIds.has(s.id));
    onApplyAll?.(accepted);
  };

  // Get slot and provider details
  const getSlotDetails = (slotId: string) => allSlots.find(s => s.id === slotId);
  const getProviderDetails = (providerId: string) => allProviders.find(p => p.id === providerId);

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 bg-green-50 border-green-200';
    if (confidence >= 0.8) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (confidence >= 0.7) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-slate-600 bg-slate-50 border-slate-200';
  };

  // Get confidence label
  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.9) return 'Very High';
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.7) return 'Medium';
    return 'Low';
  };

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            AI Suggestions
            {metrics && (
              <Badge variant="secondary" className="text-xs">
                {metrics.accepted}/{metrics.total}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            Regenerate
          </Button>
        </div>

        {/* Metrics */}
        {metrics && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            <MetricCard
              label="Avg Confidence"
              value={`${(metrics.avgConfidence * 100).toFixed(0)}%`}
              icon={<Brain className="w-3 h-3" />}
              color={metrics.avgConfidence >= 0.8 ? 'green' : 'amber'}
            />
            <MetricCard
              label="High Confidence"
              value={metrics.highConfidence.toString()}
              icon={<TrendingUp className="w-3 h-3" />}
              color="blue"
            />
            <MetricCard
              label="Fairness Score"
              value={`${(metrics.byFairness * 100).toFixed(0)}%`}
              icon={<Users className="w-3 h-3" />}
              color={metrics.byFairness >= 0.8 ? 'green' : 'amber'}
            />
          </div>
        )}

        {/* Confidence Filter */}
        <div className="flex items-center gap-2 mt-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500">Min confidence:</span>
          <div className="flex gap-1">
            {[0.7, 0.8, 0.9].map(threshold => (
              <button
                key={threshold}
                onClick={() => setFilterConfidence(threshold)}
                className={cn(
                  'px-2 py-0.5 text-xs rounded transition-colors',
                  filterConfidence === threshold
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {(threshold * 100).toFixed(0)}%
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[400px]">
          <div className="space-y-3 p-4 pt-0">
            {filteredSuggestions.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No suggestions match your criteria</p>
                <p className="text-xs mt-1">Try lowering the confidence threshold</p>
              </div>
            ) : (
              filteredSuggestions.map(suggestion => {
                const slot = getSlotDetails(suggestion.slotId);
                const provider = getProviderDetails(suggestion.providerId);
                const isExpanded = expandedId === suggestion.id;
                const isAccepted = acceptedIds.has(suggestion.id);
                const isRejected = rejectedIds.has(suggestion.id);

                if (!slot || !provider) return null;

                return (
                  <div
                    key={suggestion.id}
                    className={cn(
                      'border rounded-lg overflow-hidden transition-all',
                      isAccepted && 'border-green-300 bg-green-50/50',
                      isRejected && 'border-rose-300 bg-rose-50/30 opacity-60',
                      !isAccepted && !isRejected && 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    {/* Header */}
                    <div 
                      className="p-3 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : suggestion.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant="outline" 
                              className={cn('text-[10px]', getConfidenceColor(suggestion.confidence))}
                            >
                              {getConfidenceLabel(suggestion.confidence)}
                            </Badge>
                            <span className="text-xs text-slate-400">
                              {(suggestion.confidence * 100).toFixed(0)}% confidence
                            </span>
                          </div>
                          <p className="font-medium text-sm truncate">
                            {provider.name} → {slot.type} shift
                          </p>
                          <p className="text-xs text-slate-500">
                            {slot.date} • {slot.location}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          {!isAccepted && !isRejected && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAccept(suggestion);
                                }}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReject(suggestion);
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {isAccepted && (
                            <Badge variant="outline" className="text-green-600 border-green-300">
                              <Check className="w-3 h-3 mr-1" />
                              Accepted
                            </Badge>
                          )}
                          {isRejected && (
                            <Badge variant="outline" className="text-rose-600 border-rose-300">
                              <X className="w-3 h-3 mr-1" />
                              Rejected
                            </Badge>
                          )}
                          <button className="p-1 text-slate-400">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t bg-slate-50/50">
                        {/* Reasoning */}
                        <div className="py-3">
                          <p className="text-xs font-medium text-slate-500 mb-1">AI Reasoning</p>
                          <p className="text-sm text-slate-700">{suggestion.reasoning}</p>
                        </div>

                        {/* Factor Scores */}
                        <div className="grid grid-cols-2 gap-2">
                          <FactorScore label="Fairness" score={suggestion.factors.fairness} />
                          <FactorScore label="Preference" score={suggestion.factors.preference} />
                          <FactorScore label="Skill Match" score={suggestion.factors.skill} />
                          <FactorScore label="Workload" score={suggestion.factors.workload} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Apply All Button */}
        {acceptedIds.size > 0 && (
          <div className="p-4 border-t bg-slate-50">
            <Button 
              className="w-full"
              onClick={handleApplyAll}
            >
              <Check className="w-4 h-4 mr-2" />
              Apply {acceptedIds.size} Suggestion{acceptedIds.size !== 1 ? 's' : ''}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Metric card component
function MetricCard({ 
  label, 
  value, 
  icon, 
  color 
}: { 
  label: string; 
  value: string; 
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'amber' | 'red';
}) {
  const colorClasses = {
    green: 'text-green-600 bg-green-50',
    blue: 'text-blue-600 bg-blue-50',
    amber: 'text-amber-600 bg-amber-50',
    red: 'text-red-600 bg-red-50'
  };

  return (
    <div className="text-center p-2 rounded-lg bg-slate-50">
      <div className={cn('inline-flex items-center justify-center w-5 h-5 rounded-full mb-1', colorClasses[color])}>
        {icon}
      </div>
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
    </div>
  );
}

// Factor score component
function FactorScore({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center justify-between p-2 bg-white rounded border">
      <span className="text-xs text-slate-600">{label}</span>
      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className={cn(
              'h-full rounded-full transition-all',
              score >= 0.9 ? 'bg-green-500' :
              score >= 0.7 ? 'bg-blue-500' :
              score >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
            )}
            style={{ width: `${score * 100}%` }}
          />
        </div>
        <span className="text-xs font-medium w-8 text-right">
          {(score * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

export default AISuggestionsPanel;
