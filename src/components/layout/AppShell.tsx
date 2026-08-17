import type { ReactNode } from "react";
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
  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <aside className="no-print sticky top-0 hidden h-dvh w-[232px] shrink-0 border-r border-border/70 xl:block">
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
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 240 }}
              className="fixed inset-y-0 left-0 z-50 w-[248px] border-r border-border shadow-xl xl:hidden"
            >
              <button
                type="button"
                onClick={() => onSidebarOpenChange(false)}
                className="absolute right-2 top-3.5 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-secondary"
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
        <main className="min-w-0 flex-1 px-4 py-4 sm:px-5">{children}</main>
      </div>
    </div>
  );
}
