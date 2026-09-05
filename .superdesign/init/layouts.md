# Shared layouts

Verbatim shared shell, navigation, view dispatch, overlay, and error/loading files.

### src/components/layout/AppShell.tsx

```tsx
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

```

### src/components/layout/SidebarNav.tsx

```tsx
import { Activity } from "lucide-react";
import { useScheduleStore } from "@/store";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS, type NavItem, type ViewMode } from "./navigation";

interface SidebarNavProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
  /** Called after any successful navigation — used to close the mobile drawer. */
  onNavigate?: () => void;
}

function Badge({ count, tone }: { count: number; tone: NavItem["badgeTone"] }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
        tone === "error" && "bg-error/10 text-error",
        tone === "warning" && "bg-warning/15 text-warning",
        (!tone || tone === "neutral") && "bg-secondary text-foreground-secondary",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * The single, persistent navigation surface for the admin workspace.
 * Everything the scheduler can open lives here, one click deep.
 */
export function SidebarNav({ view, onChange, onNavigate }: SidebarNavProps) {
  const currentUser = useScheduleStore((s) => s.currentUser);
  const conflictCount = useScheduleStore(
    (s) => s.conflicts?.filter((c) => !c.resolvedAt && !c.acknowledged).length ?? 0,
  );
  const alertCount = useScheduleStore((s) => s.notifications?.filter((n) => !n.readAt).length ?? 0);

  const badgeFor = (item: NavItem) => {
    if (item.badgeKey === "conflicts") return conflictCount;
    if (item.badgeKey === "alerts") return alertCount;
    return 0;
  };

  const select = (next: ViewMode) => {
    onChange(next);
    onNavigate?.();
  };

  const initials =
    currentUser?.name
      ?.split(" ")
      .map((part: string) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return (
    <div className="workspace-sidebar flex h-full min-h-0 flex-col">
      <div className="flex h-24 shrink-0 items-center gap-3 px-5">
        <span className="workspace-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Activity className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span className="min-w-0"><span className="block text-lg font-semibold tracking-tight">Neuro ICU<span className="text-primary">.</span></span><span className="mt-0.5 block text-[11px] tracking-wide text-foreground-secondary">Cleveland Clinic</span></span>
      </div>

      <nav aria-label="Workspace" className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.id}>
            <p className="px-3 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
              {section.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const isActive = item.value === view;
                const Icon = item.icon;
                return (
                  <li key={item.value}>
                    <button
                      type="button"
                      onClick={() => select(item.value)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "workspace-nav-item flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-[13px] transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                        isActive
                          ? "workspace-nav-active font-semibold text-primary"
                          : "font-medium text-foreground-secondary hover:bg-secondary/60 hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-primary" : "text-foreground-muted")}
                        strokeWidth={1.7}
                      />
                      <span className="truncate">{item.label}</span>
                      <Badge count={badgeFor(item)} tone={item.badgeTone} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {currentUser && (
        <div className="flex h-20 shrink-0 items-center gap-3 border-t border-border/60 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary text-xs font-semibold text-foreground-secondary">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold leading-tight">{currentUser.name}</span>
            <span className="block truncate text-[11px] leading-tight text-foreground-muted">
              {currentUser.role === "ADMIN" ? "Administrator" : "Scheduler"}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

```

### src/components/layout/TopBar.tsx

