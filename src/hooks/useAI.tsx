/**
 * AI Services React Hooks
 * Frontend integration for AI services
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSharedMemory } from '../shared-memory';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// ============ MULTI-AGENT OPTIMIZATION HOOK ============

export function useAIOptimization() {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const startOptimization = useCallback(async (scheduleState: any) => {
    setIsOptimizing(true);
    setError(null);
    setResult(null);

    try {
      // Start SSE connection for progress
      const es = new EventSource(`${API_BASE}/api/ai/agents/optimize/stream`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setProgress(data);

        if (data.event === 'complete') {
          setResult(data.data);
          setIsOptimizing(false);
          es.close();
        }
      };

      es.onerror = (err) => {
        console.error('SSE error:', err);
        setError('Connection error');
        setIsOptimizing(false);
        es.close();
      };

      // Trigger optimization
      const response = await fetch(`${API_BASE}/api/ai/agents/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleState }),
      });

      if (!response.ok) {
        throw new Error('Optimization request failed');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsOptimizing(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    }
  }, []);

  const stopOptimization = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setIsOptimizing(false);
  }, []);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    isOptimizing,
    progress,
    result,
    error,
    startOptimization,
    stopOptimization,
  };
}

// ============ DEMAND FORECAST HOOK ============

export function useDemandForecast() {
  const [forecast, setForecast] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateForecast = useCallback(async (startDate: string, days: number = 14) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/ai/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, days }),
      });

      if (!response.ok) throw new Error('Forecast request failed');

      const data = await response.json();
      setForecast(data.forecast);
      return data.forecast;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { forecast, isLoading, error, generateForecast };
}

// ============ NLP ASSISTANT HOOK ============

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export function useNLPAssistant(userId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (message: string, context?: any) => {
    setIsProcessing(true);
    setError(null);

    // Add user message
    const userMsg: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const response = await fetch(`${API_BASE}/api/ai/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message, context }),
      });

      if (!response.ok) throw new Error('Chat request failed');

      const data = await response.json();

      // Add assistant message
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [userId]);

  const clearHistory = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/ai/assistant/history/${userId}`, {
        method: 'DELETE',
      });
      setMessages([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  }, [userId]);

  return { messages, isProcessing, error, sendMessage, clearHistory };
}

// ============ PREFERENCE LEARNING HOOK ============

export function usePreferenceLearning() {
  const [models, setModels] = useState<Record<string, any>>({});
  const [isLearning, setIsLearning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const learnAll = useCallback(async (scheduleState: any) => {
    setIsLearning(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/ai/preferences/learn-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleState }),
      });

      if (!response.ok) throw new Error('Learning request failed');

      const data = await response.json();
      
      // Fetch all models
      const modelsResponse = await fetch(`${API_BASE}/api/ai/preferences`);
      const modelsData = await modelsResponse.json();
      setModels(modelsData.models);

      return data.results;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setIsLearning(false);
    }
  }, []);

  const getRecommendation = useCallback(async (providerId: string, shift: any) => {
    try {
      const response = await fetch(`${API_BASE}/api/ai/preferences/recommend/${providerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift }),
      });

      if (!response.ok) throw new Error('Recommendation request failed');

      const data = await response.json();
      return data.recommendation;
    } catch (err) {
      console.error('Failed to get recommendation:', err);
      return null;
    }
  }, []);

  return { models, isLearning, error, learnAll, getRecommendation };
}

// ============ ANOMALY DETECTION HOOK ============

/** Shape stored under shared-memory key `anomaly:status` */
type AnomalyMemoryStatus = {
  lastCheck?: string | number;
};

export function useAnomalyDetection() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Get stored status from shared memory
  const [status] = useSharedMemory<AnomalyMemoryStatus>('anomaly:status');

  const startMonitoring = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/ai/anomalies/start`, { method: 'POST' });
      setIsMonitoring(true);

      // Connect to SSE stream
      const es = new EventSource(`${API_BASE}/api/ai/anomalies/stream`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === 'anomaly' || data.event === 'critical') {
          setAlerts(prev => [data.alert, ...prev]);
        }
      };

      es.onerror = (err) => {
        console.error('Anomaly SSE error:', err);
      };

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const stopMonitoring = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/ai/anomalies/stop`, { method: 'POST' });
      setIsMonitoring(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    } catch (err) {
      console.error('Failed to stop monitoring:', err);
    }
  }, []);

  const fetchAlerts = useCallback(async (severity?: string) => {
    try {
      const url = new URL(`${API_BASE}/api/ai/anomalies/alerts`);
      if (severity) url.searchParams.append('severity', severity);

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch alerts');

      const data = await response.json();
      setAlerts(data.alerts);
      return data.alerts;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return [];
    }
  }, []);

  const resolveAlert = useCallback(async (alertId: string, resolution: string) => {
    try {
      await fetch(`${API_BASE}/api/ai/anomalies/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution }),
      });

      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    alerts,
    isMonitoring,
    status,
    error,
    startMonitoring,
    stopMonitoring,
    fetchAlerts,
    resolveAlert,
  };
}

// ============ UNIFIED AI STATUS HOOK ============

// Maximum number of consecutive network failures before polling is paused.
const AI_STATUS_MAX_FAILURES = 3;
// After MAX_FAILURES the interval backs off to 5 minutes so the console stays
// quiet when the AI backend is unreachable.
const AI_STATUS_BACKOFF_MS = 5 * 60 * 1000;

export function useAIStatus() {
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const consecutiveFailuresRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/ai/status`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        consecutiveFailuresRef.current = 0;
        setIsAvailable(true);
      }
    } catch {
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current === AI_STATUS_MAX_FAILURES) {
        // Log once instead of on every poll cycle.
        console.warn(
          `[NICU Scheduler] AI status endpoint unreachable after ${AI_STATUS_MAX_FAILURES} attempts. ` +
          'Polling paused — click Refresh to retry.',
        );
        setIsAvailable(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reschedule the interval dynamically: normal cadence while reachable, backed-
  // off cadence once the failure threshold is crossed.
  useEffect(() => {
    const scheduleNext = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const delay = consecutiveFailuresRef.current >= AI_STATUS_MAX_FAILURES
        ? AI_STATUS_BACKOFF_MS
        : 30000;
      intervalRef.current = setInterval(() => {
        void fetchStatus().then(scheduleNext);
      }, delay);
    };

    void fetchStatus().then(scheduleNext);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // fetchStatus is stable (useCallback with no deps), so this runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, isLoading, isAvailable, refresh: fetchStatus };
}
