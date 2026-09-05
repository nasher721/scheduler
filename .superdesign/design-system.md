# Neuro ICU workspace

The product is a physician scheduling application. Prioritize scanning services, dates, names, open coverage, and conflicts.

- Navigation: ink navy `#172c38`, mint active indication, Activity icon with existing Neuro ICU identity.
- Workspace: warm neutral `hsl(45 20% 97%)`, white surfaces, thin warm gray borders.
- Primary: deep teal `hsl(173 57% 26%)`, darkened on hover.
- Typography: DM Sans for all interactive UI and data; Instrument Serif only for the main workspace title.
- Geometry: 224px desktop rail, 64px topbar, 8–12px radii, 44px minimum interactive targets.
- Calendar: white service grid, clear date numerals, shaded weekends, muted teal assigned shifts, violet nights, textual conflict/open indicators.
- Accessibility: named controls, text plus color, visible keyboard focus, reduced-motion support, dark theme overrides, contained horizontal scrolling on small screens.
- Reference data must be fictional. No clinical or live staffing data is included in design drafts.

Authoritative implementation tokens are in `src/styles/workspace.css`.
