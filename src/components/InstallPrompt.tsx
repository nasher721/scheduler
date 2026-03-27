import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const installTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if already installed using useCallback to avoid dependency issues
  const checkInstalled = useCallback(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    // Check installation status in a microtask to avoid synchronous setState
    const checkStatus = () => {
      Promise.resolve().then(() => {
        checkInstalled();
      });
    };
    
    checkStatus();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Delay showing the install banner by 2 minutes
      installTimerRef.current = setTimeout(() => {
        setIsInstallable(true);
      }, 120000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      if (installTimerRef.current) clearTimeout(installTimerRef.current);
    };
  }, [checkInstalled]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setTimeout(() => setIsInstallable(false), 300);
  };

  if (!isInstallable || isInstalled || isDismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50"
      >
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4">
          <div className="p-3 bg-primary/20 rounded-xl">
            <Smartphone className="w-6 h-6 text-primary" />
          </div>
          
          <div className="flex-1">
            <h4 className="text-sm font-bold">Install App</h4>
            <p className="text-xs text-slate-300 mt-0.5">
              Add Neuro ICU Scheduler to your home screen
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstall}
              className="p-2 bg-primary text-white rounded-xl hover:bg-primary-dark transition-all"
              title="Install"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handleDismiss}
              className="p-2 text-slate-400 hover:text-white transition-all"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