```tsx
import type { ReactNode } from "react";
import { Menu, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "local" | "error";

const SAVE_LABEL: Record<Exclude<SaveStatus, "idle">, string> = {
  pending: "Unsaved",
  saving: "Saving",
  saved: "Saved",
  local: "On this device",
  error: "Save failed",
};

interface TopBarProps {
  title: string;
  hint: string;
  saveStatus: SaveStatus;
  isOnline: boolean;
  onOpenSearch: () => void;
  onOpenSidebar: () => void;
  /** Primary action plus the overflow menu. */
  actions?: ReactNode;
}

/**
 * A single 56px bar: where you are, one way to search, one primary action,
 * and everything else folded into the overflow menu passed as `actions`.
 */
export function TopBar({
  title,
  hint,
  saveStatus,
  isOnline,
  onOpenSearch,
  onOpenSidebar,
  actions,
}: TopBarProps) {
  const statusLabel = !isOnline ? "Offline" : saveStatus === "idle" ? null : SAVE_LABEL[saveStatus];
  const statusTone = !isOnline || saveStatus === "error" ? "error" : saveStatus === "saved" ? "success" : "muted";

  return (
    <header className="workspace-topbar no-print sticky top-0 z-30 flex min-h-16 shrink-0 items-center gap-2 border-b border-border/70 bg-surface px-4 sm:gap-3 sm:px-7 2xl:px-10">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-secondary/70 xl:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
        <span className="hidden shrink-0 text-sm text-foreground-secondary lg:inline">Neurocritical care <span className="mx-2 text-foreground-muted" aria-hidden="true">/</span></span>
        <p className="truncate text-sm font-medium" title={hint}>{title}</p>
      </div>

      <button
        type="button"
        onClick={onOpenSearch}
        className="hidden h-11 w-52 items-center gap-2 rounded-lg border border-border bg-background px-3 text-left transition-colors hover:border-border-strong md:flex 2xl:w-64"
        aria-label="Search people and shifts"
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
        <span className="flex-1 truncate text-sm text-foreground-muted">Search people & shifts</span>
        <kbd className="rounded border border-border bg-background px-1 text-[10.5px] font-semibold text-foreground-muted">
          ⌘K
        </kbd>
      </button>

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-secondary/70 md:hidden"
        aria-label="Search"
      >
        <Search className="h-[18px] w-[18px]" />
      </button>

      {actions}

      {statusLabel && (
        <div role="status" className="hidden items-center gap-1.5 border-l border-border/70 pl-3 2xl:flex">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              statusTone === "error" && "bg-error",
              statusTone === "success" && "bg-success",
              statusTone === "muted" && "bg-foreground-muted",
            )}
          />
          <span className="text-xs text-foreground-tertiary">{statusLabel}</span>
        </div>
      )}
    </header>
  );
}

```

### src/components/layout/ViewContent.tsx

```tsx
import { Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ViewMode } from './navigation';
import { LoadingFallback } from './LoadingFallback';

// Lazy-load view components for code splitting and faster initial load
const AnalyticsDashboard = lazy(() =>
  import('../AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard }))
);
const ScheduleWorkspace = lazy(() =>
  import('../schedule/ScheduleWorkspace').then((m) => ({ default: m.ScheduleWorkspace }))
);
const ShiftRequestBoard = lazy(() =>
  import('../ShiftRequestBoard').then((m) => ({ default: m.ShiftRequestBoard }))
);
const RuleBuilder = lazy(() =>
  import('../RuleBuilder').then((m) => ({ default: m.RuleBuilder }))
);
const SchedulingStrategyWorkbench = lazy(() =>
  import('../SchedulingStrategyWorkbench').then((m) => ({ default: m.SchedulingStrategyWorkbench }))
);
const SwapManager = lazy(() =>
  import('../SwapManager').then((m) => ({ default: m.SwapManager }))
);
const HolidayTracker = lazy(() =>
  import('../HolidayTracker').then((m) => ({ default: m.HolidayTracker }))
);
const ConflictDashboard = lazy(() =>
  import('../ConflictDashboard').then((m) => ({ default: m.ConflictDashboard }))
);
const NotificationCenter = lazy(() =>
  import('../NotificationCenter').then((m) => ({ default: m.NotificationCenter }))
);
const PredictiveInsights = lazy(() =>
  import('../PredictiveInsights').then((m) => ({ default: m.PredictiveInsights }))
);
const ScheduleTemplates = lazy(() =>
  import('../ScheduleTemplates').then((m) => ({ default: m.ScheduleTemplates }))
);
const AITestPanel = lazy(() =>
  import('../AITestPanel').then((m) => ({ default: m.AITestPanel }))
);
const SmartHub = lazy(() =>
  import('../SmartHub').then((m) => ({ default: m.SmartHub }))
);

interface ViewContentProps {
  viewMode: ViewMode;
}

function ViewSwitch({ viewMode }: ViewContentProps) {
  switch (viewMode) {
    case 'analytics':
      return <AnalyticsDashboard />;
    case 'schedule':
      return <ScheduleWorkspace />;
    case 'shift-requests':
      return <ShiftRequestBoard />;
    case 'rules':
      return <RuleBuilder />;
    case 'strategy':
      return <SchedulingStrategyWorkbench />;
    case 'swaps':
      return <SwapManager />;
    case 'holidays':
      return <HolidayTracker />;
    case 'conflicts':
      return <ConflictDashboard />;
    case 'notifications':
      return <NotificationCenter />;
    case 'predictive':
      return <PredictiveInsights />;
    case 'templates':
      return <ScheduleTemplates />;
    case 'ai-test':
      return <AITestPanel />;
    case 'smarthub':
      return <SmartHub />;
    default:
      return <ScheduleWorkspace />;
  }
}

/**
 * Renders the active scheduler view with Suspense and a loading fallback.
 * Views are lazy-loaded for better initial load and code splitting.
 */
export function ViewContent({ viewMode }: ViewContentProps) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <ViewSwitch viewMode={viewMode} />
        </motion.div>
      </AnimatePresence>
    </Suspense>
  );
}

```

