import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { SidebarNav } from "./SidebarNav";
import type { ViewMode } from "./navigation";

interface AppShellProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  isSidebarOpen: boolean;
  onSidebarOpenChange: (open: boolean) => void;
  /** Rendered at the top of the content column, above `children`. */
  topBar: ReactNode;
  children: ReactNode;
}

/**
 * Rail + content. The rail is persistent from xl up and a drawer below it,
 * so the schedule keeps the full width on the screens people actually use.
 */
export function AppShell({
  view,
  onViewChange,
  isSidebarOpen,
  onSidebarOpenChange,
  topBar,
  children,
}: AppShellProps) {
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSidebarOpenChange(false);
      if (event.key !== "Tab") return;
      const items = drawerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]');
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [isSidebarOpen, onSidebarOpenChange]);

  return (
    <div className="scheduler-app flex min-h-dvh bg-background text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:p-3 focus:text-white">Skip to schedule content</a>
      <aside className="no-print sticky top-0 hidden h-dvh w-[224px] shrink-0 xl:block">
        <SidebarNav view={view} onChange={onViewChange} />
      </aside>

      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => onSidebarOpenChange(false)}
              className="fixed inset-0 z-40 bg-foreground/40 xl:hidden"
              aria-hidden="true"
            />
            <motion.aside
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Workspace navigation"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 240 }}
              className="fixed inset-y-0 left-0 z-50 w-[248px] border-r border-border shadow-xl xl:hidden"
            >
              <button
                type="button"
                onClick={() => onSidebarOpenChange(false)}
                className="absolute right-1 top-1 z-10 flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10"
                aria-label="Close navigation"
              >
                <X className="h-4.5 w-4.5" />
              </button>
              <SidebarNav view={view} onChange={onViewChange} onNavigate={() => onSidebarOpenChange(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        {topBar}
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 outline-none sm:px-7 sm:py-8 2xl:px-10">{children}</main>
      </div>
    </div>
  );
}
