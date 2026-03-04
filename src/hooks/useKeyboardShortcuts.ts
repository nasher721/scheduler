import { useEffect, useState } from "react";

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey : !e.ctrlKey;
        const metaMatch = shortcut.meta ? e.metaKey : !e.metaKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;

        if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          shortcut.handler();
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}

// Hook specifically for copilot keyboard shortcuts
export function useCopilotKeyboard(
  isOpen: boolean,
  onToggle: () => void,
  onNewChat?: () => void,
  onFocusInput?: () => void
) {
  const [showHelp, setShowHelp] = useState(false);

  useKeyboardShortcuts([
    {
      key: "k",
      ctrl: true,
      handler: () => onToggle(),
      preventDefault: true,
    },
    {
      key: "k",
      meta: true,
      handler: () => onToggle(),
      preventDefault: true,
    },
    {
      key: "n",
      ctrl: true,
      handler: () => {
        if (isOpen && onNewChat) {
          onNewChat();
        }
      },
      preventDefault: true,
    },
    {
      key: "n",
      meta: true,
      handler: () => {
        if (isOpen && onNewChat) {
          onNewChat();
        }
      },
      preventDefault: true,
    },
    {
      key: "/",
      handler: () => {
        if (isOpen && onFocusInput) {
          onFocusInput();
        }
      },
      preventDefault: true,
    },
    {
      key: "Escape",
      handler: () => {
        if (isOpen) {
          onToggle();
        }
      },
    },
    {
      key: "?",
      shift: true,
      handler: () => setShowHelp(true),
      preventDefault: true,
    },
  ]);

  return { showHelp, setShowHelp };
}

// Hook for detecting mobile viewport
export function useMobileDetect() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      setIsMobile(width < 640);
      setIsTablet(width >= 640 && width < 1024);
    };

    checkDevice();
    window.addEventListener("resize", checkDevice);
    return () => window.removeEventListener("resize", checkDevice);
  }, []);

  return { isMobile, isTablet };
}

// Hook for focus management
export function useFocusTrap(isActive: boolean, containerRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    container.addEventListener("keydown", handleTabKey);
    firstElement?.focus();

    return () => container.removeEventListener("keydown", handleTabKey);
  }, [isActive, containerRef]);
}
