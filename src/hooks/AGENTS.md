# src/hooks/ - Custom React Hooks

## OVERVIEW
Business logic extracted into reusable hooks. Drag-drop, scheduling, AI integration, theming, persistence.

## HOOKS
| Hook | Purpose | Key Dependencies |
|------|---------|------------------|
| `useDragDrop` | Slot drag-drop with @dnd-kit | dnd-kit/core, store |
| `useAIScheduling` | AI constraint solving | ai-services, store |
| `useScheduleManager` | CRUD for schedule slots | store, api |
| `useTheme` | Dark/light mode | localStorage, matchMedia |
| `useOnlineStatus` | Network detection | navigator.onLine |
| `useAutoSave` | Debounced persistence | store, api |

## CONVENTIONS
- Each hook in its own file (`use*.ts`)
- Tests co-located: `__tests__/use*.test.ts`
- Zustand store accessed via `useScheduleStore()`
- API calls wrapped in try/catch with error state

## TESTING
```bash
pnpm test -- src/hooks/
```
