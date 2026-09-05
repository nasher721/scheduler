# Neuro ICU scheduling workspace upgrade

Implemented locally on September 4, 2026. Excel support is workbook import/export, as requested.

## What staff can do

- Read and edit a service-by-day weekly calendar, browse a monthly overview and open the complete day roster, or switch to Agenda and Table. Existing Day cards, Workload bars and Timeline remain available.
- Jump to an exact date, navigate months correctly, combine physician and shift filters, and find open assignments or conflicts.
- Select an assignment with a mouse or keyboard, assign a physician, reload with the edit preserved, and undo it.
- Import Excel with a mapping and validation preview, cancel before applying, and roll back the last import. Partial workbooks preserve other dates and unmapped services. Export includes AMET, NMET, recovery, shared assignments and time off.
- Reuse existing physician records when imported names omit titles; ambiguous normalized names stop the import.
- Use a responsive staff portal with personal calendar, next shift, day roster, requests and swaps. Mobile workspace navigation and key dialogs support Escape and focus restoration.
- Distinguish a local device save from a cloud save.
- Clear filters without moving the planning dates, and measure staffing coverage without vacation placeholders.

## Changed files and simplification

| Area | Main files |
| --- | --- |
| Workspace and visual system | `src/App.tsx`, `src/index.css`, `src/components/layout/{AppShell,SidebarNav,TopBar,WorkspaceMenu,navigation}.tsx` (navigation is `.ts`) |
| Calendar | `src/components/EnhancedCalendar.tsx`, `src/components/schedule/{WeekSchedule,MonthSchedule,ScheduleToolbar,useScheduleViewport,scheduleViewportUtils}.*`, `src/components/ShiftEditModal.tsx` |
| Coverage and filter state | `src/components/schedule/AdminReadinessBanner.tsx`, `src/components/schedule/useScheduleReadiness.ts`, `src/lib/scheduleRisk.ts`, `src/store.ts` |
| Workbook exchange | `src/lib/{excelUtils,excelWorker}.ts`, `src/components/schedule/ImportPreviewDialog.tsx`, `src/components/layout/ExportDialog.tsx` |
| Physician entry and portal | `src/components/{LandingPage,Login}.tsx`, `src/components/attending/{AttendingPortal,MyMonthCalendar,SwapProposalModal,TimeOffModal}.tsx` |
| Regression checks | `e2e/physician-scheduling.spec.ts`, `playwright.scheduler.config.ts`, `src/lib/excelUtils.validation.test.ts`, `src/components/schedule/scheduleViewportUtils.test.ts`, `src/__tests__/components/{schedulingWorkspace,attendingPortal}.test.tsx` |

Replaced the lengthy technical readiness checklist with one coverage band; removed obsolete calendar implementations and duplicated controls; extracted the import preview into its own dialog; replaced fabricated landing-page clinical content with the actual scheduling workflow. Reused existing dependencies and store actions. Unrelated workspace modifications were preserved.

## Verification

- `pnpm build`: passed TypeScript project build and Vite production bundle.
- `pnpm typecheck`: passed.
- `pnpm lint`: zero errors, 203 repository warnings. Focused lint on the final Excel and browser-test changes passed without output.
- `pnpm test`: 26 files, **175 tests passed**. Overall reported line coverage is 11.02%; this is not comprehensive application coverage. The final formula/text safeguards also passed the nine focused Excel regression tests.
- `pnpm exec playwright test --config playwright.scheduler.config.ts`: **3 Chromium scenarios passed**, exercising view changes, exact month navigation, month roster selection, filters, keyboard editing, assignment persistence/undo, real XLSX download and reimport, cancellation/application/rollback, mobile overflow and drawer focus restoration.
- `git diff --check`: passed.
- Visual comparison: desktop 1536×1024 and mobile 390×844 reviewed against `scheduler-concept.png`; internal verdict 93/100. Actual roster data and additional working controls intentionally differ from the illustrative reference.

Browser scenarios use synthetic physician data in isolated browser storage, mock local API traffic and block Supabase. No live roster was used for these checks. The screenshot-only development annotation widget is excluded from the saved images.

## Remaining limits

This is a local implementation, not a production release. Existing authentication/demo access and backend/cloud configuration were preserved; institutional authentication, authorization, multi-user cloud behavior and deployment still require separate verification before operational use. Workbook exchange does not provide live Microsoft 365 synchronization. The existing FTE summary policy, particularly credit for shared shifts and conversion of shifts to weeks, needs reconciliation against the department's official workbook before using its totals for staffing decisions; this change preserves shared names in the schedule worksheet. Keyboard and responsive checks do not constitute a screen-reader or formal WCAG audit. This verification used Chromium, not a full cross-browser matrix.

## Screenshots

Desktop: `scheduler-desktop.png`. Mobile: `scheduler-mobile.png`. Both use clearly synthetic test physicians; the ordinary local preview retains its own schedule data.
