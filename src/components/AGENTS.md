# src/components/ - UI Component Library

## OVERVIEW
React components for NICU scheduling UI. Calendar-centric with drag-drop, modals, and collaboration features.

## STRUCTURE
```
src/components/
├── calendar/             # Core calendar components
│   ├── features/         # AI, collaboration, swap board
│   ├── hooks/            # Calendar-specific hooks
│   ├── modals/           # Handoff, template, swap modals
│   └── utils/            # Calendar utilities
├── layout/               # App shell, error boundaries
├── ui/                   # Shadcn primitives (button, dialog, etc.)
└── schedule/             # Schedule view components
```

## WHERE TO LOOK
| Component | Location | Notes |
|-----------|----------|-------|
| Main calendar | `calendar/CalendarView.tsx` | Primary scheduler UI |
| Drag-drop | `calendar/hooks/useDragDrop*` | @dnd-kit integration |
| Collaboration | `calendar/collaboration/` | Comments, presence, activity |
| Modals | `calendar/modals/` | Handoff, template, swap dialogs |
| AI features | `calendar/features/AI/` | Suggestions, conflict resolution |

## CONVENTIONS
- Shadcn/ui patterns for base components
- Framer Motion for animations
- Tailwind + CSS variables (HSL theme)
- Radix UI primitives underneath

## ANTI-PATTERNS
- **Calendar excluded from tsconfig** - `src/components/calendar` has separate compilation
- Pre-existing lint: missing button `type` prop, empty alt text (see LSP diagnostics)
