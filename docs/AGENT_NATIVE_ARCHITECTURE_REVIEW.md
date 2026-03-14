# Agent-Native Architecture Review: Scheduler

**Review date:** March 2026  
**Scope:** Full codebase audit against 8 agent-native principles; recommendations and phased implementation plan.

---

## Overall Score Summary

| Core Principle | Score | Percentage | Status |
|----------------|-------|------------|--------|
| Action Parity | 6/52 | 12% | ❌ |
| Tools as Primitives | 32/55 | 58% | ⚠️ |
| Context Injection | 4/11 | 36% | ❌ |
| Shared Workspace | 2/6 | 33% | ❌ |
| CRUD Completeness | 9/18 | 50% | ⚠️ |
| UI Integration | 10/10* | 100%* | ⚠️ |
| Capability Discovery | 6/7 | 86% | ✅ |
| Prompt-Native Features | 12/28 | 43% | ❌ |

**Overall Agent-Native Score: ~49%**

\* UI Integration: Slots/providers/range update immediately via Supabase realtime; scenarios, customRules, and auditLog are not merged in the realtime handler, so full state can be stale (partial silent action).

### Status Legend

- ✅ **Excellent** (80%+)
- ⚠️ **Partial** (50–79%)
- ❌ **Needs work** (<50%)

---

## Executive Summary

- **Strengths:** Capability discovery is strong (/help, /tools, hints, empty state). Core schedule data (slots, providers) is shared and updates in the UI when the agent acts. Several agent tools are primitive (assign-shift, list scenarios, get summary).
- **Gaps:** Most user actions (scenarios, templates, providers, swaps, conflicts, rules, notifications, shift requests, import/export, undo/redo, state load/save) have no agent tool. System prompts are static; conversation history and current user are not injected. Many endpoints encode workflows instead of primitives. Several entities lack full CRUD (scenarios, templates, rules, holidays: no Update). Realtime merge is partial (scenarios/customRules/auditLog not merged).

---

## Top 10 Recommendations by Impact

| Priority | Action | Principle | Effort |
|----------|--------|-----------|--------|
| 1 | Expose GET/PUT `/api/state` and core write APIs as agent tools (scenarios, providers, templates, swaps, rules, shift requests) | Action Parity, CRUD | High |
| 2 | Merge full state (scenarios, customRules, auditLog) in the Supabase realtime handler in App.tsx | UI Integration | Low |
| 3 | Add dynamic system prompt for copilot (and/or agents) that includes schedule summary, user role, capabilities, and optionally recent activity | Context Injection | Medium |
| 4 | Use conversation history in `buildCopilotResponse` and send `currentUser` in context from client | Context Injection | Low |
| 5 | Add Update operations for scenarios, templates, custom_rules, holiday assignments; document read-only entities (apply_history, anomaly_alerts) | CRUD Completeness | Medium |
| 6 | Split hybrid endpoints: primitive “write state” (no side effects) vs “notify schedule change”; thin workflow layer for apply/rollback | Tools as Primitives | Medium |
| 7 | Add onboarding step that highlights the copilot and explains /help, /tools, and example asks | Capability Discovery | Low |
| 8 | Wire OnboardingTour into App.tsx so new users see the tour | Capability Discovery | Low |
| 9 | Fix or remove client shared-memory `syncWithServer()` (state shape mismatch with GET /api/state) | Shared Workspace | Low |
| 10 | Move copilot per-intent responses and policy/rollout config to prompts or config; add outcome-defining prompts for recommend/optimize/conflicts/explain | Prompt-Native Features | High |

---

## What's Working Well

