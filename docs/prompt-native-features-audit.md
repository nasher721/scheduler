# Prompt-Native Features Audit

**Scope:** Agent prompts (server/agents, server/ai-services), ai-orchestrator.js, Copilot intent handling, system prompts.  
**Criteria:** PROMPT = outcome defined in natural language in a prompt; behavior change = edit prompt. CODE = logic hardcoded; behavior change = refactor.

---

## Feature Definition Analysis

| Feature | Location | Type | Notes |
|--------|----------|------|--------|
| **Coverage agent** | `server/agents/scheduling-agents.js` | PROMPT | systemPrompt defines role, checks (skills, backup, gaps), output JSON; behavior change = edit prompt |
| **Fairness agent** | `server/agents/scheduling-agents.js` | PROMPT | systemPrompt defines workload balance, weekend/night/holiday equity, output format |
| **Preference agent** | `server/agents/scheduling-agents.js` | PROMPT | systemPrompt defines preference matching, time-off, pairing; output format |
| **Compliance agent** | `server/agents/scheduling-agents.js` | PROMPT | systemPrompt defines ACGME, state, hospital, union rules; output format |
| **Scheduling Director** | `server/agents/scheduling-agents.js` | PROMPT | systemPrompt defines coordination, guardrails, decision priority (compliance → coverage → fairness → preference), output format |
| **Orchestrator explain decision** | `server/agents/scheduling-orchestrator.js` | PROMPT | Director receives natural-language request ("Explain why shift X was assigned..."); outcome in prompt |
| **Copilot intent parsing** | `ai-orchestrator.js` (buildIntentPrompt) | PROMPT | Full prompt: intents list, guardrails, context, JSON schema; behavior change = edit prompt |
| **NLP Assistant: classify intent** | `server/ai-services/nlp-assistant.js` | PROMPT | Inline prompt with intent categories and JSON response format |
| **NLP Assistant: extract entities** | `server/ai-services/nlp-assistant.js` | PROMPT | Inline prompt with entity schema (dates, providers, shiftTypes, etc.) |
| **NLP Assistant: generate response** | `server/ai-services/nlp-assistant.js` | PROMPT | Short prompt to generate conversational response from intent + result |
| **Anomaly: pattern detection** | `server/ai-services/anomaly-detector.js` (checkPatternAnomalies) | PROMPT | AI analyzes schedule for "unusual patterns"; outcome described in natural language in prompt |
| **Recommendations (orchestrator)** | `ai-orchestrator.js` | CODE | buildPrompt is generic ("Task: recommendations", payload); real behavior in deterministicRecommendations (fill gaps, reduce load) |
| **Optimize schedule (orchestrator)** | `ai-orchestrator.js` | CODE | Generic task prompt; behavior in deterministicOptimize, chooseBestProvider, POLICY_PROFILES, greedy logic |
| **Simulate scenario** | `ai-orchestrator.js` | CODE | deterministicSimulate with hardcoded formulas (coverage − absences*3 − surge/10, etc.) |
| **Conflict detection** | `ai-orchestrator.js` | CODE | deterministicConflicts: all types (unassigned, missing_provider, skill_mismatch, time_off_violation, expired_credential, double_booked, max_shifts) hardcoded |
| **Explain decision (orchestrator fallback)** | `ai-orchestrator.js` | CODE | deterministicExplain returns fixed string; no outcome-defining prompt |
| **Copilot response per intent** | `ai-orchestrator.js` (buildCopilotResponse) | CODE | responses object: fixed message, suggestions, actions per intent; new intents = code change |
| **Policy profiles / rollout** | `ai-orchestrator.js` | CODE | POLICY_PROFILES, POLICY_AUTO_APPLY_THRESHOLD, evaluateRolloutReadiness, evaluateGuardrails all hardcoded |
| **Rule guardrail warning** | `ai-orchestrator.js` (buildRuleGuardrailWarning) | CODE | Regex + fixed warning message and suggestions |
| **Contextual recommendations** | `ai-orchestrator.js` (buildContextualRecommendations) | CODE | Weekend vs weekday, selected provider logic in code |
| **Orchestrator: is optimal** | `server/agents/scheduling-orchestrator.js` | CODE | complianceScore === 100, coverageScore >= 95 hardcoded |
| **Orchestrator: optimization flow** | `server/agents/scheduling-orchestrator.js` | CODE | Phase 1/2/3, iteration loop, compliance recheck — orchestration logic in code |
| **NLP Assistant: execute action** | `server/ai-services/nlp-assistant.js` | CODE | switch(intent) → findProvider, assignShift, checkSchedule, rankProviders, validateAssignment, suggestAlternatives all in code |
| **Anomaly: coverage/skill/ACGME/consecutive/workload/weekend/burnout** | `server/ai-services/anomaly-detector.js` | CODE | Each rule: check function with hardcoded thresholds and message templates |
| **Demand forecast** | `server/ai-services/demand-forecast.js` | CODE | calculateBaseDemand, applyExternalFactors, getFluLevel, isHoliday, getDefaultPatterns — no prompts |
| **Preference learning** | `server/ai-services/preference-learning.js` | CODE | analyzeShiftTypePreference, analyzeDayOfWeekPreference, getShiftRecommendation scoring — all code |
| **Natural language query (client)** | `src/lib/ai/naturalLanguageQuery.ts` | CODE | parseQuery (regex, determineIntent, extractDate), executeQuery (switch on intent) — no LLM |
| **Excel structure parsing** | `ai-orchestrator.js` (parseExcelStructure) | PROMPT | Task description in natural language; fallback is code |

