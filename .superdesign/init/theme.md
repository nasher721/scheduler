# Theme context

## Compact token summary

- Fonts: DM Sans body/headings; Instrument Serif available for editorial treatments.
- Light base: background hsl(210 33% 98%), surface hsl(0 0% 100%), foreground hsl(218 62% 17%), primary hsl(203 100% 32%), border hsl(214 20% 86%).
- Dark base: background hsl(220 20% 8%), surface hsl(220 20% 12%), foreground hsl(0 0% 98%), primary hsl(211 100% 55%), border hsl(220 15% 20%).
- Semantic colors: success emerald, warning amber, error red, info cyan-blue; shift colors cover day/night/NMET/jeopardy.
- Radii 6/8/10/12/16px and full; shadows xs through xl plus glass; durations 150/250/350/500ms.
- Breakpoints: mobile max 767px, tablet 768–1023px, desktop min 1024px, persistent rail at xl (1280px).

## Raw source dumps

### tailwind.config.js

```js
/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                "foreground-muted": "hsl(var(--foreground-muted))",
                "foreground-secondary": "hsl(var(--foreground-secondary))",
                "foreground-tertiary": "hsl(var(--foreground-tertiary))",
                surface: "hsl(var(--surface))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                success: "hsl(var(--success))",
                warning: "hsl(var(--warning))",
                error: "hsl(var(--error))",
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
        },
    },
    plugins: [],
}

```

### src/index.css

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap');
@import './styles/responsive.css';
@import './styles/print-schedule.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

/* ============================================
   NEURO ICU — Refined minimal, one bold accent
   Simplicity + professional + memorable
   ============================================ */

@layer base {
  :root {
    /* ========== COLOR — clinical neutral + deep indigo ========== */
    --background: 210 33% 98%;
    --background-secondary: 210 20% 94%;
    --background-tertiary: 210 18% 90%;

    --foreground: 218 62% 17%;
    --foreground-secondary: 219 24% 32%;
    --foreground-tertiary: 219 16% 40%;
    --foreground-muted: 219 12% 44%;

    --surface: 0 0% 100%;
    --surface-elevated: 210 24% 99%;
    --surface-overlay: 210 24% 97%;

    /* One bold accent — deep indigo */
    --primary: 203 100% 32%;
    --primary-hover: 203 100% 26%;
    --primary-foreground: 0 0% 100%;

    --secondary: 214 18% 92%;
    --secondary-foreground: 240 10% 12%;

    --success: 160 84% 39%;
    --success-foreground: 0 0% 100%;
    --success-muted: 160 84% 96%;

    --warning: 38 92% 50%;
    --warning-foreground: 0 0% 100%;
    --warning-muted: 38 92% 96%;

    --error: 0 72% 51%;
    --error-foreground: 0 0% 100%;
    --error-muted: 0 84% 96%;

    --info: 199 89% 48%;
    --info-foreground: 0 0% 100%;
    --info-muted: 199 89% 96%;

    --border: 214 20% 86%;
    --border-strong: 214 14% 72%;
    --input: 214 20% 88%;
    --ring: 203 100% 32%;

    /* ========== SHIFT TYPE COLORS ========== */
    /* Refined medical schedule colors */
    --shift-day: 160 84% 39%;
    /* Emerald #10b981 */
    --shift-day-bg: 160 84% 94%;
    --shift-day-border: 160 84% 70%;

    --shift-night: 217 91% 60%;
    /* Blue #3b82f6 */
    --shift-night-bg: 217 91% 94%;
    --shift-night-border: 217 91% 75%;

    --shift-nmet: 38 92% 50%;
    /* Amber #f59e0b */
    --shift-nmet-bg: 38 92% 94%;
    --shift-nmet-border: 38 92% 70%;

    --shift-jeopardy: 0 84% 60%;
    /* Red #ef4444 */
    --shift-jeopardy-bg: 0 84% 94%;
    --shift-jeopardy-border: 0 84% 75%;

    /* ========== SIZING & SPACING ========== */
    --radius-sm: 0.375rem;
    /* 6px */
    --radius: 0.5rem;
    /* 8px */
    --radius-lg: 0.625rem;
    /* 10px */
    --radius-xl: 0.75rem;
    /* 12px */
    --radius-2xl: 1rem;
    /* 16px */
    --radius-full: 9999px;

    /* ========== SHADOWS ========== */
    --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.03);
    --shadow-sm: 0 2px 8px -2px rgb(0 0 0 / 0.05), 0 1px 3px -1px rgb(0 0 0 / 0.03);
    --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    --shadow-md: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    --shadow-lg: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
    --shadow-xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);
    --shadow-inner: inset 0 2px 4px 0 rgb(0 0 0 / 0.05);
    --shadow-glass: 0 8px 32px -4px rgb(0 0 0 / 0.06), inset 0 1px 0 0 rgb(255 255 255 / 0.4);
    --shadow-glass-hover: 0 12px 40px -4px rgb(0 0 0 / 0.08), inset 0 1px 0 0 rgb(255 255 255 / 0.5);

    /* ========== ANIMATIONS ========== */
    --duration-fast: 150ms;
    --duration-normal: 250ms;
    --duration-slow: 350ms;
    --duration-slower: 500ms;

    --ease-default: cubic-bezier(0.25, 0.1, 0.25, 1);
    --ease-in: cubic-bezier(0.4, 0, 1, 1);
    --ease-out: cubic-bezier(0, 0, 0.2, 1);
    --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);

    /* ========== BLUR VALUES ========== */
    --blur-sm: 8px;
    --blur: 16px;
    --blur-lg: 24px;
    --blur-xl: 40px;
    --blur-2xl: 64px;
  }

  /* ========== DARK MODE ========== */
  .dark {
    --background: 220 20% 8%;
    --background-secondary: 220 20% 10%;
    --background-tertiary: 220 20% 14%;

    --foreground: 0 0% 98%;
    --foreground-secondary: 0 0% 85%;
    --foreground-tertiary: 0 0% 70%;
    --foreground-muted: 220 15% 55%;

    --surface: 220 20% 12%;
    --surface-elevated: 220 20% 16%;
    --surface-overlay: 220 20% 14%;

    --primary: 211 100% 55%;
    --primary-hover: 211 100% 60%;
    --primary-foreground: 0 0% 100%;

    --secondary: 220 15% 18%;
    --secondary-foreground: 0 0% 95%;

    --border: 220 15% 20%;
    --border-strong: 220 15% 28%;
    --input: 220 15% 18%;

    --success-muted: 142 60% 15%;
    --warning-muted: 36 60% 15%;
    --error-muted: 4 60% 15%;
    --info-muted: 211 60% 15%;

    --shift-day-bg: 160 60% 15%;
    --shift-night-bg: 217 60% 15%;
    --shift-nmet-bg: 38 60% 15%;
    --shift-jeopardy-bg: 0 60% 15%;

    --shadow-glass: 0 8px 32px -4px rgb(0 0 0 / 0.25), inset 0 1px 0 0 rgb(255 255 255 / 0.1);
    --shadow-glass-hover: 0 12px 40px -4px rgb(0 0 0 / 0.35), inset 0 1px 0 0 rgb(255 255 255 / 0.15);
  }
}

