# AI Copilot Panel — Design Document

**Date:** 2026-03-03  
**Status:** Approved  
**Approach:** AI Copilot Panel with Natural Language Interface

---

## 1. Executive Summary

This document outlines the design for an AI Copilot Panel that brings natural language interaction and contextual intelligence to the Neuro ICU Scheduler. The copilot provides a chat-based interface for schedule operations, inline contextual suggestions, and visual previews of AI-recommended changes.

### Key Goals
- Reduce cognitive load for schedulers through natural language commands
- Surface relevant suggestions based on current context (selected dates, providers)
- Build trust through transparent explanations and confidence scores
- Maintain human control with preview-before-apply workflows

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           React Frontend                                │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌──────────┐ │
│  │   Copilot   │◄──►│   Intent    │◄──►│   Context   │◄──►│ Suggestion│ │
│  │   Panel UI  │    │   Router    │    │   Manager   │    │ Renderer  │ │
│  └──────┬──────┘    └─────────────┘    └─────────────┘    └──────────┘ │
│         │                                                               │
│         │ WebSocket / SSE (real-time updates)                          │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Express Backend                             │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────┐ │   │
│  │  │ NLU Parser  │──►│  Intent     │──►│  Action     │──►│ Schedule│ │   │
│  │  │  (LLM)      │  │  Handler    │  │  Executor   │  │  Store  │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────┘ │   │
│  │         │                                              │         │   │
│  │         ▼                                              ▼         │   │
│  │  ┌─────────────┐                                ┌─────────────┐  │   │
│  │  │ Recommendation│                              │  Zustand    │  │   │
│  │  │   Engine    │◄──────────────────────────────►│  (Client)   │  │   │
│  │  └─────────────┘                                └─────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **WebSocket/SSE** | Real-time streaming responses create conversational feel |
| **Intent Router** | Separates NLU from execution; enables deterministic fallback |
| **Context Manager** | Maintains conversation state + schedule view context |
| **Action Executor** | Transforms intents into concrete schedule operations |

---

## 3. Copilot Panel UI Design

### 3.1 Layout Integration

The copilot panel is a **collapsible sidebar** (right side, 380px width):

```
┌─────────────────────────────────────────────────────────────────┐
│  Header    [Week View] [Month View]          [🤖 Copilot ▼]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────┐  ┌───────────────────┐ │
│  │                                    │  │  🤖 Schedule AI   │ │
│  │     Calendar Grid                  │  │  ─────────────────│ │
│  │     (existing)                     │  │                   │ │
│  │                                    │  │  👤 How can I     │ │
│  │                                    │  │     help with     │ │
│  │                                    │  │     your schedule?│ │
│  │                                    │  │                   │ │
│  │                                    │  │  ─────────────────│ │
│  │                                    │  │  [Type a message] │ │
│  │                                    │  └───────────────────┘ │
│  └────────────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Panel States

#### Collapsed (Icon Button)
- Floating action button when minimized
- Red badge indicator when AI has new suggestions

#### Expanded (Active Chat)
```
┌─────────────────────────────────┐
│  🤖 Schedule AI          [─] [×]│
├─────────────────────────────────┤
│                                 │
│  👤 AI: How can I help...       │
│                                 │
│  🧑‍⚕️ I need next Friday off      │
│                                 │
│  👤 AI: I'll check coverage...  │
│     [Analyzing...] ████████░░   │
│                                 │
│  👤 Found 2 options:            │
│     1. Swap with Dr. Smith      │
│        [Preview] [Accept]       │
│     2. Mark as request          │
│        [Create Request]         │
│                                 │
├─────────────────────────────────┤
│  [🎤] Type a message...    [➤] │
└─────────────────────────────────┘
```

#### Inline Suggestion Mode
When user clicks a shift, AI shows contextual quick actions:
```
┌─────────────────────────────────┐
│  📅 Mon, Mar 10 — Night Shift   │
├─────────────────────────────────┤
│  Current: Dr. Johnson           │
│                                 │
│  🤖 AI Suggestions:             │
│  ┌─────────────────────────┐   │
│  │ Swap with Dr. Lee?      │   │
│  │ (better fairness score) │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ Check coverage if empty │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

