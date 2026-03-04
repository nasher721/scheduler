import { useState, useEffect, useRef } from "react";
import { useScheduleStore } from "@/store";
import type { ShiftSlot, Provider } from "@/types";
import { 
  Bot, 
  Lightbulb, 
  Shuffle, 
  UserPlus, 
  CheckCircle, 
  X,
  ChevronRight,
  Loader2
} from "lucide-react";
import { motion } from "framer-motion";

interface InlineSuggestionsProps {
  slot: ShiftSlot;
  provider: Provider | undefined;
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
}

interface Suggestion {
  id: string;
  type: 'swap' | 'assign' | 'unassign' | 'check' | 'optimize';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  action?: () => void;
}

export function InlineSuggestions({ 
  slot, 
  provider, 
  isOpen, 
  onClose,
  position 
}: InlineSuggestionsProps) {
  const store = useScheduleStore();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Generate contextual suggestions based on slot state
  useEffect(() => {
    if (!isOpen) return;

    const generateSuggestions = async () => {
      setIsLoading(true);
      
      const contextualSuggestions: Suggestion[] = [];

      // If unassigned, suggest finding a provider
      if (!provider) {
        contextualSuggestions.push({
          id: 'find-provider',
          type: 'assign',
          title: 'Find best provider',
          description: 'AI will suggest the most available provider',
          impact: 'high'
        });

        // Check for coverage gaps
        contextualSuggestions.push({
          id: 'check-coverage',
          type: 'check',
          title: 'Check coverage impact',
          description: 'See how this gap affects overall coverage',
          impact: 'medium'
        });
      } else {
        // If assigned, suggest swap options
        const otherProviders = store.providers.filter(p => 
          p.id !== provider.id && 
          p.skills.includes(slot.requiredSkill) &&
          !p.timeOffRequests.some(t => t.date === slot.date)
        );

        if (otherProviders.length > 0) {
          // Find provider with lowest load
          const bestSwap = otherProviders.reduce((min, p) => {
            const minCount = store.slots.filter(s => s.providerId === min.id).length;
            const pCount = store.slots.filter(s => s.providerId === p.id).length;
            return pCount < minCount ? p : min;
          });

          contextualSuggestions.push({
            id: 'swap-suggestion',
            type: 'swap',
            title: `Swap with ${bestSwap.name}`,
            description: `${bestSwap.name} has fewer assignments this week`,
            impact: 'medium'
          });
        }

        // Suggest unassign if overallocated
        const providerSlots = store.slots.filter(s => s.providerId === provider.id);
        const weekStart = getWeekStart(slot.date);
        const weekSlots = providerSlots.filter(s => getWeekStart(s.date) === weekStart);
        
        if (weekSlots.length > 5) {
          contextualSuggestions.push({
            id: 'overallocated',
            type: 'unassign',
            title: 'Reduce workload',
            description: `${provider.name} has ${weekSlots.length} shifts this week`,
            impact: 'high'
          });
        }
      }

      // Always add optimize option
      contextualSuggestions.push({
        id: 'optimize-day',
        type: 'optimize',
        title: 'Optimize this day',
        description: 'Balance all shifts for this date',
        impact: 'medium'
      });

      setSuggestions(contextualSuggestions);
      setIsLoading(false);
    };

    generateSuggestions();
  }, [isOpen, slot, provider, store.providers, store.slots]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setSelectedSuggestion(suggestion.id);
    
    // Execute action based on type
    switch (suggestion.type) {
      case 'assign':
        // Trigger AI auto-assign for this slot
        store.showToast({
          type: 'info',
          title: 'Finding Provider',
          message: 'AI is analyzing best candidate...'
        });
        break;
      case 'swap':
        // Open swap dialog
        store.showToast({
          type: 'info',
          title: 'Initiating Swap',
          message: suggestion.description
        });
        break;
      case 'optimize':
        // Run optimization for this date
        store.showToast({
          type: 'info',
          title: 'Optimizing',
          message: `Analyzing shifts for ${slot.date}...`
        });
        break;
      default:
        break;
    }

    // Close after action
    setTimeout(onClose, 500);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      ref={popoverRef}
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.15 }}
      className="fixed z-50 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
      style={{
        left: Math.min(position.x, window.innerWidth - 300),
        top: Math.min(position.y, window.innerHeight - 200)
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-50 to-white border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <Bot className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-semibold text-slate-700">AI Suggestions</span>
        </div>
        <button 
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-100 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      {/* Content */}
      <div className="p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-4 text-slate-400 text-xs">
            No suggestions for this shift
          </div>
        ) : (
          <div className="space-y-1">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={selectedSuggestion === suggestion.id}
                className={`w-full text-left p-2.5 rounded-lg transition-all group ${
                  selectedSuggestion === suggestion.id
                    ? 'bg-blue-100'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className={`mt-0.5 ${getImpactColor(suggestion.impact)}`}>
                    {getSuggestionIcon(suggestion.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-slate-700">
                        {suggestion.title}
                      </span>
                      <ImpactBadge impact={suggestion.impact} />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                      {suggestion.description}
                    </p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 bg-slate-50 border-t border-slate-100">
        <button 
          onClick={() => {
            store.toggleCopilot();
            onClose();
          }}
          className="w-full text-[10px] text-slate-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-1"
        >
          <Lightbulb className="w-3 h-3" />
          Ask AI assistant for more options
        </button>
      </div>
    </motion.div>
  );
}

function getImpactColor(impact: string): string {
  switch (impact) {
    case 'high':
      return 'text-rose-500';
    case 'medium':
      return 'text-amber-500';
    default:
      return 'text-blue-500';
  }
}

function ImpactBadge({ impact }: { impact: string }) {
  const colors = {
    high: 'bg-rose-100 text-rose-600',
    medium: 'bg-amber-100 text-amber-600',
    low: 'bg-blue-100 text-blue-600'
  };

  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${colors[impact as keyof typeof colors]}`}>
      {impact}
    </span>
  );
}

function getSuggestionIcon(type: string) {
  const icons = {
    swap: <Shuffle className="w-3.5 h-3.5" />,
    assign: <UserPlus className="w-3.5 h-3.5" />,
    unassign: <X className="w-3.5 h-3.5" />,
    check: <CheckCircle className="w-3.5 h-3.5" />,
    optimize: <Bot className="w-3.5 h-3.5" />
  };

  return icons[type as keyof typeof icons] || <Lightbulb className="w-3.5 h-3.5" />;
}

// Helper functions
function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const mondayDelta = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayDelta);
  return monday.toISOString().slice(0, 10);
}