---

## Score: 12 / 28 (43%)

- **Prompt-defined:** 12 (Coverage, Fairness, Preference, Compliance, Director agents; orchestrator explain; Copilot intent parsing; NLP classify/extract/generate; anomaly pattern; Excel parse).
- **Code-defined:** 16 (recommendations, optimize, simulate, conflicts, explain fallback, Copilot responses, policy/rollout, guardrails, contextual recommendations, orchestrator optimal/flow, NLP execute action, anomaly rule checks, demand forecast, preference learning, naturalLanguageQuery).

---

## Code-Defined Features (Anti-Pattern)

1. **Recommendations / optimize / conflicts / explain (ai-orchestrator)**  
   Single generic prompt: `You are an ICU scheduling copilot. Task: ${task}. Return JSON only.` Outcome is not specified; behavior is effectively the deterministic fallback. Changing what “recommend” or “optimize” means requires editing code, not prompts.

2. **Copilot response text and actions**  
   `buildCopilotResponse` uses a fixed `responses` map (message, suggestions, actions per intent). Adding or changing intents or copy requires code changes.

3. **Policy profiles and rollout**  
   `POLICY_PROFILES`, `POLICY_AUTO_APPLY_THRESHOLD`, and rollout/guardrail evaluation are constants and functions. Tuning priorities or thresholds requires code edits.

4. **Conflict types and messages**  
   `deterministicConflicts` encodes every conflict type and message. New violation types or wording require code changes.

5. **Anomaly rules (non-pattern)**  
   coverageGaps, skillGaps, acgmeViolation, consecutiveShifts, workloadImbalance, weekendImbalance, burnoutRisk are implemented as code with fixed thresholds and text.

6. **NLP execute action**  
   Intent-to-action is a switch plus helpers (findProvider, assignShift, etc.). New behaviors or ranking logic require code.

7. **Demand forecast & preference learning**  
   Purely algorithmic; no prompts defining outcomes.

8. **Client naturalLanguageQuery**  
   Intent and entity logic are regex/pattern-based; no prompt-defined behavior.

9. **Orchestrator “optimal” and flow**  
   Thresholds (e.g. compliance 100, coverage ≥ 95) and phase/iteration logic are hardcoded.

---

## Recommendations

1. **Move orchestrator tasks to outcome-defining prompts**  
   For `recommendations`, `optimize`, `conflicts`, and `explain`, add dedicated prompts (e.g. in a prompts module or config) that define the desired outcome, output shape, and guardrails in natural language. Keep deterministic paths as fallbacks when LLM is unavailable, but treat the prompt as the source of truth for behavior.

2. **Externalize Copilot response content**  
   Store per-intent message, suggestions, and action templates in config or CMS (or prompt templates) so copy and suggested actions can change without code deploys. Optionally use a single “response generator” prompt that takes intent + entities and returns message + suggestions + actions.

3. **Policy and rollout as configuration**  
   Move policy profile names, weights, and auto-apply thresholds to config (env or config file). Consider a small “policy interpreter” prompt that takes current state + policy name and returns recommended mode (shadow / human_review / auto_apply) and reason.

4. **Conflict and anomaly rules as prompt or config**  
   Either (a) define conflict/anomaly “rules” in a prompt (e.g. “Given this schedule and these rule definitions, list violations with type, severity, and message”) or (b) keep detection in code but externalize messages and severity per rule type in config so wording and severity can change without code changes.

5. **NLP execute action**  
   For complex or evolving actions, consider a single “scheduling action” prompt that takes intent + entities + context and returns a structured action (type, parameters, confirmation message). Use current code as fallback or for simple, stable intents.

6. **Single source of truth for “prompt-defined”**  
   Collect all outcome-defining prompts (agents, intent, explain, recommendations, optimize, etc.) in one place (e.g. `server/prompts/` or `config/prompts.json`) with clear ownership so “behavior change = edit prompt” is consistent and auditable.

7. **Document prompt vs code boundary**  
   In the repo, document which features are prompt-defined vs code-defined and how to change each (e.g. in this audit or a CONTRIBUTING section) so new work stays prompt-native where intended.
