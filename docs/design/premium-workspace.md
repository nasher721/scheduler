# Premium scheduling workspace

## Intent
Make the Neuro ICU schedule feel considered and effortless to scan, with a distinctive visual identity and the existing physician scheduling workflows intact.

## Implementation plan
1. Verify current desktop/mobile editing, filtering, calendar views, and Excel import/export behavior using the existing physician-scheduling Playwright suite.
2. Establish a scoped visual system: ink navy navigation, warm off-white workspace, teal actions, fine neutral borders, DM Sans controls, and an Instrument Serif workspace title.
3. Refine shell spacing and navigation states, and turn the live planning-window coverage into an easy-to-read summary with clear actions.
4. Refine the calendar toolbar and service/day grid with muted service colors, weekend shading, and accessible assignment buttons. Preserve all handlers, labels, filters, data boundaries, and secondary views.
5. Review desktop and mobile screenshots, keyboard interaction, dark mode and print behavior; run lint, typecheck, build, focused unit tests and the existing browser regression suite.

## Constraints
No new dependencies. No changes to live schedules or persistence. Preserve unrelated working-tree edits. Use existing fonts and Lucide icons. Keep minimum 44px interactive targets and visible keyboard focus. Color supplements textual service labels.

## Baseline
All three tests in `e2e/physician-scheduling.spec.ts` passed on Chromium before source edits, including workbook round-trip and mobile navigation. Mobbin references are unavailable because the connected account requires a paid plan. Superdesign CLI authentication succeeded.

## Delivered

- Ink navy navigation, warm surfaces, teal actions, an editorial title, restrained card geometry, and explicit light/dark theme tokens.
- Simplified filter presentation, grouped view controls, clearer coverage metrics, compact readable assignments, weekend shading, and service subtitles.
- Preserved scheduling, compound filters, alternate views, workbook import/export and rollback, and shared assignment behavior.
- Fixed Safari mobile-drawer focus restoration and print styles that hid physician assignments because they were buttons.

## Changed application files

- `src/App.tsx`: workspace heading/actions and stylesheet import.
- `src/styles/workspace.css`: scoped design tokens, navigation identity, service colors, dark theme and print handling.
- `src/components/layout/AppShell.tsx`, `SidebarNav.tsx`, `TopBar.tsx`: shell, navigation, search styling and Safari focus restoration.
- `src/components/schedule/AdminReadinessBanner.tsx`: live coverage summary hierarchy.
- `src/components/schedule/ScheduleToolbar.tsx`, `ScheduleWorkspace.tsx`: view/filter grouping and spacing.
- `src/components/schedule/WeekSchedule.tsx`, `MonthSchedule.tsx`: calendar surfaces, dates and assignments.
- `e2e/physician-scheduling.spec.ts`: print regression test.

## Verification

- Chromium and WebKit: all 8 workflow tests pass, covering desktop editing, calendar views, filters, workbook round-trip/import/rollback, mobile drawer keyboard focus, and week/month print visibility.
- Focused unit tests: 13/13 pass across viewport calculations and workbook validation.
- Typecheck and production build pass. Lint has the same 203 pre-existing warnings and zero errors.
- CSS parsing/static transformation and `git diff --check` pass.
- Reviewed stable screenshots at 1440px desktop and 390px mobile, including dark mode, mobile drawer and print. Mobile has no document overflow.

## Design reference and artifacts

[Superdesign canvas](https://superdesign.dev/teams/16c87d50-eab4-4f5d-b642-72d54ce29222/projects/3588a3f5-c4ba-4827-9d1e-6953f77cf65f). Draft: `8918c68e-2c7f-464b-9df8-c9f8e58de306`.

Screenshots are in `docs/design/screenshots/`. Superdesign context and resume metadata are in `.superdesign/`. Screenshots use fictional test fixtures.

## Limits

Implemented and verified locally; no production deployment was requested. Full repository unit suite and Firefox were not run. Existing Google Fonts loading is retained, with local fallback fonts. Unrelated pre-existing changes in `.cursor/hooks/state/continual-learning.json` and `data/shared-memory.json` were preserved.
