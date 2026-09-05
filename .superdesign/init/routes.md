# Routes and views

The app is a single Vite entry point (`src/main.tsx` → `src/App.tsx`) and does not use React Router or file-based routing. Navigation is stateful: `viewMode` is a `ViewMode` union selected by `SidebarNav`; login/admin shortcuts use URL hashes.

## Entry and access states

| URL / hash | Entry | Layout | Behavior |
|---|---|---|---|
| `/` | `src/App.tsx` | `LandingPage` or `Login` | Unauthenticated landing; login form follows. |
| `/#register` | `src/components/Login.tsx` | Auth shell | Provider registration view. |
| `/#admin` | `src/App.tsx` | `AppShell` after auto-login | Development/admin shortcut. |
| `/#admin-login` | `src/components/Login.tsx` | Auth shell | Administrative login. |
| authenticated clinician | `src/components/ProviderDashboard.tsx` → `AttendingPortal` | Clinician portal | Personal calendar, upcoming shifts, time off, swaps. |
| authenticated admin/scheduler | `src/App.tsx` | `AppShell` + `TopBar` + `SidebarNav` | Workspace views below. |

## Workspace views

`src/components/layout/navigation.ts` defines the complete `ViewMode` map and `VIEW_META`; `src/components/layout/ViewContent.tsx` dispatches these components:

| ViewMode | Title | Component | Key purpose |
|---|---|---|---|
| `schedule` | Schedule | `src/components/schedule/ScheduleWorkspace.tsx` | Calendar or Excel grid staffing window. |
| `shift-requests` | Requests | `src/components/ShiftRequestBoard.tsx` | Time-off and swap request inbox. |
| `analytics` | Analytics | `src/components/AnalyticsDashboard.tsx` | Coverage and workload metrics. |
| `rules` | Rules | `src/components/RuleBuilder.tsx` | Scheduler constraints. |
| `strategy` | Solver | `src/components/SchedulingStrategyWorkbench.tsx` | Optimizer weighting. |
| `swaps` | Swaps | `src/components/SwapManager.tsx` | Clinician shift exchange management. |
| `holidays` | Holidays | `src/components/HolidayTracker.tsx` | Holiday distribution. |
| `conflicts` | Conflicts | `src/components/ConflictDashboard.tsx` | Unresolved rule breaches. |
| `notifications` | Alerts | `src/components/NotificationCenter.tsx` | Alerts and anomaly history. |
| `predictive` | Forecast | `src/components/PredictiveInsights.tsx` | Demand and staffing risk. |
| `templates` | Templates | `src/components/ScheduleTemplates.tsx` | Reusable staffing patterns. |
| `smarthub` | SmartHub | `src/components/SmartHub.tsx` | Cross-service operational picture. |
| `ai-test` | AI test lab | `src/components/AITestPanel.tsx` | Scheduling agent exercises. |

Full router-equivalent dispatch source is `src/components/layout/ViewContent.tsx`; no separate router config exists.
