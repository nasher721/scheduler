import { useState, useCallback, useRef, useEffect } from 'react';

interface LoadingStateOptions {
  minDuration?: number;
  delay?: number;
}

/**
 * Hook for managing loading states with minimum duration and delay
 * Prevents flashing loaders for fast operations
 */
export function useLoadingState(options: LoadingStateOptions = {}) {
  const { minDuration = 300, delay = 0 } = options;
  
  const [isLoading, setIsLoading] = useState(false);
  const [isDelayed, setIsDelayed] = useState(true);
  const startTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const startLoading = useCallback(() => {
    startTimeRef.current = Date.now();
    
    if (delay > 0) {
      setIsDelayed(true);
      timeoutRef.current = setTimeout(() => {
        setIsDelayed(false);
        setIsLoading(true);
      }, delay);
    } else {
      setIsDelayed(false);
      setIsLoading(true);
    }
  }, [delay]);

  const stopLoading = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;
    const remaining = Math.max(0, minDuration - elapsed);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (remaining > 0 && !isDelayed) {
      timeoutRef.current = setTimeout(() => {
        setIsLoading(false);
        setIsDelayed(true);
      }, remaining);
    } else {
      setIsLoading(false);
      setIsDelayed(true);
    }
  }, [minDuration, isDelayed]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Wrap an async function with loading state
  const withLoading = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    startLoading();
    return fn().finally(stopLoading);
  }, [startLoading, stopLoading]);

  return {
    isLoading: isLoading && !isDelayed,
    isVisible: isLoading || !isDelayed,
    startLoading,
    stopLoading,
    withLoading,
  };
}

/**
 * Hook for tracking multiple concurrent loading operations
 */
export function useMultiLoadingState(keys: string[]) {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>(
    () => Object.fromEntries(keys.map(key => [key, false]))
  );

  const startLoading = useCallback((key: string) => {
    setLoadingStates(prev => ({ ...prev, [key]: true }));
  }, []);

  const stopLoading = useCallback((key: string) => {
    setLoadingStates(prev => ({ ...prev, [key]: false }));
  }, []);

  const isLoading = useCallback((key?: string) => {
    if (key) return loadingStates[key] || false;
    return Object.values(loadingStates).some(Boolean);
  }, [loadingStates]);

  const wrap = useCallback(<T,>(key: string, fn: () => Promise<T>): Promise<T> => {
    startLoading(key);
    return fn().finally(() => stopLoading(key));
  }, [startLoading, stopLoading]);

  return {
    loadingStates,
    startLoading,
    stopLoading,
    isLoading,
    isAnyLoading: Object.values(loadingStates).some(Boolean),
    wrap,
  };
}

/**
 * Hook for optimistic updates with rollback capability
 */
export function useOptimisticUpdate<T>(initialState: T) {
  const [state, setState] = useState<T>(initialState);
  const [pendingState, setPendingState] = useState<T | null>(null);
  const previousStateRef = useRef<T>(initialState);

  const optimisticUpdate = useCallback((newState: T) => {
    previousStateRef.current = state;
    setPendingState(newState);
    setState(newState);
  }, [state]);

  const commit = useCallback(() => {
    setPendingState(null);
    previousStateRef.current = state;
  }, [state]);

  const rollback = useCallback(() => {
    if (pendingState !== null) {
      setState(previousStateRef.current);
      setPendingState(null);
    }
  }, [pendingState]);

  return {
    state,
    setState,
    pendingState,
    isPending: pendingState !== null,
    optimisticUpdate,
    commit,
    rollback,
  };
}

export default useLoadingState;