### src/components/layout/WorkspaceMenu.tsx

```tsx
import { useState } from "react";
import {
  AlertTriangle,
  Download,
  Layers,
  Monitor,
  Moon,
  MoreHorizontal,
  RefreshCcw,
  Redo2,
  Save,
  Sparkles,
  Sun,
  Trash,
  Undo2,
  Upload,
} from "lucide-react";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

interface WorkspaceMenuProps {
  startDate: string;
  numWeeks: number;
  onScheduleRangeChange: (startDate: string, numWeeks: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAutoFill: () => void;
  onImport: () => void;
  onExport: () => void;
  canRollbackImport: boolean;
  onRollbackImport: () => void;
  onToggleScenarios: () => void;
  onSaveToServer: () => void;
  onRestoreLastGood: () => void;
  onClearSchedule: () => void;
  onClearStaff: () => void;
}

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
];

function MenuItem({
  icon: Icon,
  label,
  hint,
  tone = "default",
  disabled,
  onClick,
}: {
  icon: typeof Sun;
  label: string;
  hint?: string;
  tone?: "default" | "warning" | "error";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        tone === "default" && "text-foreground hover:bg-secondary/70",
        tone === "warning" && "text-warning hover:bg-warning/10",
        tone === "error" && "text-error hover:bg-error/10",
      )}
    >
      <Icon
        className={cn("h-3.5 w-3.5 shrink-0", tone === "default" && "text-foreground-muted")}
        strokeWidth={1.8}
      />
      <span className="flex-1 truncate">{label}</span>
      {hint && <kbd className="text-[10.5px] font-semibold text-foreground-muted">{hint}</kbd>}
    </button>
  );
}

/**
 * Every secondary schedule operation, folded behind one button. The top bar
 * keeps a single primary action; nothing else earns permanent space.
 */
export function WorkspaceMenu(props: WorkspaceMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const run = (action: () => void) => () => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="More actions"
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-md border border-border text-foreground-secondary transition-colors hover:bg-secondary/70",
          isOpen && "bg-secondary text-foreground",
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1.5 w-64 rounded-xl border border-border bg-surface p-1.5 shadow-lg"
          >
            <div className="px-2.5 pb-2 pt-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-foreground-muted">
                Planning window
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="date"
                  aria-label="Start date"
                  value={props.startDate}
                  onChange={(e) => props.onScheduleRangeChange(e.target.value, props.numWeeks)}
                  className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
                <label className="flex shrink-0 items-center gap-1 text-xs text-foreground-tertiary">
                  <input
                    type="number"
                    min={1}
                    max={12}
                    aria-label="Number of weeks"
                    value={props.numWeeks}
                    onChange={(e) =>
                      props.onScheduleRangeChange(
                        props.startDate,
                        Math.min(12, Math.max(1, Number(e.target.value) || 1)),
                      )
                    }
                    className="w-11 rounded-md border border-border bg-surface px-1 py-1 text-center text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                  wks
                </label>
              </div>
            </div>

            <div className="my-1 border-t border-border/70" />

            <MenuItem icon={Undo2} label="Undo" hint="⌘Z" disabled={!props.canUndo} onClick={run(props.onUndo)} />
            <MenuItem icon={Redo2} label="Redo" hint="⇧⌘Z" disabled={!props.canRedo} onClick={run(props.onRedo)} />
            <MenuItem icon={Sparkles} label="Fill empty slots" onClick={run(props.onAutoFill)} />

            <div className="my-1 border-t border-border/70" />

            <MenuItem icon={Upload} label="Import from Excel" onClick={run(props.onImport)} />
            <MenuItem icon={Download} label="Export…" onClick={run(props.onExport)} />
            {props.canRollbackImport && (
              <MenuItem icon={RefreshCcw} label="Roll back last import" onClick={run(props.onRollbackImport)} />
            )}
            <MenuItem icon={Layers} label="Scenarios" onClick={run(props.onToggleScenarios)} />

            <div className="my-1 border-t border-border/70" />

            <MenuItem icon={Save} label="Save to server" onClick={run(props.onSaveToServer)} />
            <MenuItem icon={RefreshCcw} label="Restore last good schedule" onClick={run(props.onRestoreLastGood)} />

            <div className="my-1 border-t border-border/70" />

            <MenuItem
              icon={Trash}
              label="Clear assignments"
              tone="warning"
              onClick={run(props.onClearSchedule)}
            />
            <MenuItem
              icon={AlertTriangle}
              label="Reset staff profiles"
              tone="error"
              onClick={run(props.onClearStaff)}
            />

            <div className="my-1 border-t border-border/70" />

            <div className="px-2.5 pb-1.5 pt-1">
              <p className="pb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-foreground-muted">
                Appearance
              </p>
              <div className="flex items-center gap-1 rounded-lg bg-secondary/60 p-0.5">
                {THEMES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    aria-pressed={theme === value}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-[11.5px] font-medium transition-colors",
                      theme === value
                        ? "bg-surface text-foreground shadow-xs"
                        : "text-foreground-tertiary hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

```