/* ========== BASE STYLES ========== */
@layer base {
  * {
    @apply border-border;
    -webkit-tap-highlight-color: transparent;
  }

  html {
    scroll-behavior: smooth;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    overflow-x: clip;
  }

  body {
    @apply min-h-screen antialiased;
    min-height: 100dvh;
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-feature-settings: "tnum", "ss01";
    background-color: hsl(var(--background));

    /* Subtle clinical depth without decorative blobs */
    background-image: none;
  }

  :where(button, a, input, select, textarea, summary, [role="button"]):focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 3px;
  }

  button, input, select, textarea {
    font-family: inherit;
  }

  /* Typography — Serif for hero only; weight/size for hierarchy */
  h1,
  h2,
  h3 {
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: hsl(var(--foreground));
    font-style: normal;
  }

  h4,
  h5,
  h6 {
    font-family: 'DM Sans', sans-serif;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: hsl(var(--foreground));
  }

  h1 {
    font-size: 2.5rem;
    line-height: 1.1;
    letter-spacing: -0.03em;
  }

  h2 {
    font-size: 2rem;
    line-height: 1.15;
    letter-spacing: -0.025em;
  }

  h3 {
    font-size: 1.5rem;
    line-height: 1.2;
    letter-spacing: -0.02em;
  }

  h4 {
    font-size: 1.25rem;
    line-height: 1.25;
  }

  h5 {
    font-size: 1.125rem;
    line-height: 1.3;
  }

  h6 {
    font-size: 1rem;
    line-height: 1.4;
  }

  p {
    line-height: 1.6;
    color: hsl(var(--foreground-secondary));
  }

  /* Selection */
  ::selection {
    background-color: hsla(var(--primary), 0.2);
    color: hsl(var(--foreground));
  }

  /* Scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: hsla(var(--foreground), 0.15);
    border-radius: var(--radius-full);
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: hsla(var(--foreground), 0.25);
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  /* Focus styles */
  :focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }
}

@layer components {

  /* Headings inside application chrome — the serif display face is for the
     marketing surfaces, not for a toolbar people read forty times an hour. */
  .ui-heading {
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-style: normal;
    font-weight: 600;
    letter-spacing: -0.015em;
  }

  /* Satin — one flat surface, one hairline border, no elevation.
     Every view inherits this, so it is where the calm comes from. */
  .satin-panel {
    background: hsl(var(--surface));
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius-xl);
    transition: border-color var(--duration-fast) var(--ease-out);
  }

  .satin-panel:hover {
    border-color: hsl(var(--border-strong));
  }

  /* Stone — flat, clear surface */
  .stone-panel {
    background: hsl(var(--surface));
    border: 1px solid hsla(var(--foreground), 0.08);
    box-shadow: 0 1px 3px hsla(var(--foreground), 0.04);
    border-radius: var(--radius-lg);
  }

  .glass-panel,
  .glass-panel-heavy {
    @apply satin-panel;
  }

  .glass-panel-light,
  .glass-panel-solid {
    @apply stone-panel;
  }
}

/* ========== SHIFT BADGES ========== */
@layer components {
  .shift-badge {
    @apply inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full;
    transition: all var(--duration-fast) var(--ease-out);
  }

  .shift-badge-day {
    background: hsl(var(--shift-day-bg));
    color: hsl(var(--shift-day));
    border: 1px solid hsla(var(--shift-day), 0.25);
  }

  .shift-badge-night {
    background: hsl(var(--shift-night-bg));
    color: hsl(var(--shift-night));
    border: 1px solid hsla(var(--shift-night), 0.25);
  }

  .shift-badge-nmet {
    background: hsl(var(--shift-nmet-bg));
    color: hsl(var(--shift-nmet));
    border: 1px solid hsla(var(--shift-nmet), 0.25);
  }

  .shift-badge-jeopardy {
    background: hsl(var(--shift-jeopardy-bg));
    color: hsl(var(--shift-jeopardy));
    border: 1px solid hsla(var(--shift-jeopardy), 0.25);
  }

  /* Shift slot styling */
  .shift-slot {
    @apply relative flex flex-col gap-1 p-3 rounded-xl transition-all;
    background: hsla(var(--surface), 0.6);
    border: 1px solid hsla(var(--border), 0.5);
    min-height: 80px;
  }

  .shift-slot:hover {
    background: hsla(var(--surface), 0.8);
    border-color: hsla(var(--primary), 0.3);
    box-shadow: var(--shadow-sm);
  }

  .shift-slot.dragging-over {
    border-color: hsl(var(--primary));
    background: hsla(var(--primary), 0.05);
    box-shadow: 0 0 0 2px hsla(var(--primary), 0.2);
  }

  .shift-slot-day {
    border-left: 3px solid hsl(var(--shift-day));
  }

  .shift-slot-night {
    border-left: 3px solid hsl(var(--shift-night));
  }

  .shift-slot-nmet {
    border-left: 3px solid hsl(var(--shift-nmet));
  }

  .shift-slot-jeopardy {
    border-left: 3px solid hsl(var(--shift-jeopardy));
  }
}

