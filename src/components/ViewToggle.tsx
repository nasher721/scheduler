import { useMemo } from "react";
import {
  CalendarDays,
  Inbox,
  LayoutTemplate,
  ArrowLeftRight,
  Palmtree,
  Scale,
  Sliders,
  FlaskConical,
  BarChart3,
  AlertTriangle,
  Bell,
  Sparkles,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useScheduleStore } from "@/store";

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

export type NavHubId = "workspace" | "exchange" | "governance" | "intelligence";

interface ViewItem {
  value: ViewMode;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  badgeCount?: (state: any) => number;
}

interface NavHub {
  id: NavHubId;
  label: string;
  icon: LucideIcon;
  views: ViewItem[];
}

export const NAV_HUBS: NavHub[] = [
  {
    id: "workspace",
    label: "Workspace",
    icon: CalendarDays,
    views: [
      { value: "schedule", label: "Schedule Grid", shortLabel: "Schedule", icon: CalendarDays },
      { value: "shift-requests", label: "Shift Requests", shortLabel: "Requests", icon: Inbox },
      { value: "templates", label: "Templates", shortLabel: "Templates", icon: LayoutTemplate },
    ],
  },
  {
    id: "exchange",
    label: "Exchange",
    icon: ArrowLeftRight,
    views: [
      { value: "swaps", label: "Shift Swaps", shortLabel: "Swaps", icon: ArrowLeftRight },
      { value: "holidays", label: "Holiday Equity", shortLabel: "Holidays", icon: Palmtree },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    icon: Scale,
    views: [
      { value: "rules", label: "Rules & Policy", shortLabel: "Rules", icon: Scale },
      { value: "strategy", label: "Solver Strategy", shortLabel: "Strategy", icon: Sliders },
      { value: "ai-test", label: "AI Test Lab", shortLabel: "AI Lab", icon: FlaskConical },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    icon: BarChart3,
    views: [
      { value: "analytics", label: "Analytics", shortLabel: "Analytics", icon: BarChart3 },
      { value: "conflicts", label: "Conflicts", shortLabel: "Conflicts", icon: AlertTriangle },
      { value: "notifications", label: "Alerts", shortLabel: "Alerts", icon: Bell },
      { value: "predictive", label: "Predictive ML", shortLabel: "ML Forecast", icon: Sparkles },
      { value: "smarthub", label: "SmartHub", shortLabel: "SmartHub", icon: Activity },
    ],
  },
];

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  // Find which hub owns the current view
  const currentHub = useMemo(() => {
    for (const hub of NAV_HUBS) {
      if (hub.views.some((v) => v.value === view)) {
        return hub;
      }
    }
    return NAV_HUBS[0];
  }, [view]);

  // Read alert & conflict counts for notification badges
  const conflictCount = useScheduleStore((s) => s.customRules?.length || 0);

  const handleHubSelect = (hub: NavHub) => {
    // If current view is not in this hub, switch to the first view in this hub
    if (!hub.views.some((v) => v.value === view)) {
      onChange(hub.views[0].value);
    }
  };

  return (
    <nav className="flex w-full flex-col gap-2.5" aria-label="Main Navigation">
      {/* Primary 4-Hub Segmented Bar */}
      <div className="flex w-full items-center justify-between gap-1 rounded-xl border border-border/80 bg-secondary/40 p-1 backdrop-blur-md overflow-x-auto scrollbar-hide">
        <div className="flex w-full min-w-max items-center gap-1 sm:w-auto">
          {NAV_HUBS.map((hub) => {
            const isHubActive = hub.id === currentHub.id;
            const HubIcon = hub.icon;
            return (
              <button
                key={hub.id}
                type="button"
                onClick={() => handleHubSelect(hub)}
                className={cn(
                  "relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold tracking-tight transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20",
                  isHubActive
                    ? "bg-surface text-foreground shadow-sm border border-border/70"
                    : "text-foreground-muted hover:text-foreground hover:bg-surface/50"
                )}
                aria-current={isHubActive ? "true" : undefined}
              >
                <HubIcon className={cn("h-3.5 w-3.5 shrink-0", isHubActive ? "text-primary" : "text-foreground-muted")} />
                <span>{hub.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-view Chips within Active Hub */}
      <div className="flex w-full min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
        <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted/70 mr-1 hidden md:inline">
          {currentHub.label}:
        </span>
        {currentHub.views.map((v) => {
          const isActive = v.value === view;
          const ViewIcon = v.icon;
          return (
            <button
              key={v.value}
              type="button"
              onClick={() => onChange(v.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 shrink-0",
                isActive
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-surface/70 border border-border/60 text-foreground hover:bg-secondary hover:border-border text-foreground-secondary"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <ViewIcon className="h-3 w-3 shrink-0" />
              <span>{v.label}</span>
              {v.value === "conflicts" && conflictCount > 0 && (
                <span className={cn(
                  "ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                  isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-warning/20 text-warning"
                )}>
                  {conflictCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
