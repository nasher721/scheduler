import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Provider, ShiftSlot } from "@/types";
import {
  User,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Star,
  Sparkles,
  ChevronRight,
} from "lucide-react";

interface ProviderRanking {
  provider: Provider;
  score: number;
  matchReasons: string[];
  conflicts: string[];
}

interface CopilotQueryResultProps {
  title: string;
  description?: string;
  rankings: ProviderRanking[];
  selectedSlot?: ShiftSlot | null;
  onSelectProvider?: (providerId: string) => void;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-blue-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-green-50 border-green-200";
  if (score >= 60) return "bg-blue-50 border-blue-200";
  if (score >= 40) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

export function CopilotQueryResult({
  title,
  description,
  rankings,
  selectedSlot,
  onSelectProvider,
  className
}: CopilotQueryResultProps) {
  const sortedRankings = useMemo(() => {
    return [...rankings].sort((a, b) => b.score - a.score);
  }, [rankings]);

  if (sortedRankings.length === 0) {
    return (
      <div className={cn("rounded-xl border border-slate-200 bg-white p-6 text-center", className)}>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <User className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-900">No results</p>
        <p className="text-sm text-slate-500">No provider recommendations available</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white overflow-hidden", className)}>
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-slate-900">{title}</h3>
        </div>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
        {selectedSlot && (
          <p className="mt-1 text-xs text-slate-500">
            Based on: {selectedSlot.type} on {selectedSlot.date}
          </p>
        )}
      </div>

      <div className="divide-y divide-slate-100">
        {sortedRankings.map((ranking, index) => {
          const isTopPick = index === 0;
          
          return (
            <motion.button
              key={ranking.provider.id}
              type="button"
              onClick={() => onSelectProvider?.(ranking.provider.id)}
              disabled={!onSelectProvider}
              className={cn(
                "group w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
                onSelectProvider && "hover:bg-slate-50 cursor-pointer"
              )}
            >
              <div className="flex flex-col items-center gap-1">
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                  isTopPick 
                    ? "bg-gradient-to-br from-yellow-100 to-amber-200 text-amber-700" 
                    : "bg-slate-100 text-slate-600"
                )}>
                  {index + 1}
                </div>
                {isTopPick && (
                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-slate-900">
                    {ranking.provider.name}
                  </span>
                  {ranking.provider.credentials?.some(c => c.status === "ACTIVE" as any) && (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                      Active
                    </span>
                  )}
                </div>

                {ranking.matchReasons.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {ranking.matchReasons.slice(0, 2).map((reason) => (
                      <span 
                        key={reason}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {reason}
                      </span>
                    ))}
                  </div>
                )}

                {ranking.conflicts.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {ranking.conflicts.slice(0, 2).map((conflict) => (
                      <span 
                        key={conflict}
                        className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-700"
                      >
                        <AlertCircle className="h-3 w-3" />
                        {conflict}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className={cn(
                  "flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold",
                  getScoreBgColor(ranking.score)
                )}>
                  <TrendingUp className="h-4 w-4" />
                  <span className={getScoreColor(ranking.score)}>
                    {ranking.score}%
                  </span>
                </div>
                {onSelectProvider && (
                  <ChevronRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {sortedRankings.length > 3 && (
        <div className="border-t border-slate-100 px-4 py-2 bg-slate-50">
          <p className="text-xs text-slate-500">
            Showing top {Math.min(5, sortedRankings.length)} of {sortedRankings.length} recommendations
          </p>
        </div>
      )}
    </div>
  );
}

interface CopilotRecommendationCardProps {
  provider: Provider;
  slot: ShiftSlot;
  className?: string;
}

export function CopilotRecommendationCard({ provider, slot, className }: CopilotRecommendationCardProps) {
  const hasSkill = Array.isArray(provider.skills) && provider.skills.includes(slot.requiredSkill);
  const isOnTimeOff = Array.isArray(provider.timeOffRequests) && 
    provider.timeOffRequests.some((r) => r?.date === slot.date);

  return (
    <div className={cn(
      "rounded-xl border p-4 transition-all",
      hasSkill && !isOnTimeOff 
        ? "border-green-200 bg-green-50" 
        : "border-slate-200 bg-white",
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200">
            <User className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900">{provider.name}</p>
            <p className="text-xs text-slate-500">
              Provider
            </p>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1">
          {hasSkill ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              <CheckCircle2 className="h-3 w-3" />
              Skill match
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              <AlertCircle className="h-3 w-3" />
              Skill gap
            </span>
          )}
        </div>
      </div>

      {isOnTimeOff && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2">
          <Clock className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">
            Provider has time off requested for this date
          </p>
        </div>
      )}
    </div>
  );
}