/* ========== BUTTONS ========== */
@layer components {
  .btn {
    @apply inline-flex items-center justify-center gap-2 font-medium transition-all;
    @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2;
    border-radius: var(--radius-full);
    font-size: 0.875rem;
    font-weight: 500;
    padding: 0.625rem 1.25rem;
    letter-spacing: -0.01em;
  }

  .btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
  }

  .btn-lg {
    padding: 0.75rem 1.75rem;
    font-size: 1rem;
  }

  .btn-primary {
    background: linear-gradient(180deg, hsl(var(--primary)) 0%, hsl(var(--primary-hover)) 100%);
    color: hsl(var(--primary-foreground));
    box-shadow:
      0 1px 3px hsla(var(--primary), 0.3),
      0 1px 2px hsla(var(--foreground), 0.06),
      inset 0 1px 0 hsla(var(--primary-foreground), 0.2);
  }

  .btn-primary:hover {
    background: linear-gradient(180deg, hsl(var(--primary-hover)) 0%, hsl(var(--primary-hover)) 100%);
    box-shadow:
      0 4px 12px hsla(var(--primary), 0.35),
      0 2px 4px hsla(var(--foreground), 0.08),
      inset 0 1px 0 hsla(var(--primary-foreground), 0.25);
    transform: translateY(-1px);
  }

  .btn-primary:active {
    transform: translateY(0);
    box-shadow:
      0 1px 2px hsla(var(--primary), 0.25),
      inset 0 1px 2px hsla(var(--foreground), 0.1);
  }

  .btn-secondary {
    background: hsl(var(--secondary));
    color: hsl(var(--secondary-foreground));
    box-shadow: var(--shadow-xs);
  }

  .btn-secondary:hover {
    background: hsla(var(--foreground), 0.08);
    box-shadow: var(--shadow-sm);
  }

  .btn-ghost {
    background: transparent;
    color: hsl(var(--foreground-secondary));
  }

  .btn-ghost:hover {
    background: hsla(var(--foreground), 0.05);
    color: hsl(var(--foreground));
  }

  .btn-success {
    background: linear-gradient(180deg, hsl(var(--success)) 0%, hsl(var(--success)) 100%);
    color: hsl(var(--success-foreground));
    box-shadow: 0 1px 3px hsla(var(--success), 0.3);
  }

  .btn-danger {
    background: linear-gradient(180deg, hsl(var(--error)) 0%, hsl(var(--error)) 100%);
    color: hsl(var(--error-foreground));
    box-shadow: 0 1px 3px hsla(var(--error), 0.3);
  }

  .btn-icon {
    @apply p-2 aspect-square;
    padding: 0.5rem;
  }
}

/* ========== INPUTS ========== */
@layer components {
  .input-base {
    @apply w-full px-3 py-2 text-sm transition-all;
    background: hsla(var(--surface), 0.8);
    border: 1px solid hsl(var(--input));
    border-radius: var(--radius-lg);
    color: hsl(var(--foreground));
    font-feature-settings: "tnum";
  }

  .input-base:hover {
    border-color: hsla(var(--foreground), 0.15);
  }

  .input-base:focus {
    @apply outline-none;
    border-color: hsl(var(--primary));
    box-shadow: 0 0 0 3px hsla(var(--primary), 0.15);
  }

  .input-base::placeholder {
    color: hsl(var(--foreground-muted));
  }

  .input-number {
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
}

/* ========== CARDS ========== */
@layer components {
  .card {
    @apply p-4 transition-all;
    background: hsla(var(--surface), 0.7);
    border: 1px solid hsla(var(--border), 0.5);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-sm);
  }

  .card:hover {
    box-shadow: var(--shadow-md);
  }

  .card-elevated {
    @apply p-4 transition-all;
    background: hsl(var(--surface));
    border: 1px solid hsla(var(--border), 0.5);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-md);
  }

  .card-elevated:hover {
    box-shadow: var(--shadow-lg);
    transform: translateY(-2px);
  }

  .card-header {
    @apply flex items-center gap-3 mb-4;
  }

  .card-title {
    @apply text-base font-semibold;
    color: hsl(var(--foreground));
  }

  .card-description {
    @apply text-sm;
    color: hsl(var(--foreground-muted));
  }
}

/* ========== BADGES ========== */
@layer components {
  .badge {
    @apply inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold;
    border-radius: var(--radius-full);
    background: hsl(var(--secondary));
    color: hsl(var(--secondary-foreground));
  }

  .badge-primary {
    background: hsla(var(--primary), 0.12);
    color: hsl(var(--primary));
  }

  .badge-success {
    background: hsl(var(--success-muted));
    color: hsl(var(--success));
  }

  .badge-warning {
    background: hsl(var(--warning-muted));
    color: hsl(var(--warning));
  }

  .badge-error {
    background: hsl(var(--error-muted));
    color: hsl(var(--error));
  }
}