### src/components/layout/ExportDialog.tsx

```tsx
import { Calendar, FileSpreadsheet, Printer, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { exportScheduleToExcel } from "@/lib/excelUtils";
import { generateProviderICal } from "@/lib/icalUtils";
import { useScheduleStore } from "@/store";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Replaces the old nested export dropdown: one sheet holding every way the
 * schedule leaves the app — workbook, print/PDF, and per-clinician calendars.
 */
export function ExportDialog({ isOpen, onClose }: ExportDialogProps) {
  const { providers, slots, showToast } = useScheduleStore(
    useShallow((s) => ({ providers: s.providers, slots: s.slots, showToast: s.showToast })),
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleExcelExport = async () => {
    onClose();
    try {
      const result = await exportScheduleToExcel();
      if (result.success) {
        showToast({
          type: "success",
          title: "Export complete",
          message: "Downloaded the institutional schedule workbook (NICU_Schedule.xlsx).",
        });
      } else {
        showToast({
          type: "error",
          title: "Export failed",
          message: result.error?.message || "Failed to generate the Excel workbook.",
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Export failed",
        message: "An unexpected error occurred while generating the Excel file.",
      });
    }
  };

  const handlePersonalExport = (providerId: string) => {
    const provider = providers.find((entry) => entry.id === providerId);
    if (!provider) return;
    const result = generateProviderICal(provider, slots);
    if (!result.ok) {
      showToast({ type: "info", title: "Nothing to export", message: result.error });
    } else {
      showToast({
        type: "success",
        title: "Calendar exported",
        message: `Downloaded the iCal file for ${provider.name}.`,
      });
    }
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <h2 id="export-dialog-title" className="text-xl font-semibold tracking-tight">Export schedule</h2>
          <button
            type="button"
            onClick={onClose}
            ref={closeButtonRef}
            aria-label="Close export"
            className="flex h-11 w-11 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-2">
          <button
            type="button"
            onClick={handleExcelExport}
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-secondary/70"
          >
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-foreground-muted" strokeWidth={1.8} />
            <span className="min-w-0">
              <span className="block text-sm font-medium">Excel workbook</span>
              <span className="block text-sm text-foreground-muted">Every service and date. Edit in Excel, then import.</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              window.print();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-secondary/70"
          >
            <Printer className="h-4 w-4 shrink-0 text-foreground-muted" strokeWidth={1.8} />
            <span className="min-w-0">
              <span className="block text-[13.5px] font-medium">Print or save as PDF</span>
              <span className="block text-xs text-foreground-muted">Uses the print layout</span>
            </span>
          </button>
        </div>

        <div className="border-t border-border/70 p-2">
          <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-foreground-muted">
            Personal calendar (.ics)
          </p>
          <div className="max-h-56 overflow-auto">
            {providers.length > 0 ? (
              providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => handlePersonalExport(provider.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-secondary/70"
                >
                  <span className="truncate text-[13px] font-medium">{provider.name}</span>
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
                </button>
              ))
            ) : (
              <p className="px-2.5 py-1.5 text-xs text-foreground-muted">
                Add clinicians to unlock personal calendar exports.
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

```

