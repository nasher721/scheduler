import { useState, useEffect, useCallback } from "react";
import { requestJson } from "@/lib/api/client";

export interface AnomalyAlert {
  id: string;
  severity?: string;
  type?: string;
  message?: string;
  description?: string;
  detectedAt?: string;
  [key: string]: unknown;
}

interface AnomalyAlertsResponse {
  alerts: AnomalyAlert[];
  count: number;
}

export function useAnomalyAlerts(options?: { severity?: string }) {
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAlerts = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const query = options?.severity ? `?severity=${encodeURIComponent(options.severity)}` : "";
      const data = await requestJson<AnomalyAlertsResponse>(
        `/api/ai/anomalies/alerts${query}`,
        { method: "GET" },
        "Fetch anomaly alerts"
      );
      setAlerts(data.alerts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  }, [options?.severity]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return { alerts, isLoading, error, refresh: fetchAlerts };
}