---

## 4. Intent Recognition System

### 4.1 Supported Intents (Phase 1)

| Intent | Example Utterance | Action |
|--------|------------------|--------|
| `request_time_off` | "I need March 15th off" | Create time-off request |
| `request_swap` | "Swap my night shift with Sarah" | Initiate swap workflow |
| `optimize_schedule` | "Balance the night shifts better" | Run optimization |
| `check_coverage` | "Who's covering next weekend?" | Query coverage |
| `explain_assignment` | "Why am I on call Saturday?" | Decision explanation |
| `simulate_scenario` | "What if Dr. Smith is sick?" | Run simulation |
| `get_recommendations` | "How can we improve this schedule?" | Generate recommendations |
| `show_conflicts` | "Are there any scheduling conflicts?" | Conflict detection |
| `adjust_preferences` | "I prefer fewer weekends" | Update provider prefs |

### 4.2 Intent Router

```typescript
interface Intent {
  name: string;
  confidence: number;
  entities: Record<string, unknown>;
  originalText: string;
}

async function routeIntent(
  text: string, 
  context: ScheduleContext
): Promise<IntentResult> {
  // 1. Try LLM-based NLU first
  const llmIntent = await parseWithLLM(text, context);
  
  // 2. Fallback to rule-based if LLM fails/low confidence
  if (!llmIntent || llmIntent.confidence < 0.7) {
    return parseWithRules(text);
  }
  
  return llmIntent;
}
```

### 4.3 Context-Aware Prompting

The AI maintains context from:
- **Current view**: Week/Month, visible date range
- **Selected items**: Currently selected provider, shift, date
- **Conversation history**: Last 5 exchanges
- **User role**: Admin/Scheduler/Clinician (tailored responses)

---

## 5. Backend API Enhancements

### 5.1 New Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/copilot/chat` | POST | Main chat endpoint (streaming) |
| `/api/copilot/intent` | POST | Parse intent only (no execution) |
| `/api/copilot/stream` | GET | SSE stream for async operations |
| `/api/copilot/history` | GET | Get conversation history |
| `/api/copilot/suggestions` | GET | Contextual inline suggestions |

### 5.2 Streaming Response Format

```typescript
interface CopilotEvent {
  type: 'thinking' | 'intent_detected' | 'action_preview' | 
        'confirmation_request' | 'result' | 'error';
  payload: unknown;
}

// Example streaming flow:
// 1. {"type":"thinking","payload":{"message":"Analyzing..."}}
// 2. {"type":"intent_detected","payload":{"intent":"request_time_off"}}
// 3. {"type":"action_preview","payload":{"changes":[...]}}
// 4. {"type":"confirmation_request","payload":{"message":"Apply?"}}
// 5. {"type":"result","payload":{"success":true}}
```

### 5.3 Enhanced AI Orchestrator

Additions to `ai-orchestrator.js`:

```javascript
// Context-aware recommendation engine
function buildContextualRecommendations(input, context) {
  const base = deterministicRecommendations(input, context.provider);
  
  if (context.viewType === 'week' && context.selectedDate) {
    base.recommendations.push(
      generateDaySpecificRecommendations(context.selectedDate)
    );
  }
  
  return base;
}

// Natural language to intent parsing
async function parseIntent(input, context) {
  const prompt = buildIntentPrompt(input.text, context);
  // LLM call with structured output
}
```

---

## 6. Suggestion Rendering & Interaction

### 6.1 Suggestion Card Types

#### Schedule Change Preview
```
┌─────────────────────────────────┐
│  📊 Optimization Result         │
├─────────────────────────────────┤
│  Objective Score: 87 → 94 (+7)  │
│                                 │
│  Changes (3):                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  🔄 Swap Mon Night              │
│    Dr. Johnson → Dr. Lee        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ➕ Add Thu Day                 │
│    Dr. Smith (was unassigned)   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ➖ Remove Sat Night            │
│    Dr. Brown (over limit)       │
│                                 │
│  [❌ Decline]    [✅ Apply All] │
│  [🔍 Review Each]               │
└─────────────────────────────────┘
```

