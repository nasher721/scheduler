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
