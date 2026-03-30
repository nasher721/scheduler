# Verification Scratchpad - Smart Neuro ICU Hub

## Overview

This scratchpad tracks the LLM-as-Judge verification sections added to each implementation step.

## Verification Summary by Step

| Step | Name | Level | Threshold | Verification Type |
|------|------|-------|-----------|-------------------|
| 1 | TypeScript Types & Store Extensions | Panel (HIGH) | 4.0/5.0 | Foundation - critical types and store |
| 2 | Backend API Routes - Core Marketplace | Panel (HIGH) | 4.0/5.0 | Backend - CRUD and state machine |
| 3 | Backend API Routes - Broadcast Service | Panel (HIGH) | 4.0/5.0 | Backend - notifications and escalation |
| 4 | Backend API Routes - AI Copilot Query | Panel (HIGH) | 4.0/5.0 | Backend - NLP processing |
| 5 | Frontend API Client Modules | Per-Item (MEDIUM) | 4.0/5.0 | Frontend - API wrappers |
| 6 | Custom Hooks for Business Logic | Per-Item (MEDIUM) | 4.0/5.0 | Frontend - React hooks |
| 7 | Frontend Components - Marketplace UI | Per-Item (MEDIUM) | 4.0/5.0 | Frontend - UI components |
| 8 | Frontend Components - Broadcast & Copilot UI | Per-Item (MEDIUM) | 4.0/5.0 | Frontend - UI components |
| 9 | Frontend Components - Provider Profiles & Smart Hub | Per-Item (MEDIUM) | 4.0/5.0 | Frontend - UI integration |
| 10 | Integration & Testing | Panel (HIGH) | 4.0/5.0 | Final - E2E and build |

## Verification Level Guidelines Applied

### Panel (HIGH) - Steps 1, 2, 3, 4, 10
- Backend criticality: routes, state machine, external integrations
- Requires comprehensive evaluation of all criteria together
- Weighted rubrics that sum to 1.0

### Per-Item (MEDIUM) - Steps 5, 6, 7, 8, 9
- Frontend components and integrations
- Individual item verification possible
- Weighted rubrics that sum to 1.0

## Rubric Weight Distribution

All verification rubrics follow the rule: **weights must sum to 1.0**

### Step 1 - Types & Store (Panel)
- All new types exported: 0.25
- pnpm typecheck passes: 0.25
- Store actions present: 0.25
- Fatigue middleware: 0.25

### Step 2 - Marketplace Backend (Panel)
- GET shifts returns: 0.20
- POST creates POSTED state: 0.20
- Claim transitions to CLAIMED: 0.20
- Approve transitions to APPROVED: 0.20
- Cancel validates state: 0.20

### Step 3 - Broadcast Backend (Panel)
- Dispatch sends notifications: 0.20
- Respects preferences: 0.20
- Creates history entry: 0.20
- Escalate triggers tier: 0.20
- Max tier limit: 0.20

### Step 4 - Copilot Backend (Panel)
- Accepts NLP input: 0.20
- Extracts name/date: 0.20
- Returns top 3 sorted: 0.20
- Response < 2s: 0.20
- Error handling: 0.20

### Step 5 - API Clients (Per-Item)
- Proper TS types: 0.25
- Correct endpoints: 0.25
- Error handling: 0.25
- Exports: 0.25

### Step 6 - Hooks (Per-Item)
- useMarketplace: 0.33
- useBroadcast: 0.33
- useFatigueCheck: 0.34

### Step 7 - Marketplace UI (Per-Item)
- ShiftCard: 0.17
- MyShifts: 0.17
- ShiftBoard: 0.17
- Filters: 0.17
- ClaimConfirmationModal: 0.16
- Mobile-responsive: 0.16

### Step 8 - Broadcast & Copilot UI (Per-Item)
- BroadcastPanel: 0.20
- EscalationTracker: 0.20
- BroadcastHistoryList: 0.20
- CopilotChatDrawer: 0.20
- CopilotQueryResult: 0.20

### Step 9 - Profiles & SmartHub (Per-Item)
- FatigueIndicator: 0.20
- Communication preferences: 0.20
- Auto-approve toggle: 0.20
- SmartHub integration: 0.20
- App.tsx routing: 0.20

### Step 10 - Integration (Panel)
- typecheck passes: 0.15
- build succeeds: 0.15
- tests pass: 0.15
- State machine: 0.20
- Broadcast preferences: 0.15
- AI Copilot < 2s: 0.20

## Notes

- Created: 2026-03-30
- Based on: implement-smart-neuro-icu-hub.feature.md
- Threshold: 4.0/5.0 consistent across all steps
