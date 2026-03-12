import { useState, useEffect, useCallback } from "react";
import {
  fetchApplyHistory,
  fetchApplyHistorySummary,
  type AiApplyRecord,
  type AiApplySummary,
} from "@/lib/api/aiApplyHistory";

export interface UseAiApplyHistoryOptions {
  limit?: number;
  days?: number;
}

export function useAiApplyHistory(options: UseAiApplyHistoryOptions = {}) {
  const { limit = 50, days = 30 } = options;
  const [records, setRecords] = useState<AiApplyRecord[]>([]);
  const [summary, setSummary] = useState<AiApplySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const [historyRes, summaryRes] = await Promise.all([
        fetchApplyHistory(limit),
        fetchApplyHistorySummary(days),
      ]);
      setRecords(historyRes.records as AiApplyRecord[]);
      setSummary(summaryRes.summary);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setRecords([]);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [limit, days]);

  useEffect(() => {
    load();
  }, [load]);

  return { records, summary, isLoading, error, refresh: load };
}
