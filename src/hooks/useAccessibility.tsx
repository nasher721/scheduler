import { useEffect, useCallback, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';

/**
 * Hook to announce messages to screen readers
 */
export function useAnnouncer() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcer = document.getElementById(`aria-announcer-${priority}`);
    if (announcer) {
      announcer.textContent = message;
      // Clear after announcement
      setTimeout(() => {
        announcer.textContent = '';
      }, 1000);
    }
  }, []);

  return { announce };
}

/**
 * Hook to manage focus trap within a modal/dialog
 */
export function useFocusTrap(isActive: boolean, containerRef: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    // Focus first element when activated
    firstElement?.focus();

    container.addEventListener('keydown', handleTabKey);
    return () => container.removeEventListener('keydown', handleTabKey);
  }, [isActive, containerRef]);
}

/**
 * Hook to skip to main content
 */
export function useSkipLink() {
  const skipToContent = useCallback(() => {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.tabIndex = -1;
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  return { skipToContent };
}

/**
 * Hook to manage reduced motion preference
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * Hook to manage high contrast preference
 */
export function useHighContrast(): boolean {
  const [prefersHighContrast, setPrefersHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setPrefersHighContrast(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersHighContrast(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersHighContrast;
}

/**
 * Hook for accessible click handling (Enter/Space on focusable elements)
 */
export function useAccessibleClick(onClick: () => void): (e: ReactKeyboardEvent) => void {
  return useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    },
    [onClick]
  );
}

/**
 * Hook to manage aria-live region
 */
export function useAriaLive(priority: 'polite' | 'assertive' = 'polite') {
  const [message, setMessage] = useState('');

  const announce = useCallback((newMessage: string) => {
    setMessage(newMessage);
    // Clear after screen reader has had time to announce
    setTimeout(() => setMessage(''), 1000);
  }, []);

  return { message, announce, priority };
}

/**
 * Component to render aria-live announcer regions
 */
export function AriaAnnouncer() {
  return (
    <>
      <div id="aria-announcer-polite" aria-live="polite" aria-atomic="true" className="sr-only" />
      <div id="aria-announcer-assertive" aria-live="assertive" aria-atomic="true" className="sr-only" />
    </>
  );
}

/**
 * Skip to main content link component
 */
export function SkipLink() {
  const { skipToContent } = useSkipLink();

  return (
    <button
      onClick={skipToContent}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg"
    >
      Skip to main content
    </button>
  );
}

/**
 * Hook to manage page title updates
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | Neuro ICU Scheduler`;

    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}

/**
 * Hook to detect keyboard navigation vs mouse
 */
export function useInputMode() {
  const [inputMode, setInputMode] = useState<'keyboard' | 'mouse'>('mouse');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setInputMode('keyboard');
      }
    };

    const handleMouseDown = () => {
      setInputMode('mouse');
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return inputMode;
}