### src/components/layout/LoadingFallback.tsx

```tsx
import { motion } from 'framer-motion';

/**
 * Loading state for Suspense boundaries when switching views.
 * Keeps layout shift minimal and matches the app design system.
 * Respects prefers-reduced-motion for accessibility.
 */
export function LoadingFallback() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="satin-panel p-8 rounded-2xl border border-slate-200/50 min-h-[320px] flex flex-col gap-6 motion-reduce:animate-none"
      aria-busy="true"
      aria-label="Loading view"
    >
      <div className="flex items-center gap-3">
        <div className="h-4 w-32 rounded-lg bg-slate-200/80 animate-pulse motion-reduce:animate-none" />
        <div className="h-4 w-24 rounded-lg bg-slate-100 animate-pulse motion-reduce:animate-none" style={{ animationDelay: '0.1s' }} />
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-slate-100/80 animate-pulse motion-reduce:animate-none"
            style={{ animationDelay: `${i * 0.05}s` }}
          />
        ))}
      </div>
      <div className="flex gap-2 justify-end">
        <div className="h-9 w-20 rounded-lg bg-slate-200/60 animate-pulse motion-reduce:animate-none" />
        <div className="h-9 w-24 rounded-lg bg-slate-200/60 animate-pulse motion-reduce:animate-none" style={{ animationDelay: '0.15s' }} />
      </div>
    </motion.div>
  );
}

```

### src/components/layout/ErrorBoundary.tsx

```tsx
import React, { type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Copy, Check, RefreshCw } from 'lucide-react';
import { ApiError, buildClientErrorReport, buildIncidentId, formatReportForClipboard, peekLastApiError } from '@/lib/errors';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  incidentId: string | null;
  copyDone: boolean;
}

/**
 * Catches React errors in the tree and renders a fallback UI instead of crashing.
 * Aligns with Next.js-style error boundaries for route segments.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, incidentId: null, copyDone: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error, incidentId: buildIncidentId(), copyDone: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    const { incidentId } = this.state;
    void import('@/lib/sentry')
      .then((m) => {
        m.captureError(error, {
          incidentId,
          reactComponentStack: errorInfo.componentStack,
        });
      })
      .catch(() => {});
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, incidentId: null, copyDone: false });
  };

  handleCopyDebugReport = async (): Promise<void> => {
    const { error, incidentId } = this.state;
    if (!error || !incidentId) {
      return;
    }
    const lastApi = peekLastApiError();
    const report = buildClientErrorReport({
      incidentId,
      error,
      apiError: lastApi instanceof ApiError ? lastApi : error instanceof ApiError ? error : null,
    });
    const text = formatReportForClipboard(report);
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copyDone: true });
      window.setTimeout(() => this.setState({ copyDone: false }), 2500);
    } catch {
      console.error('Could not copy debug report to clipboard');
    }
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          className="satin-panel border-rose-200/60 bg-rose-50/30 p-8 rounded-2xl flex flex-col items-center justify-center gap-6 min-h-[280px] text-center"
          role="alert"
          aria-live="assertive"
        >
          <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center border border-rose-200/60">
            <AlertTriangle className="w-7 h-7 text-rose-600" aria-hidden />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
            <p className="text-sm text-slate-600 max-w-md">
              This view encountered an error. You can try again or switch to another section.
            </p>
            {this.state.error && (
              <div className="mt-3 space-y-2 text-left w-full max-w-md">
                {this.state.incidentId && (
                  <p className="text-xs text-slate-500 font-mono break-all">
                    Incident: {this.state.incidentId}
                  </p>
                )}
                {import.meta.env.DEV && (
                  <pre className="text-xs text-rose-700 bg-rose-100/50 p-3 rounded-lg overflow-auto max-h-28">
                    {this.state.error.message}
                  </pre>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleCopyDebugReport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 transition-colors"
              aria-label="Copy debug report for troubleshooting"
            >
              {this.state.copyDone ? (
                <Check className="w-4 h-4 text-emerald-600" aria-hidden />
              ) : (
                <Copy className="w-4 h-4" aria-hidden />
              )}
              {this.state.copyDone ? 'Copied' : 'Copy debug report'}
            </button>
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

```

