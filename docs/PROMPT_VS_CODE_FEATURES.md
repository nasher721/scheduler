# Prompt-Defined vs Code-Defined Features

Single place to audit which behavior is changed by editing prompts/config vs code.

## Prompt- or config-defined (change copy/config, not code)

| Feature | Location | How to change behavior |
|--------|----------|-------------------------|
| Copilot per-intent responses | `server/prompts/copilot-responses.js` | Edit message, suggestions, and actions per intent |
| Policy profiles and weights | `server/prompts/policy-config.js` | Edit `POLICY_PROFILES`, `POLICY_AUTO_APPLY_THRESHOLD`, `ROLLOUT_MODES` |
| Intent parsing prompt | `ai-orchestrator.js` `buildIntentPrompt()` | Edit system block and intent list; dynamic context is injected |
| Outcome prompts (recommend, optimize, conflicts, explain) | `server/prompts/outcome-prompts.js` | Edit `RECOMMEND_PROMPT`, `OPTIMIZE_PROMPT`, `CONFLICTS_PROMPT`, `EXPLAIN_PROMPT`; used when LLM is available |
| Conflict types and messages | `server/prompts/conflict-config.js` | Edit `CONFLICT_TYPES` or use `getConflictMessage(type)`; detection logic stays in code |
| Scheduling agent roles (Coverage, Fairness, etc.) | `server/agents/scheduling-agents.js` | Edit `systemPrompt` per agent |
| NLP intent list and response generation | `server/ai-services/nlp-assistant.js` | Edit inline prompts and intent schema |

## Code-defined (refactor required to change behavior)

| Feature | Location | Notes |
|--------|----------|--------|
| Optimize / recommend / conflicts / explain fallbacks | `ai-orchestrator.js` | `deterministicOptimize`, `deterministicRecommendations`, `deterministicConflicts`, `deterministicExplain`; used when LLM unavailable |
| Apply/rollback workflow | `server.js` POST `/api/ai/apply`, `/api/ai/rollback` | Orchestration and audit append; state write is primitive |
| Conflict detection logic | `ai-orchestrator.js`, `store.ts` `detectConflicts` | Types and rules in code; messages come from `conflict-config.js` |
| Anomaly rules (non-pattern) | `server/ai-services/anomaly-detector.js` | Coverage/skill/ACGME checks in code |
| Demand forecast and preference learning | `server/ai-services/demand-forecast.js`, `preference-learning.js` | Fully algorithmic |
| Client natural language query | `src/lib/ai/naturalLanguageQuery.ts` | Regex and switch; no prompts |

## Centralized prompt/config paths

- **Copilot copy:** `server/prompts/copilot-responses.js`
- **Policy/rollout:** `server/prompts/policy-config.js`
- **Outcome prompts:** `server/prompts/outcome-prompts.js` → recommend, optimize, conflicts, explain
- **Conflict messages:** `server/prompts/conflict-config.js` → `CONFLICT_TYPES`, `getConflictMessage()`
- **Intent prompt:** `ai-orchestrator.js` → `buildIntentPrompt()`
- **Scheduling agents:** `server/agents/scheduling-agents.js` → per-agent `systemPrompt`
