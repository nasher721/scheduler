# Calendar + Import Upgrade Notes

## What changed
- Added a dry-run import pipeline with explicit preview, grouped issue reporting, and manual column mapping fallback.
- Added safer import apply + rollback mechanics so operators can revert the most recent import in one click.
- Enhanced month experience with a daily coverage/risk summary rail, explicit selected-day state, keyboard arrow navigation between days, and a right-side quick-peek panel.
- Improved shift card clarity with stronger unassigned-critical labeling and clearer assignment hierarchy.

## Why
- Operators need deterministic import behavior under pressure; dry-run and mapping prevent accidental bad writes.
- Daily summary and risk badges provide immediate staffing posture at a glance, with text/icon support beyond color.
- Quick peek reduces route thrashing and keeps scheduling decisions in context.

## Known limitations
- Mapping re-validation currently requires the same file to remain selected in the file input.
- The calendar body still relies on `react-lightweight-calendar`, so deeper per-cell rendering is constrained by that library API.
- Import preview table is capped to the first 30 rows for readability.

## Next steps
- Persist import mapping presets by source file signature.
- Add server-side import validation parity and immutable import audit records.
- Add explicit week/day calendar modes with shared day-summary model.