1. **Capability discovery (86%)** — /help and /tools, placeholder and empty-state copy, suggested prompts, and agent self-description in responses give users a clear path to “what can the agent do?”
2. **Slots/providers realtime** — Agent assign-shift and apply/rollback flow through Supabase; UI updates via `postgres_changes` on slots so calendar and provider data stay in sync.
3. **Core agent tools** — assign-shift, list scenarios, schedule summary, get optimization result are exposed and primitive; optimize and apply are workflow entrypoints that use the same backend as the UI.
4. **Shared canonical data** — Zustand and Supabase (and server state APIs) represent the same logical schedule; no separate “agent sandbox” for schedule data.
5. **Scheduling agents** — Coverage, Fairness, Preference, Compliance, and Director use prompt-defined roles and output format in `scheduling-agents.js`; intent parsing and NLP responses are prompt-driven in several places.

---

## Phased Implementation Plan

### Phase 1: Foundation (quick wins, 1–2 sprints)

**Goal:** Fix silent UI updates and context gaps; clarify shared workspace.

| # | Task | Owner | Success criteria |
|---|------|--------|-------------------|
| 1.1 | In App.tsx realtime handler, merge full state from `loadScheduleState()` (scenarios, customRules, auditLog) into the store | Frontend | Apply/rollback/assign from agent updates full UI without reload |
| 1.2 | Use `conversationHistory` in `buildCopilotResponse` (e.g. last 5–10 turns) so copilot has conversation memory | Backend | Follow-up questions get contextual replies |
| 1.3 | Send `currentUser` (id, name) in copilot context from client so explain_assignment and other actions have user identity | Frontend + Backend | Backend logs and actions use correct user |
| 1.4 | Fix or remove client shared-memory `syncWithServer()`: align with GET /api/state shape or drop sync and document | Frontend | No misleading “sync” that doesn’t reflect schedule |
| 1.5 | Add one onboarding step for the copilot (open/highlight panel, /help, /tools, 2–3 example asks); wire OnboardingTour into App.tsx | Frontend | New users see tour and copilot step |

**Outcome:** Full state in UI after agent actions; copilot has identity and history; shared workspace boundaries clear; discovery improved.

---

### Phase 2: Action Parity & CRUD (2–3 sprints)

**Goal:** Agent can do what the user can do; every entity has full CRUD where applicable.

| # | Task | Owner | Success criteria |
|---|------|--------|-------------------|
| 2.1 | Register existing APIs as agent tools: GET/PUT `/api/state`, POST `/api/ai/agents/optimize`, POST `/api/shift-requests`, PATCH shift-requests/:id, notification send/update/delete, POST `/api/copilot/chat` (if needed) | Backend | Agent tool list includes state, optimization, shift requests, notifications |
| 2.2 | Add agent tools (or document state blob) for: create/delete scenario, load scenario by id; create/delete/apply template; add/update/remove provider | Backend | Agent can manage scenarios, templates, providers via tools or state |
| 2.3 | Add agent tools for: create swap request, approve/reject/cancel; add/remove holiday; resolve/acknowledge/ignore conflict; add/remove custom rule | Backend | Agent can perform swaps, holidays, conflicts, rules |
| 2.4 | Implement Update in store + API: updateScenario, updateTemplate, updateCustomRule, updateHolidayAssignment | Full stack | CRUD completeness for scenarios, templates, rules, holidays |
| 2.5 | Document read-only entities (apply_history, anomaly_alerts, audit_logs) and optional agent-facing APIs (e.g. resolve anomaly alert) | Backend + Docs | Clear which entities are append-only vs full CRUD |

**Outcome:** Action parity raised from ~12% to a target >60%; 9+ entities with full CRUD; agent and user use same operations.

---

### Phase 3: Context & Primitives (2 sprints)

**Goal:** Dynamic system context; tools as primitives where possible.

