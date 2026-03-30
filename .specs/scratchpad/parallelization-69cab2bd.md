# Parallelization Plan: Smart Neuro ICU Hub Implementation

**Generated:** 2026-03-30
**Source Task:** .specs/tasks/todo/implement-smart-neuro-icu-hub.feature.md

---

## Dependency Graph Analysis

```
Step 1 (Types/Store)
    │
    ├──► Step 2 (Marketplace Backend) ──┐
    ├──► Step 3 (Broadcast Backend)   │ ──► Step 5 (API Clients)
    ├──► Step 4 (Copilot Backend)      │              │
    │                                                 ▼
    │                                         Step 6 (Hooks)
    │                                      ╱        │        ╲
    │                                  Step 7   Step 8   Step 9
    │                                   (UI)     (UI)     (UI)
    │                                      ╲        │        ╱
    │                                       ◄───────▼───────►
    │                                                 │
    ▼                                         Step 10 (Integration)
```

### Key Findings:

1. **Step 1 is the bottleneck** - All other steps depend on it for types
2. **Steps 2,3,4 can run in parallel** - All only depend on Step 1 types
3. **Step 5 must wait for backend** - API clients need routes defined
4. **Step 6 depends on both 1 and 5** - Needs types + API functions
5. **Steps 7,8,9 can run in parallel** - All depend only on hooks
6. **Step 10 is sequential** - Needs everything integrated

---

## Execution Waves

| Wave | Steps | Parallel? | Dependencies |
|------|-------|-----------|-------------|
| **Wave 1** | Step 1 | No | None (foundational) |
| **Wave 2** | Steps 2,3,4 | YES | Step 1 |
| **Wave 3** | Step 5 | No | Wave 2 (2,3,4) |
| **Wave 4** | Step 6 | No | Steps 1 + 5 |
| **Wave 5** | Steps 7,8,9 | YES | Step 6 |
| **Wave 6** | Step 10 | No | All previous |

---

## Agent Assignments

| Step | Complexity | Agent | Rationale |
|------|------------|-------|-----------|
| Step 1 | Medium | sonnet | TypeScript types + Zustand store - moderate complexity |
| Step 2 | Complex | opus | Marketplace API with state machine - most complex backend |
| Step 3 | Complex | opus | Broadcast with auto-escalation - complex logic |
| Step 4 | Medium | sonnet | NLP parser - moderate complexity |
| Step 5 | Simple | haiku | API client wrappers - straightforward |
| Step 6 | Medium | sonnet | React hooks with business logic |
| Step 7 | Medium | sonnet | Marketplace UI components |
| Step 8 | Medium | sonnet | Broadcast/Copilot UI components |
| Step 9 | Medium | sonnet | Profile + Hub integration |
| Step 10 | Medium | sonnet | Integration testing |

---

## Estimated Time per Wave

| Wave | Steps | Est. Time | Total Parallel Effort |
|------|-------|-----------|---------------------|
| Wave 1 | 1 | 30 min | 30 min |
| Wave 2 | 3 | 45 min each | 45 min (parallel) |
| Wave 3 | 5 | 20 min | 20 min |
| Wave 4 | 6 | 30 min | 30 min |
| Wave 5 | 7,8,9 | 40 min each | 40 min (parallel) |
| Wave 6 | 10 | 60 min | 60 min |

**Total sequential time:** ~225 min (3.75 hours)
**Total parallel time:** ~225 min (same, but better resource utilization)
**Speedup:** Better due to parallel execution reducing context switching

---

## Execution Order Recommendations

### Immediate Actions:
1. **Start Step 1 first** - This blocks everything
2. **While Step 1 reviewing**, prepare Step 2,3,4 in parallel
3. **After Steps 2,3,4**, immediately start Step 5

### Parallel Execution Strategy:
- **Wave 2**: Fire Steps 2,3,4 simultaneously using 3 sub-agents
- **Wave 5**: Fire Steps 7,8,9 simultaneously using 3 sub-agents

---

## Blockers to Monitor

1. **Step 1 types conflict** - If types conflict with existing Provider fields
2. **Wave 2 API consistency** - Ensure 2,3,4 use consistent response formats
3. **Step 5-6 handoff** - API response types must match hook expectations
4. **Step 10 integration** - Full system test may reveal cross-cutting issues