/* ========== PROGRESS BARS ========== */
@layer components {
  .progress-bar {
    @apply relative h-2 overflow-hidden rounded-full;
    background: hsla(var(--foreground), 0.08);
  }

  .progress-bar-fill {
    @apply absolute inset-y-0 left-0 rounded-full transition-all;
    transition-duration: var(--duration-slow);
    transition-timing-function: var(--ease-out);
  }

  .progress-bar-fill-primary {
    background: linear-gradient(90deg, hsl(var(--primary)) 0%, hsla(var(--primary), 0.8) 100%);
    box-shadow: 0 0 8px hsla(var(--primary), 0.4);
  }

  .progress-bar-fill-success {
    background: linear-gradient(90deg, hsl(var(--success)) 0%, hsla(var(--success), 0.8) 100%);
    box-shadow: 0 0 8px hsla(var(--success), 0.4);
  }

  .progress-bar-fill-warning {
    background: linear-gradient(90deg, hsl(var(--warning)) 0%, hsla(var(--warning), 0.8) 100%);
    box-shadow: 0 0 8px hsla(var(--warning), 0.4);
  }

  .progress-bar-fill-error {
    background: linear-gradient(90deg, hsl(var(--error)) 0%, hsla(var(--error), 0.8) 100%);
    box-shadow: 0 0 8px hsla(var(--error), 0.4);
  }
}

/* ========== STATS CARDS ========== */
@layer components {
  .stat-card {
    @apply relative overflow-hidden p-4 rounded-2xl transition-all;
    background: hsla(var(--surface), 0.7);
    backdrop-filter: blur(var(--blur));
    -webkit-backdrop-filter: blur(var(--blur));
    border: 1px solid hsla(var(--border), 0.5);
  }

  .stat-card:hover {
    box-shadow: var(--shadow-md);
  }

  .stat-value {
    @apply text-2xl font-bold tracking-tight;
    font-family: "SF Pro Display", "Outfit", -apple-system, BlinkMacSystemFont, sans-serif;
    color: hsl(var(--foreground));
    letter-spacing: -0.03em;
  }

  .stat-label {
    @apply text-xs font-medium uppercase tracking-wider mt-1;
    color: hsl(var(--foreground-muted));
  }

  .stat-icon {
    @apply absolute top-3 right-3 opacity-20;
  }
}

/* ========== TOGGLE ========== */
@layer components {
  .toggle-container {
    @apply inline-flex p-1 gap-1;
    background: hsla(var(--foreground), 0.05);
    border-radius: var(--radius-full);
  }

  .toggle-button {
    @apply relative px-4 py-2 text-sm font-medium transition-colors;
    color: hsl(var(--foreground-muted));
    border-radius: var(--radius-full);
    z-index: 1;
  }

  .toggle-button:hover:not(.active) {
    color: hsl(var(--foreground-secondary));
  }

  .toggle-button.active {
    color: hsl(var(--foreground));
  }

  .toggle-indicator {
    @apply absolute inset-y-1 bg-white rounded-full shadow-sm transition-all;
    box-shadow: var(--shadow-sm);
  }

  /* Nav chips — sentence case, clear active state */
  .nav-chip {
    @apply relative rounded-xl text-sm font-medium transition-all duration-200;
    @apply flex items-center gap-2 px-4 py-2.5;
    color: hsl(var(--foreground-muted));
  }

  .nav-chip:hover {
    color: hsl(var(--foreground));
  }

  .nav-chip:focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }

  .nav-chip-active {
    color: hsl(var(--primary));
    background: hsla(var(--primary), 0.08);
  }

  .soft-control {
    @apply rounded-xl border text-xs transition-all duration-200;
    @apply bg-slate-50 border-slate-300/70 text-slate-800;
  }

  .soft-control:hover {
    @apply border-slate-400/70;
    background: hsla(var(--surface), 0.9);
  }

  .soft-control:focus-visible,
  .soft-control:focus-within {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }

  .soft-icon-btn {
    @apply p-2 rounded-xl transition-all duration-200 border border-transparent;
    @apply text-slate-500;
  }

  .soft-icon-btn:hover {
    @apply text-primary border-slate-300/70;
    background: hsla(var(--primary), 0.06);
    transform: translateY(-0.5px);
  }

  .soft-icon-btn:active {
    transform: translateY(0);
  }

  .soft-icon-btn:focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }

  .command-button {
    @apply inline-flex min-h-[32px] shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-foreground-secondary transition-colors hover:bg-surface hover:text-foreground disabled:cursor-not-allowed;
  }

  .command-icon {
    @apply inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-surface hover:text-primary disabled:cursor-not-allowed disabled:opacity-35;
  }

}