#### Conflict Warning
```
┌─────────────────────────────────┐
│  ⚠️ Conflict Detected           │
├─────────────────────────────────┤
│  Dr. Martinez assigned twice    │
│  on Mar 15                      │
│                                 │
│  🤖 Suggested Fix:              │
│    Move Night → Dr. Chen?       │
│                                 │
│  [Ignore] [Show Me] [Auto-Fix]  │
└─────────────────────────────────┘
```

#### Coverage Alert
```
┌─────────────────────────────────┐
│  🚨 Coverage Gap                │
├─────────────────────────────────┤
│  Next Saturday has no           │
│  Neuro-ICU coverage!            │
│                                 │
│  Available providers:           │
│  • Dr. Kim (was off)            │
│  • Dr. Patel (only 3 shifts)    │
│                                 │
│  [Ask Dr. Kim] [Find Float]     │
└─────────────────────────────────┘
```

### 6.2 User Feedback Loop

Every AI suggestion captures:
- Accept (immediate apply)
- Reject (with optional reason)
- Modify (user edits before applying)
- Ignore

Feedback trains local preference model for better future suggestions.

---

## 7. Error Handling & Edge Cases

| Scenario | Behavior |
|----------|----------|
| LLM API unavailable | Fallback to rule-based + "AI offline" badge |
| Ambiguous intent | Ask clarifying question with options |
| No eligible providers | Explain constraints, suggest alternatives |
| Multiple valid solutions | Show Pareto options (fairness vs coverage) |
| User rejects many suggestions | Reduce suggestion frequency temporarily |
| Conflicting requests | Maintain history, allow "undo conversation" |

### Graceful Degradation

```
AI Confidence: ████████░░ 82%
Mode: Human Review Recommended

[This suggestion needs approval because:
 • Coverage impact is significant
 • Dr. Smith is near their weekly limit]
```

---

## 8. Implementation Phases

### Phase 1: Core Copilot (Weeks 1-2)
- Collapsible panel UI
- Basic intent recognition (5 core intents)
- Chat interface with streaming
- `/api/copilot/chat` endpoint

### Phase 2: Smart Suggestions (Weeks 3-4)
- Inline contextual suggestions
- Schedule change previews
- Accept/reject flow

### Phase 3: Advanced Features (Weeks 5-6)
- NLU enhancement with entity extraction
- Conversation history
- Personalization based on feedback

### Phase 4: Polish (Week 7)
- Voice input
- Keyboard shortcuts
- Mobile responsiveness

---

## 9. Files to Create/Modify

### New Files
| Path | Description |
|------|-------------|
| `/src/components/CopilotPanel.tsx` | Main copilot panel component |
| `/src/components/CopilotChat.tsx` | Chat message list and input |
| `/src/components/SuggestionCard.tsx` | Reusable suggestion preview cards |
| `/src/lib/intentRouter.ts` | Intent parsing and routing logic |
| `/src/lib/copilotContext.ts` | Context management for copilot |
| `/src/hooks/useCopilot.ts` | React hook for copilot state |
| `/src/hooks/useCopilotStream.ts` | SSE streaming hook |

### Modified Files
| Path | Changes |
|------|---------|
| `/server.js` | Add `/api/copilot/*` endpoints |
| `/ai-orchestrator.js` | Add NLU and contextual recommendation functions |
| `/src/components/App.tsx` | Integrate copilot panel toggle |
| `/src/components/Calendar.tsx` | Add inline suggestion triggers |
| `/src/store.ts` | Add copilot conversation state |

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| Intent Recognition Accuracy | >85% |
| User Satisfaction Score | >4.0/5.0 |
| Schedule Edit Time Reduction | >30% |
| AI Suggestion Acceptance Rate | >60% |
| Fallback to Deterministic | <20% of requests |

---

## 11. Security & Privacy Considerations

- All LLM calls use anonymized provider identifiers (no PHI in prompts)
- Conversation history stored locally (localStorage) by default
- Optional server-side history with encryption at rest
- User can delete conversation history anytime
- Role-based intent restrictions (clinicians can't run full optimization)

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-03  
**Next Step:** Implementation plan creation
