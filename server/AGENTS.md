# server/ - Express Backend

## OVERVIEW
Express API server handling schedule persistence, AI inference, and notifications. JSON file storage.

## STRUCTURE
```
server/
├── ai-services/       # AI/ML service wrappers
├── agents/            # Agent orchestration
└── prompts/           # LLM prompt templates
```

## KEY FILES
| File | Purpose |
|------|---------|
| `server.js` (root) | Main Express app, all routes defined inline |
| `ai-services/` | OpenAI, Anthropic, Gemini integrations |
| `agents/` | Multi-agent orchestration |
| `prompts/` | System prompts for LLM endpoints |

## CONVENTIONS
- Routes defined inline in `server.js` (not separated)
- JSON file persistence: `data/schedule-state.json`
- Port: 4000
- CORS enabled for localhost:5173

## COMMANDS
```bash
pnpm server          # Start backend only
pnpm dev:fullstack   # Start both frontend + backend
```

## PERSISTENCE
- `data/schedule-state.json` - Main schedule data
- `data/shift-requests.json` - Swap/transfer requests
- `data/notification-history.json` - Notification log