/* ========== ANIMATIONS ========== */
@layer utilities {

  /* Fade animations */
  @keyframes fade-in {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }

  @keyframes fade-out {
    from {
      opacity: 1;
    }

    to {
      opacity: 0;
    }
  }

  /* Slide animations */
  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateY(8px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slide-down {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slide-in-right {
    from {
      opacity: 0;
      transform: translateX(8px);
    }

    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes slide-in-left {
    from {
      opacity: 0;
      transform: translateX(-8px);
    }

    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  /* Scale animations */
  @keyframes scale-in {
    from {
      opacity: 0;
      transform: scale(0.95);
    }

    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes pop-in {
    0% {
      opacity: 0;
      transform: scale(0.8);
    }

    70% {
      transform: scale(1.02);
    }

    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* Shimmer animation */
  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }

    100% {
      background-position: 200% 0;
    }
  }

  /* Pulse animation */
  @keyframes pulse-soft {

    0%,
    100% {
      opacity: 1;
    }

    50% {
      opacity: 0.7;
    }
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%       { transform: translateX(-4px); }
    40%       { transform: translateX(4px); }
    60%       { transform: translateX(-3px); }
    80%       { transform: translateX(3px); }
  }

  /* Animation utility classes */
  .animate-fade-in {
    animation: fade-in var(--duration-normal) var(--ease-out);
  }

  .animate-slide-up {
    animation: slide-up var(--duration-normal) var(--ease-out);
  }

  .animate-slide-down {
    animation: slide-down var(--duration-normal) var(--ease-out);
  }

  .animate-scale-in {
    animation: scale-in var(--duration-normal) var(--ease-out);
  }

  .animate-pop-in {
    animation: pop-in var(--duration-slow) var(--ease-spring);
  }

  .animate-shimmer {
    background: linear-gradient(90deg,
        hsla(var(--foreground), 0.03) 25%,
        hsla(var(--foreground), 0.08) 50%,
        hsla(var(--foreground), 0.03) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .animate-pulse-soft {
    animation: pulse-soft 2s var(--ease-in-out) infinite;
  }

  /* Stagger animation delays */
  .stagger-1 {
    animation-delay: 50ms;
  }

  .stagger-2 {
    animation-delay: 100ms;
  }

  .stagger-3 {
    animation-delay: 150ms;
  }

  .stagger-4 {
    animation-delay: 200ms;
  }

  .stagger-5 {
    animation-delay: 250ms;
  }

  .stagger-6 {
    animation-delay: 300ms;
  }

  /* Transition utilities */
  .transition-fast {
    transition-duration: var(--duration-fast);
    transition-timing-function: var(--ease-out);
  }

  .transition-normal {
    transition-duration: var(--duration-normal);
    transition-timing-function: var(--ease-out);
  }

  .transition-slow {
    transition-duration: var(--duration-slow);
    transition-timing-function: var(--ease-out);
  }

  .transition-spring {
    transition-duration: var(--duration-normal);
    transition-timing-function: var(--ease-spring);
  }
}

/* ========== SKELETON LOADERS ========== */
@layer components {
  .skeleton {
    @apply relative overflow-hidden rounded-lg;
    background: hsla(var(--foreground), 0.06);
  }

  .skeleton::after {
    content: '';
    @apply absolute inset-0;
    background: linear-gradient(90deg,
        transparent,
        hsla(var(--foreground), 0.04),
        transparent);
    animation: shimmer 1.5s infinite;
  }

  .skeleton-text {
    @apply skeleton h-4 rounded;
  }

  .skeleton-title {
    @apply skeleton h-6 rounded w-3/4;
  }

  .skeleton-avatar {
    @apply skeleton rounded-full;
    width: 40px;
    height: 40px;
  }

  .skeleton-card {
    @apply skeleton rounded-2xl h-32;
  }
}

/* ========== TOOLTIP ========== */
@layer components {
  .tooltip {
    @apply px-3 py-1.5 text-xs font-medium;
    background: hsl(var(--foreground));
    color: hsl(var(--background));
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
  }
}

/* ========== DRAG AND DROP ========== */
@layer components {
  .draggable {
    @apply cursor-grab transition-all;
  }

  .draggable:active {
    @apply cursor-grabbing;
  }

  .draggable.dragging {
    @apply opacity-70 scale-[1.02] shadow-lg;
    box-shadow: var(--shadow-xl);
  }

  .drop-zone {
    @apply transition-all;
    border: 2px dashed transparent;
    border-radius: var(--radius-lg);
  }

  .drop-zone.active {
    border-color: hsl(var(--primary));
    background: hsla(var(--primary), 0.05);
  }
}

/* ========== CALENDAR SPECIFIC ========== */
@layer components {
  .calendar-grid {
    @apply grid gap-2;
  }

  .calendar-day-header {
    @apply text-center py-2 text-sm font-semibold;
    color: hsl(var(--foreground-muted));
  }

  .calendar-cell {
    @apply relative min-h-[100px] p-2 rounded-xl transition-all;
    background: hsla(var(--surface), 0.5);
    border: 1px solid hsla(var(--border), 0.3);
  }

  .calendar-cell:hover {
    background: hsla(var(--surface), 0.8);
  }

  .calendar-cell.weekend {
    background: hsla(var(--foreground), 0.02);
  }

  .calendar-cell.today {
    border-color: hsl(var(--primary));
    box-shadow: 0 0 0 1px hsl(var(--primary));
  }

  .calendar-date-number {
    @apply inline-flex items-center justify-center w-7 h-7 text-sm font-medium rounded-full mb-2;
  }

  .calendar-date-number.today {
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    font-weight: 600;
  }
}

/* ========== PROVIDER CARD ========== */
@layer components {
  .provider-card {
    @apply relative p-4 rounded-2xl transition-all;
    background: hsla(var(--surface), 0.6);
    border: 1px solid hsla(var(--border), 0.5);
  }

  .provider-card:hover {
    background: hsla(var(--surface), 0.8);
    box-shadow: var(--shadow-md);
  }

  .provider-avatar {
    @apply flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold;
    background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsla(var(--primary), 0.8) 100%);
    color: hsl(var(--primary-foreground));
  }

  .provider-name {
    @apply font-semibold text-sm;
    color: hsl(var(--foreground));
  }

  .provider-stats {
    @apply grid grid-cols-2 gap-2 mt-3;
  }
}

/* ========== MODAL/DIALOG ========== */
@layer components {
  .modal-overlay {
    @apply fixed inset-0 z-50;
    background: hsla(var(--foreground), 0.4);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .modal-content {
    @apply fixed left-1/2 top-1/2 z-50 max-w-lg w-[90vw] p-6;
    background: hsl(var(--surface));
    border-radius: var(--radius-2xl);
    box-shadow: var(--shadow-2xl);
    transform: translate(-50%, -50%);
  }
}

/* ========== RESPONSIVE UTILITIES ========== */
@layer utilities {
  .scrollbar-hide {
    -ms-overflow-style: none;

    /* Hide scrollbar for Chrome, Safari and Opera */
    &::-webkit-scrollbar {
      display: none;
    }

    -ms-overflow-style: none;
    /* IE and Edge */
    scrollbar-width: none;
    /* Firefox */
  }

  /* Print Optimization for Clinical Luxury Reports */
  @media print {
    body {
      background: white !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    .no-print,
    nav,
    button:not(.print-only),
    .satin-panel:not(.print-visible),
    input,
    select,
    .ExportCenter {
      display: none !important;
    }

    .satin-panel {
      background: white !important;
      border: 1px solid #e2e8f0 !important;
      box-shadow: none !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }

    .CalendarSlot {
      border: 1px solid #cbd5e1 !important;
      break-inside: avoid;
    }

    h1,
    h2,
    h3 {
      color: #0f172a !important;
    }

    /* Ensure the grid doesn't break across pages if possible */
    .grid {
      display: grid !important;
    }
  }

  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    html {
      scroll-behavior: auto;
    }

    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      transition-delay: 0ms !important;
    }

    .nav-chip,
    .soft-icon-btn,
    .soft-control,
    .satin-panel,
    .stone-panel {
      transform: none !important;
    }
  }
}

```

### src/styles/responsive.css

```css
/* =============================================================================
   Mobile Responsiveness & Touch Optimizations
   ============================================================================= */

/* Mobile-first responsive utilities */
@layer utilities {
  /* Touch-friendly tap targets (minimum 44x44px) */
  .touch-target {
    min-height: 44px;
    min-width: 44px;
  }

  .touch-target-sm {
    min-height: 36px;
    min-width: 36px;
  }

  /* Prevent text selection on interactive elements */
  .no-select {
    user-select: none;
    -webkit-user-select: none;
  }

  /* Smooth scrolling for touch devices */
  .touch-scroll {
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
  }

  /* Hide scrollbar but keep functionality */
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}

/* =============================================================================
   Mobile Layout Adjustments
   ============================================================================= */

@media (max-width: 767px) {
  /* Stack layouts vertically on mobile */
  .mobile-stack {
    flex-direction: column !important;
  }

  /* Full width on mobile */
  .mobile-full {
    width: 100% !important;
  }

  /* Hide on mobile */
  .mobile-hidden {
    display: none !important;
  }

  /* Show only on mobile */
  .mobile-only {
    display: block !important;
  }

  /* Reduce padding on mobile */
  .mobile-compact {
    padding: 0.5rem !important;
  }

  /* Smaller text on mobile */
  .mobile-text-sm {
    font-size: 0.875rem !important;
  }

  /* Touch-optimized buttons */
  .mobile-btn {
    min-height: 44px;
    padding: 0.75rem 1rem;
    font-size: 1rem;
  }

  /* Calendar adjustments for mobile */
  .calendar-mobile .calendar-grid {
    grid-template-columns: repeat(1, 1fr);
  }

  .calendar-mobile .calendar-day {
    min-height: 80px;
  }

  /* Provider list on mobile */
  .provider-list-mobile {
    flex-direction: row;
    overflow-x: auto;
    flex-wrap: nowrap;
    gap: 0.5rem;
    padding: 0.5rem;
  }

  .provider-list-mobile > * {
    flex-shrink: 0;
    min-width: 120px;
  }

  /* Shift slot mobile adjustments */
  .shift-slot-mobile {
    min-height: 60px;
    padding: 0.5rem;
  }

  /* Bottom sheet style modal on mobile */
  .modal-mobile {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    top: auto;
    max-height: 90vh;
    border-radius: 1rem 1rem 0 0;
    margin: 0;
    animation: slide-up 0.3s ease-out;
  }

  /* FAB (Floating Action Button) for mobile */
  .fab-mobile {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 50;
  }

  /* Mobile navigation drawer */
  .nav-drawer-mobile {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: hsl(var(--surface));
    border-top: 1px solid hsl(var(--border));
    padding: 0.5rem;
    z-index: 40;
    display: flex;
    justify-content: space-around;
  }

  /* Safe area insets for notched devices */
  .safe-area-inset {
    padding-bottom: env(safe-area-inset-bottom, 0);
    padding-left: env(safe-area-inset-left, 0);
    padding-right: env(safe-area-inset-right, 0);
  }
}

/* =============================================================================
   Tablet Layout Adjustments
   ============================================================================= */

@media (min-width: 768px) and (max-width: 1023px) {
  .tablet-grid-2 {
    grid-template-columns: repeat(2, 1fr);
  }

  .tablet-hidden {
    display: none !important;
  }
}

/* =============================================================================
   Desktop Layout Adjustments
   ============================================================================= */

@media (min-width: 1024px) {
  .desktop-hidden {
    display: none !important;
  }

  .desktop-only {
    display: block !important;
  }
}

/* =============================================================================
   Touch Device Optimizations
   ============================================================================= */

@media (pointer: coarse) {
  /* Larger touch targets on touch devices */
  button,
  [role="button"],
  input,
  select,
  textarea,
  a {
    min-height: 44px;
  }

  /* Disable hover effects on touch devices */
  .hover\:scale-105:hover,
  .hover\:shadow-lg:hover {
    transform: none;
  }

  /* Enable momentum scrolling */
  .scroll-container {
    -webkit-overflow-scrolling: touch;
  }

  /* Remove focus outline on touch (keep for accessibility) */
  *:focus:not(:focus-visible) {
    outline: none;
  }
}

/* =============================================================================
   Orientation Adjustments
   ============================================================================= */

@media (orientation: landscape) and (max-height: 500px) {
  /* Landscape mode on small devices (phones) */
  .landscape-compact {
    padding: 0.25rem;
  }

  .landscape-hidden {
    display: none !important;
  }
}

/* =============================================================================
   Print Styles
   ============================================================================= */

@media print {
  .no-print {
    display: none !important;
  }

  .print-only {
    display: block !important;
  }

  /* Ensure backgrounds print */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}

/* =============================================================================
   Reduced Motion Preferences
   ============================================================================= */

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .animate-fade-in,
  .animate-slide-up,
  .animate-scale-in,
  .animate-pop-in {
    animation: none !important;
  }
}

/* =============================================================================
   Dark Mode Adjustments for Mobile
   ============================================================================= */

@media (prefers-color-scheme: dark) and (max-width: 767px) {
  .mobile-dark-adjust {
    background: hsl(var(--background));
  }
}

/* =============================================================================
   Animations
   ============================================================================= */

@keyframes slide-up {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slide-down {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

```

### src/styles/workspace.css

```css
/* The authenticated workspace has its own palette; dialogs inherit these tokens. */
.scheduler-app {
  --background: 45 20% 97%;
  --background-secondary: 40 14% 94%;
  --foreground: 207 32% 17%;
  --foreground-secondary: 207 12% 39%;
  --foreground-tertiary: 207 10% 43%;
  --foreground-muted: 207 9% 45%;
  --primary: 173 57% 26%;
  --primary-hover: 173 57% 21%;
  --ring: 173 57% 32%;
  --secondary: 40 14% 93%;
  --border: 40 12% 86%;
  --border-strong: 40 10% 72%;
  --input: 40 12% 86%;
}

.workspace-sidebar {
  --foreground: 180 20% 95%;
  --foreground-secondary: 206 17% 75%;
  --foreground-muted: 207 16% 64%;
  --secondary: 207 27% 23%;
  --primary: 165 45% 74%;
  --border: 207 22% 28%;
  --ring: 165 45% 74%;
  background: #172c38;
  color: hsl(var(--foreground));
}

.workspace-brand {
  color: #b1ddcd;
  background: #23434b;
  border: 1px solid #36545a;
}

.workspace-nav-active {
  background: #29464d;
  box-shadow: inset 3px 0 0 #a5d8c4;
}

.workspace-nav-item:hover { background-color: hsl(var(--secondary)); }
.workspace-topbar { background: hsl(var(--surface) / 0.96); }
.scheduler-app .workspace-title {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: clamp(2.5rem, 3.4vw, 3.5rem);
  font-weight: 400;
  line-height: 1.04;
  letter-spacing: -0.035em;
}
.workspace-primary-action { box-shadow: 0 2px 3px rgb(16 69 60 / 12%); }
.workspace-summary { box-shadow: 0 2px 5px rgb(28 43 35 / 3%); }
.workspace-calendar { border-top: 1px solid hsl(var(--border)); padding-top: 22px; }

.dark .scheduler-app {
  --background: 207 27% 11%;
  --surface: 207 25% 15%;
  --surface-elevated: 207 25% 18%;
  --foreground: 180 15% 93%;
  --foreground-secondary: 207 13% 76%;
  --foreground-tertiary: 207 11% 68%;
  --foreground-muted: 207 11% 65%;
  --primary: 166 44% 69%;
  --primary-hover: 166 44% 77%;
  --primary-foreground: 207 32% 14%;
  --ring: 166 44% 69%;
  --secondary: 207 23% 22%;
  --border: 207 20% 28%;
  --border-strong: 207 17% 42%;
  --input: 207 20% 28%;
}

@media print {
  .scheduler-app { --background: 0 0% 100%; --foreground: 0 0% 0%; }
  .workspace-intro { break-after: avoid; }
  .workspace-summary { box-shadow: none; }
}

```

### src/styles/print-schedule.css

```css
/**
 * Schedule print dialog preview + injected print window.
 * Scoped under .print-schedule so it does not affect the rest of the app.
 */

.print-schedule {
  --print-ink: #0f172a;
  --print-ink-muted: #475569;
  --print-ink-faint: #94a3b8;
  --print-border: #e2e8f0;
  --print-border-strong: #cbd5e1;
  --print-surface: #ffffff;
  --print-surface-subtle: #f8fafc;
  --print-surface-weekend: #f1f5f9;
  --print-header-bg: #0f172a;
  --print-accent: #1d4ed8;
  --print-critical: #b45309;
  --print-critical-bg: #fffbeb;
}

/* ---------- Print window: @page applies when user prints from popup ---------- */
@page {
  size: landscape;
  margin: 0.45in 0.55in;
}

.print-schedule .print-page {
  background: var(--print-surface);
  break-inside: avoid;
  page-break-after: always;
  max-width: 100%;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.05),
    0 4px 12px rgba(15, 23, 42, 0.06);
  border-radius: 8px;
  border: 1px solid var(--print-border);
  padding: 1.4rem 1.5rem 1.25rem;
  margin-bottom: 1.75rem;
}

.print-schedule .print-page:last-child {
  page-break-after: auto;
}

/* Header */
.print-schedule .print-schedule-header {
  display: flex;
  align-items: stretch;
  margin-bottom: 1.125rem;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--print-border);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
}

.print-schedule .print-schedule-header__accent {
  width: 0.35rem;
  flex-shrink: 0;
  background: linear-gradient(180deg, #1e293b 0%, var(--print-header-bg) 100%);
}

.print-schedule .print-schedule-header__body {
  flex: 1;
  padding: 1rem 1.25rem;
  background: linear-gradient(180deg, #fafbfc 0%, var(--print-surface) 55%);
}

.print-schedule .print-schedule-kicker {
  margin: 0 0 0.25rem 0;
  font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--print-accent);
}

.print-schedule .print-schedule-title {
  margin: 0 0 0.2rem 0;
  font-family: "Instrument Serif", Georgia, "Times New Roman", serif;
  font-size: 1.5rem;
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--print-ink);
}

.print-schedule .print-schedule-subtitle {
  margin: 0;
  font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--print-ink-muted);
}

/* Table shell */
.print-schedule .print-schedule-table-wrap {
  border: 1px solid var(--print-border-strong);
  border-radius: 6px;
  overflow: hidden;
  background: var(--print-surface);
}

.print-schedule .print-schedule-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  font-size: 0.72rem;
  line-height: 1.35;
}

.print-schedule .print-schedule-th-date {
  width: 12%;
}

.print-schedule .print-schedule-th-loc {
  width: auto;
}

.print-schedule .print-schedule-table thead th {
  background: var(--print-header-bg) !important;
  color: #f8fafc !important;
  font-weight: 600;
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: left;
  padding: 0.55rem 0.65rem;
  border: 1px solid #334155;
  vertical-align: bottom;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.print-schedule .print-schedule-table tbody tr:nth-child(even) td {
  background: var(--print-surface-subtle) !important;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.print-schedule .print-schedule-table tbody td {
  border: 1px solid var(--print-border);
  padding: 0.45rem 0.65rem;
  vertical-align: top;
  color: var(--print-ink);
}

.print-schedule .print-schedule-table .print-date-cell {
  width: 12%;
  min-width: 5rem;
  background: var(--print-surface) !important;
  border-right: 2px solid var(--print-border-strong) !important;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.print-schedule .print-schedule-table tr.print-weekend-row .print-date-cell {
  background: var(--print-surface-weekend) !important;
}

.print-schedule .print-schedule-table .print-date-cell .print-day-name {
  display: block;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--print-ink-muted);
}

.print-schedule .print-schedule-table .print-date-cell .print-day-num {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--print-ink);
}

.print-schedule .print-schedule-table tr.print-weekend-row td:not(.print-date-cell) {
  background: #f4f4f5 !important;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.print-schedule .print-schedule-table .print-cell-critical {
  font-weight: 700;
  color: var(--print-ink);
}

.print-schedule .print-schedule-table .print-cell-critical .print-critical-badge {
  display: inline-block;
  margin-left: 0.15rem;
  padding: 0.05rem 0.35rem;
  border-radius: 3px;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--print-critical);
  background: var(--print-critical-bg);
  border: 1px solid #fde68a;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.print-schedule .print-schedule-table .print-cell-empty {
  color: var(--print-ink-faint);
  font-style: italic;
}

.print-schedule .print-schedule-table .print-cell-unfilled {
  color: var(--print-critical);
  font-weight: 600;
  font-size: 0.68rem;
}

/* Legend */
.print-schedule .print-schedule-legend {
  margin-top: 1rem;
  padding: 0.65rem 0.85rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1.25rem;
  font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  font-size: 0.62rem;
  color: var(--print-ink-muted);
  background: var(--print-surface-subtle);
  border: 1px solid var(--print-border);
  border-radius: 0.35rem;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.print-schedule .print-schedule-legend strong {
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--print-ink);
}

.print-schedule .print-schedule-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.print-schedule .print-legend-swatch {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 2px;
  border: 1px solid var(--print-border-strong);
  flex-shrink: 0;
}

.print-schedule .print-legend-swatch--weekend {
  background: #f4f4f5;
}

.print-schedule .print-legend-swatch--critical {
  background: var(--print-critical-bg);
  border-color: #fde68a;
}

/* Footer */
.print-schedule .print-schedule-footer {
  margin-top: 1rem;
  padding-top: 0.65rem;
  border-top: 1px solid var(--print-border);
  display: flex;
  font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  font-size: 0.62rem;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.print-schedule .print-schedule-footer .print-schedule-footer__stamp {
  letter-spacing: 0.02em;
  color: var(--print-ink-faint);
}

.print-schedule .print-schedule-footer .print-schedule-footer__notice {
  letter-spacing: 0.02em;
  color: var(--print-ink-muted);
  font-weight: 500;
  max-width: 22rem;
  text-align: right;
}

@media print {
  .print-schedule .print-page {
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    margin-bottom: 0 !important;
  }
}

```

### src/styles/PrintStyles.css

```css
@media print {

    /* Hide UI elements that shouldn't be printed */
    .btn,
    .glass-panel:not(.print-visible),
    nav,
    .no-print,
    button,
    .input-base,
    .scenario-panel,
    aside,
    header {
        display: none !important;
    }

    body {
        background: white !important;
        color: black !important;
        padding: 0 !important;
        margin: 0 !important;
    }

    .main-container {
        padding: 0 !important;
        margin: 0 !important;
        max-width: 100% !important;
    }

    /* Force grid and monthly calendar to be visible and full width */
    .grid-container,
    .monthly-calendar-container {
        display: block !important;
        width: 100% !important;
        border: none !important;
        box-shadow: none !important;
    }

    /* Page breaks */
    .page-break {
        page-break-before: always;
    }

    /* Enhancing table/grid visibility in print */
    table {
        border-collapse: collapse !important;
        width: 100% !important;
    }

    th,
    td {
        border: 1px solid #ddd !important;
        padding: 8px !important;
        color: black !important;
    }

    .bg-slate-50 {
        background-color: #f8fafc !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    /* Ensure text is readable */
    .text-transparent {
        color: black !important;
        background: none !important;
        -webkit-background-clip: initial !important;
        background-clip: initial !important;
    }

    .glass-panel {
        border: 1px solid #eee !important;
        background: white !important;
        box-shadow: none !important;
    }

    /* Show a print-only header */
    .print-header {
        display: block !important;
        text-align: center;
        margin-bottom: 2rem;
    }
}

/* Hide print header normally */
.print-header {
    display: none;
}
```
