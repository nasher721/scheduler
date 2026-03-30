# src/lib/api/ - API Client Layer

## OVERVIEW
Fetch wrappers for Express backend. Centralizes error handling, base URL, and request/response types.

## STRUCTURE
```
src/lib/api/
├── index.ts        # Re-exports all API functions
├── schedule.ts     # Schedule CRUD operations
├── providers.ts    # Provider management
├── notifications.ts # Notification endpoints
└── ai.ts           # AI/ML inference endpoints
```

## CONVENTIONS
- Base URL: `http://localhost:4000/api` (dev), env-based (prod)
- All functions return typed promises
- Error handling: throw on non-2xx, catch in hooks
- Zod validation for request/response bodies

## ENDPOINTS
| Function | Method | Path | Notes |
|----------|--------|------|-------|
| `fetchSchedule` | GET | `/schedule` | Main data fetch |
| `saveSlot` | POST | `/schedule/slots` | Create/update slot |
| `deleteSlot` | DELETE | `/schedule/slots/:id` | Remove slot |
| `runAI` | POST | `/ai/solve` | Constraint solver |
