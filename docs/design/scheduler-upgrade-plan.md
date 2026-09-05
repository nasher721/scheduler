# Physician scheduling upgrade

## Outcome and scope
Build a clear, responsive Cleveland Clinic Neuro ICU scheduling workspace from the existing application. Preserve assignment rules, history, staff profiles and calendar views. Excel means workbook import/export, as confirmed by the user; live Microsoft 365 synchronization is outside this change. No new dependencies or production deployment.

## Design contract
Reference: `scheduler-concept.png`. White surfaces, very pale cool background, navy text, clinical blue primary (#0067a5), lilac night assignments. DM Sans/system sans typography, nonitalic headings, 14px control text, 44px main touch targets, fine borders and restrained 8px corners. Existing Lucide icons. No raster UI or generated fictional production data.

Opening content: sidebar Neuro ICU / Cleveland Clinic; existing navigation destinations grouped as Workspace, Planning, Insights; top bar Neurocritical care / Schedule, search, staff and secondary actions. Main heading “Coverage, clearly.”; subtitle “Your team. Every service. One shared schedule.”; Import Excel and Export schedule actions. One coverage band derived from actual schedule data. Week/Month/Agenda/Table, additional existing layouts, date navigation, physician/shift/open/conflict filters, editable calendar.

Desktop: full-width calendar with optional staff rail. Tablet: navigation drawer. Mobile: stacked heading/actions, wrapping toolbar, contained horizontal week grid and readable agenda option. Staff portal keeps next shift, personal calendar, department day roster, time off and swaps.

Dynamic dates, names, services, coverage values and empty states follow actual data. Additional service rows and existing scheduling tools are functional extensions to the illustrative reference. The staff portal and import/export dialogs extend the same visual system.

## Implementation / simplification plan
1. Establish regression baseline for existing schedule metrics, portal helpers, workbook validation and viewport behavior.
2. Replace the duplicated technical QA readiness UI in the physician workspace with a clinical coverage band. Keep risk details accessible through existing alerts.
3. Apply shared color/type tokens, simplify shell navigation, add prominent workbook actions and keyboard-accessible mobile navigation.
4. Improve calendar editing, filter intersection and shared date navigation across layouts, preserving advanced tools.
5. Validate Excel roundtrips and malformed input; keep preview, cancel, rollback and export workflows.
6. Improve responsive physician access, calendar and requests; remove unimplemented claims from entry surfaces.
7. Run lint, TypeScript build, unit tests and browser scenarios; compare desktop/mobile renders to the reference and persist visual verdicts.

## Verification
Baseline metrics/attending helper tests: 17 passing before edits. Focused new tests cover demonstrated bugs, coverage actions and navigation behavior. Browser checks: view switching, month navigation, compound filters, keyboard edit, assignment save and undo, import preview/cancel/apply/rollback, workbook export, mobile navigation and physician portal. Use synthetic local test fixtures and isolate cloud writes during browser tests. Report any pre-existing authentication/cloud-readiness limitations without calling local verification a production release.