### src/components/layout/navigation.ts

```ts
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Bell,
  CalendarDays,
  FlaskConical,
  Inbox,
  LayoutTemplate,
  Palmtree,
  Scale,
  Sliders,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type ViewMode =
  | "schedule"
  | "shift-requests"
  | "analytics"
  | "rules"
  | "strategy"
  | "swaps"
  | "holidays"
  | "conflicts"
  | "notifications"
  | "predictive"
  | "templates"
  | "ai-test"
  | "smarthub";

export type BadgeTone = "neutral" | "warning" | "error";

export interface NavItem {
  value: ViewMode;
  /** Rail label — short enough to never wrap at 232px. */
  label: string;
  icon: LucideIcon;
  badgeKey?: "conflicts" | "alerts";
  badgeTone?: BadgeTone;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

/**
 * One flat, persistent rail replaces the old hub-bar + sub-chip pair. Every
 * view stays one click away; the sections exist to group, not to gate.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: "plan",
    label: "Workspace",
    items: [
      { value: "schedule", label: "Schedule", icon: CalendarDays },
      { value: "shift-requests", label: "Requests", icon: Inbox },
      { value: "templates", label: "Templates", icon: LayoutTemplate },
      { value: "swaps", label: "Swaps", icon: ArrowLeftRight },
      { value: "holidays", label: "Holidays", icon: Palmtree },
    ],
  },
  {
    id: "govern",
    label: "Planning",
    items: [
      { value: "rules", label: "Rules", icon: Scale },
      { value: "strategy", label: "Solver", icon: Sliders },
      { value: "conflicts", label: "Conflicts", icon: AlertTriangle, badgeKey: "conflicts", badgeTone: "error" },
    ],
  },
  {
    id: "insight",
    label: "Insights",
    items: [
      { value: "analytics", label: "Analytics", icon: BarChart3 },
      { value: "predictive", label: "Forecast", icon: Sparkles },
      { value: "notifications", label: "Alerts", icon: Bell, badgeKey: "alerts", badgeTone: "warning" },
      { value: "smarthub", label: "SmartHub", icon: Activity },
    ],
  },
  {
    id: "labs",
    label: "Labs",
    items: [{ value: "ai-test", label: "AI test lab", icon: FlaskConical }],
  },
];

/** Page title + one-line orientation, shown in the top bar and document title. */
export const VIEW_META: Record<ViewMode, { title: string; hint: string }> = {
  schedule: { title: "Schedule", hint: "Assign, swap and fill the planning window" },
  "shift-requests": { title: "Requests", hint: "Time off, swaps and availability waiting on you" },
  templates: { title: "Templates", hint: "Reusable staffing patterns" },
  swaps: { title: "Swaps", hint: "Shift exchanges between clinicians" },
  holidays: { title: "Holidays", hint: "Holiday load, spread across the team" },
  rules: { title: "Rules", hint: "Constraints the scheduler must respect" },
  strategy: { title: "Solver", hint: "How the optimizer weighs competing goals" },
  conflicts: { title: "Conflicts", hint: "Rule breaches and double-bookings" },
  analytics: { title: "Analytics", hint: "Coverage, workload and equity over time" },
  predictive: { title: "Forecast", hint: "Projected demand and staffing risk" },
  notifications: { title: "Alerts", hint: "Anomalies and notices from the last runs" },
  smarthub: { title: "SmartHub", hint: "Cross-service operational picture" },
  "ai-test": { title: "AI test lab", hint: "Exercise the scheduling agents directly" },
};

export function findSectionFor(view: ViewMode): NavSection {
  return NAV_SECTIONS.find((section) => section.items.some((item) => item.value === view)) ?? NAV_SECTIONS[0];
}

```

### src/components/layout/index.ts

```ts
export { ErrorBoundary } from './ErrorBoundary';
export { LoadingFallback } from './LoadingFallback';
export { ViewContent } from './ViewContent';
export { AppShell } from './AppShell';
export { SidebarNav } from './SidebarNav';
export { TopBar, type SaveStatus } from './TopBar';
export { WorkspaceMenu } from './WorkspaceMenu';
export { ExportDialog } from './ExportDialog';
export { NAV_SECTIONS, VIEW_META, findSectionFor, type ViewMode } from './navigation';

```
