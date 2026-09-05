# Extractable DraftComponent candidates

## AppShell
- Source: `src/components/layout/AppShell.tsx`
- Category: layout
- Description: Responsive shell with persistent desktop rail, mobile drawer, top bar slot, and main content.
- Extractable props: `view`, `onViewChange`, `isSidebarOpen`, `onSidebarOpenChange`.
- Hardcoded: skip link text, drawer labels, rail width, responsive classes, animation settings.

## SidebarNav
- Source: `src/components/layout/SidebarNav.tsx`
- Category: layout
- Description: Neuro ICU workspace rail with grouped navigation, live badges, and user identity footer.
- Extractable props: `view`, `onChange`, `onNavigate`.
- Hardcoded: Neuro ICU/Cleveland Clinic branding, section labels, icon assignments, spacing/classes.

## TopBar
- Source: `src/components/layout/TopBar.tsx`
- Category: layout
- Description: Sticky context bar with search, mobile navigation, action slot, and persistence status.
- Extractable props: `title`, `hint`, `saveStatus`, `isOnline`, `onOpenSearch`, `onOpenSidebar`, `actions`.
- Hardcoded: Neurocritical care breadcrumb, search placeholder, ⌘K hint, status labels.

## ViewContent
- Source: `src/components/layout/ViewContent.tsx`
- Category: layout
- Description: Lazy-loaded animated view switcher for all scheduler workspaces.
- Extractable props: `viewMode`.
- Hardcoded: view registry, animation timing, loading fallback.

## ScheduleWorkspace
- Source: `src/components/schedule/ScheduleWorkspace.tsx`
- Category: layout
- Description: Schedule surface with toolbar and animated calendar/table switch.
- Extractable props: none; store-backed schedule surface state.
- Hardcoded: Alt+1/2 and Alt+Arrow keyboard shortcuts, animation values.

## ThemeToggle
- Source: `src/components/ThemeToggle.tsx`
- Category: basic
- Description: Theme switcher supporting icon, button, and dropdown presentations.
- Extractable props: `variant`, `className`.
- Hardcoded: Light/Dark/System labels, icons, slate styling.

## ToastContainer
- Source: `src/components/Toast.tsx`
- Category: basic
- Description: Store-backed animated success/error/warning/info notifications.
- Extractable props: none; reads global toast state.
- Hardcoded: icon map, semantic color classes, placement and spring animation.

## Skeleton
- Source: `src/components/Skeleton.tsx`
- Category: basic
- Description: Theme-aware loading primitive and schedule/provider/stat skeleton compositions.
- Extractable props: `className`, `variant`, `width`, `height`, `animation` (plus pattern-specific className/lines).
- Hardcoded: slate loading colors, shimmer animation, pattern geometry.

## NotificationBanner
- Source: `src/components/NotificationBanner.tsx`
- Category: basic
- Description: Compact schedule risk summary for critical gaps, skill risks, and fatigue exposure.
- Extractable props: `criticalGaps`, `skillRisks`, `fatigueExposures`, `onViewDetails`.
- Hardcoded: alert copy, warning palette, icon treatment.
