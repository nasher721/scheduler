import { useState, useCallback } from 'react';

export function useOnboardingTour() {
  const [hasSeenTour, setHasSeenTour] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('nicu-scheduler-tour-seen') === 'true';
  });

  const [isOpen, setIsOpen] = useState(false);

  const startTour = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeTour = useCallback(() => {
    setIsOpen(false);
  }, []);

  const completeTour = useCallback(() => {
    localStorage.setItem('nicu-scheduler-tour-seen', 'true');
    setHasSeenTour(true);
    setIsOpen(false);
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem('nicu-scheduler-tour-seen');
    setHasSeenTour(false);
  }, []);

  return {
    isOpen,
    hasSeenTour,
    startTour,
    closeTour,
    completeTour,
    resetTour,
  };
}
