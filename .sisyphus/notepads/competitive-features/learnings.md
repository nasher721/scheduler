# Competitive Features - Learnings

## 2026-04-13: Exploration Phase
- Backend has full AI endpoint suite: /api/ai/optimize, /api/ai/apply, /api/ai/rollback
- `multiAgentOptimize()` in src/lib/api/multiAgentOptimize.ts is the main client-side entry point
- `buildOptimizationPreview()` builds diff from optimization result
- `applyOptimizationResult()` calls /api/ai/apply with rollout mode
- Store has `autoAssign()` (lines 1600-1677) — client-side greedy constraint-based assignment
- `ProviderAvailabilityPanel.tsx` is 401 lines with per-slot availability checking
- `ShiftBoard.tsx` has marketplace with filtering, searching, claiming
- `pushNotifications.ts` is a full 288-line hook ready to use
- Store marketplace actions: postShiftForCoverage, claimShift, approveShift, cancelMarketplaceShift
- Pre-existing LSP warnings in App.tsx (button type props, hook deps) — NOT caused by us
