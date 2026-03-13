# feat: UI redesign — simplicity + mind-blowing professional

## Overview

Redesign the Neuro ICU Staffing UI so it **stands out for simplicity** while **keeping all functionality**. The result should feel **professional yet mind-blowing**: calm, confident, and memorable with one or two striking differentiators.

## Design direction

- **Tone**: Refined minimalism with one bold signature. Not maximalist — fewer panels, less uppercase/tracking overload, clearer hierarchy.
- **Differentiator**: One unforgettable touch: e.g. a striking typographic hero, a single confident accent (deep indigo or warm stone), or a subtle but distinctive motion (staggered reveal, focus glow).
- **Constraints**: Preserve every feature (import, undo/redo, auto-fill, AI optimize, scenarios, view tabs, ProviderManager, all view modes). No removal of functionality.
- **Tech**: Existing stack (React, Tailwind, Framer Motion, CSS variables). No new dependencies.

## Phases

### Phase 1: Design system & shell

- **Tokens**: Simplify palette to one dominant neutral (warm stone or cool slate), one primary accent, and semantic colors. Reduce variable count where redundant.
- **Typography**: One display font (serif or geometric) for hero/headlines; one body font. Reduce uppercase/tracking overload; use weight and size for hierarchy.
- **Shell**: Single clear content area; reduce `gap-10`/padding sprawl; define a consistent max-width and breathing room.
- **Files**: `src/index.css`, `index.html` (font preload if needed), `tailwind.config.js` (if extending).

### Phase 2: Header, toolbar, situational awareness, ViewToggle

- **Header**: One concise branding line (e.g. "Neuro ICU Staffing") with optional short tagline. Remove visual clutter (decorative line, long copy).
- **Toolbar**: Group actions into clear segments (history, import, primary actions, status, AI). Single row where possible; icon-only with tooltips for secondary actions. Autosave chip and connection status subtle.
- **Situational awareness**: One compact strip: coverage %, allocation, deployment/horizon, connection. Optional: single “risk” summary (critical gaps + skill risk) instead of two separate cards.
- **Scenarios**: Keep horizontal scroll; simplify chip styling to match design system.
- **Alerts**: One alert strip; same info, less visual weight.
- **ViewToggle**: Tabs for Schedule + Shift Requests; one dropdown or pill group for Operations; one for Insights. Cleaner nav-chip style.
- **Files**: `src/App.tsx`, `src/components/ViewToggle.tsx`, `src/index.css` (component classes).

### Phase 3: Content panels and components

- **ProviderManager**: Apply design-system cards and inputs; consistent radius and shadow; compact but readable.
- **ViewContent**: Navigation panel (satin/stone) and content area with consistent padding; ensure LoadingFallback and view switches feel cohesive.
- **Modals**: Import preview and other overlays — same radius, shadow, and spacing as design system.
- **Files**: `src/components/ProviderManager.tsx`, `src/components/layout/ViewContent.tsx`, `src/App.tsx` (import modal), `src/index.css`.

### Phase 4: Polish

- **Motion**: Staggered reveal on load (header → awareness → content); subtle hover on interactive elements; respect `prefers-reduced-motion`.
- **Focus**: Visible focus rings using `--ring`; no focus traps.
- **Print**: Ensure print styles still hide controls and show schedule clearly.
- **Files**: `src/index.css`, `src/styles/PrintStyles.css`, `src/App.tsx` (motion props).

## Acceptance criteria

- [ ] All existing features remain available (import, undo/redo, auto-fill, AI optimize, save, scenarios, all view modes, ProviderManager, alerts).
- [ ] Visual hierarchy is clear: hero/title → toolbar → awareness → main content.
- [ ] Typography and colors are cohesive and professional; one memorable differentiator (e.g. typography or accent).
- [ ] Layout is simpler: fewer competing panels and borders; consistent spacing and radius.
- [ ] Motion is purposeful and optional (reduced-motion respected).
- [ ] Print and a11y (focus, labels) unchanged or improved.

## MVP / key files

| File | Purpose |
|------|--------|
| `src/index.css` | Design tokens, base styles, component classes |
| `src/App.tsx` | Shell, header, toolbar, awareness, scenarios, alerts, import modal |
| `src/components/ViewToggle.tsx` | Tabs + Operations/Insights |
| `src/components/ProviderManager.tsx` | Sidebar provider list and forms |
| `src/components/layout/ViewContent.tsx` | Wrapper and nav panel styling |

## References

- Current design: Apple-inspired clinical luxury (Instrument Serif, Public Sans, satin/stone panels) in `src/index.css` and `src/App.tsx`.
- Frontend skill: distinctive, production-grade UI; avoid generic AI aesthetics; match complexity to vision.
