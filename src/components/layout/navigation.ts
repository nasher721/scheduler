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