| # | Task | Owner | Success criteria |
|---|------|--------|-------------------|
| 3.1 | Build a dynamic system prompt (or block) for copilot: app name, current view/date, user role, schedule summary (slots, coverage), “what you can do” (capabilities) | Backend | System prompt includes live app state |
| 3.2 | Optionally inject user preferences (scheduling/preference-learning) and recent activity (last N events) into copilot/agent prompts | Backend | Context reflects preferences and recent actions |
| 3.3 | Split state write from side effects: primitive “write state” (no email/audit); separate “notify schedule change” / “append audit”; have PUT /api/state and POST /api/ai/apply call both | Backend | Apply/rollback use primitives + thin workflow |
| 3.4 | Expose primitive read/write for forecast (patterns, factors, store forecast) and preferences (read model, score shift, write model); keep learning workflows separate | Backend | Agents can compose forecast and recommendation from primitives |
| 3.5 | Document agent-facing primitives in GET `/api/agent-tools` and list workflow endpoints (optimize, apply) as orchestration only | Backend + Docs | Clear split between primitives and workflows |

**Outcome:** System prompt and context are dynamic; state apply is built from primitives; tools-as-primitives score improves.

---

### Phase 4: Prompt-Native & Polish (2–3 sprints)

**Goal:** More behavior in prompts and config; fewer hardcoded workflows.

| # | Task | Owner | Success criteria |
|---|------|--------|-------------------|
| 4.1 | Externalize copilot per-intent responses (message, suggestions, actions) to config or prompt templates; optionally one “response generator” prompt from intent + entities | Backend | Changing copilot replies = config/prompt edit |
| 4.2 | Add outcome-defining prompts for recommend, optimize, conflicts, explain (e.g. in server/prompts/); use current code as fallback when LLM unavailable | Backend | Behavior changes via prompt edits where possible |
| 4.3 | Move policy names, weights, auto-apply threshold to config; consider small “policy interpreter” prompt for mode + reason | Backend | Policy/rollout behavior config-driven |
| 4.4 | Define conflict types and messages in config or prompts; keep detection logic in code if needed | Backend | New conflict types/messages without code change |
| 4.5 | Centralize prompt and config locations; document which features are prompt-defined vs code-defined | Docs + Backend | Single place to audit “behavior = prompt vs code” |

**Outcome:** Prompt-native score and maintainability improve; product and support can tune behavior via prompts/config.

---

## Principle-Level Summaries

### 1. Action Parity (12% — ❌)

- **Finding:** 6 of 52 user actions have a corresponding agent tool (assign-shift, optimize, apply, list scenarios, get summary, get optimization result). Scenarios, templates, providers, swaps, conflicts, rules, notifications, shift requests, import/export, undo/redo, state load/save, and others have no agent tool.
- **Plan:** Phase 2 focuses on exposing state and core write APIs as tools and adding tools for scenarios, templates, providers, swaps, holidays, conflicts, rules, and shift requests.

### 2. Tools as Primitives (58% — ⚠️)

- **Finding:** 32 of 55 tools/endpoints are primitive; 23 encode workflows (apply, rollback, optimize, forecast, recommend, detect, copilot chat/intent). State write is coupled with email and audit.
- **Plan:** Phase 3 splits “write state” from “notify” and “audit”; exposes forecast/preference primitives; documents primitives vs workflows in agent-tools.

### 3. Context Injection (36% — ❌)

- **Finding:** View/selection, user role, schedule summary, capabilities, and workspace state are in **user** prompts; system prompts are static. Conversation history is unused; currentUser is not sent; user preferences and recent activity are not injected.
- **Plan:** Phase 1 uses history and sends currentUser; Phase 3 adds dynamic system prompt and optional preferences/activity.

### 4. Shared Workspace (33% — ❌)

- **Finding:** Zustand + Supabase are shared. Server shared-memory is partially shared (optimization result). Client shared-memory, localStorage, and IndexedDB are not shared; client syncWithServer is broken.
- **Plan:** Phase 1 fixes or removes client sync; document shared vs isolated stores. Supabase + server state APIs remain the single source of truth.

### 5. CRUD Completeness (50% — ⚠️)

- **Finding:** 9 of 18 entities have full CRUD. Scenarios, templates, custom_rules, holidays lack Update; apply_history, preference_models, anomaly_alerts are read-only; profiles and audit_logs partial.
- **Plan:** Phase 2 adds Update for scenarios, templates, rules, holidays; documents read-only and optional agent APIs.

