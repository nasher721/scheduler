import { useState, useEffect } from "react";

// Hook to check if running as installed PWA
export function useIsPWA() {
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    const checkPWA = () => {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const isIOSStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsPWA(isStandalone || isIOSStandalone);
    };

    checkPWA();
    window.addEventListener("resize", checkPWA);
    return () => window.removeEventListener("resize", checkPWA);
  }, []);

  return isPWA;
}

// Hook for online/offline status
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