### 6. UI Integration (100%* — ⚠️)

- **Finding:** Slots/providers/range update immediately via realtime. Scenarios, customRules, auditLog are not merged in the realtime handler, so they can stay stale.
- **Plan:** Phase 1 merges full state in the realtime handler so all agent-triggered writes reflect immediately.

### 7. Capability Discovery (86% — ✅)

- **Finding:** Help docs, hints, empty state, /help, /tools, suggested prompts, and agent self-description are in place. Onboarding does not surface the copilot.
- **Plan:** Phase 1 adds a copilot onboarding step and wires the tour.

### 8. Prompt-Native Features (43% — ❌)

- **Finding:** Scheduling agents and intent/NLP are prompt-defined; recommend, optimize, conflicts, explain, copilot responses, policy/rollout, and anomaly rules are largely code-defined.
- **Plan:** Phase 4 externalizes responses and policies; adds outcome prompts for recommend/optimize/conflicts/explain; centralizes prompt/config.

---

## Read-only and append-only entities (Phase 2.5)

The following entities are **read-only** or **append-only** from the agent’s perspective:

| Entity | Create | Read | Update | Delete | Notes |
|--------|--------|------|--------|--------|--------|
| **apply_history** | No | Yes (GET /api/ai/apply-history) | No | No | Server-generated when applying/rolling back; agents do not create or delete records. |
| **anomaly_alerts** | No | Yes (GET /api/ai/anomalies/alerts) | Yes (resolve via POST /api/ai/anomalies/alerts/:id/resolve) | No | Alerts are created by the anomaly detector; agents can resolve. |
| **audit_log** | No (implicit on actions) | Yes (in state or dedicated API) | No | No | Append-only; no update or delete. |
| **preference_models** | No | Yes (GET /api/ai/preferences) | No (re-run learn to regenerate) | No | ML-derived; optional clear/regenerate if needed. |

All other entities (slots, providers, scenarios, templates, custom_rules, holiday_assignments, shift_requests, notifications, etc.) support full CRUD where implemented (including the new updateScenario, updateTemplate, updateCustomRule, updateHolidayAssignment in the store).

---

## Implementation status (phases)

- **Phase 1:** Done (realtime full merge, conversation history, currentUser, shared-memory fix, onboarding + copilot step).
- **Phase 2:** Done (agent-tools list with state/optimize/shift-requests/notifications; store Update for scenario/template/rule/holiday; read-only entities doc).
- **Phase 3:** Done (dynamic system block in intent prompt; optional preferenceSummary/recentActivity in context; primitives vs workflows in GET /api/agent-tools; writeState commented as primitive).
- **Phase 3.4:** Done (agent-tools list includes `ai/forecast/read`, `ai/preferences/read`, `ai/preferences/read-one` as primitives; learning endpoints remain workflows).
- **Phase 4:** Partially done (copilot responses in `server/prompts/copilot-responses.js`; policy in `server/prompts/policy-config.js`; `docs/PROMPT_VS_CODE_FEATURES.md` for prompt vs code).
- **Phase 4.2:** Done (outcome-defining prompts in `server/prompts/outcome-prompts.js` for recommend, optimize, conflicts, explain; `buildPrompt()` uses them when LLM is available; deterministic fallbacks unchanged).
- **Phase 4.4:** Done (conflict types and messages in `server/prompts/conflict-config.js`; `deterministicConflicts` uses `getConflictMessage()` for user-facing text).

---

## References

- Sub-agent audits: Action Parity, Tools as Primitives, Context Injection, Shared Workspace, CRUD Completeness, UI Integration, Capability Discovery, Prompt-Native Features (run March 2026).
- Agent-native skill: `compound-engineering/agent-native-architecture` (parity, granularity, composability, shared workspace, CRUD, context injection, prompt-native).
- In-repo: `CRUD_COMPLETENESS_AUDIT.md`, `docs/prompt-native-features-audit.md` (if present) for detailed tables and code refs.
