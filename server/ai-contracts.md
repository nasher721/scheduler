# AI schedule API contracts

Canonical request/response shapes for AI apply and rollback. Use for client code, agents, and tests.

## POST /api/ai/apply

Apply an optimized schedule state. Requires `rollout.mode` other than `shadow` and `approvedBy` when mode is `human_review`.

### Request body

```ts
{
  result: {
    optimizedState: {
      providers: Array<{ id, name, email?, role?, ... }>;
      slots: Array<{ id, date, type, providerId?, ... }>;
      startDate: string;   // YYYY-MM-DD
      numWeeks: number;
      scenarios?: unknown[];
      customRules?: unknown[];
      auditLog?: unknown[];
    };
    rollout?: {
      mode: "human_review" | "auto_apply";
      confidenceScore?: number;
    };
    objectiveScore?: number;
    guardrails?: { hardViolationCount?: number };
  };
  approvedBy?: string;  // required when rollout.mode === "human_review"
}
```

### Success response (200)

```ts
{
  ok: true;
  applyId: string;
  rolloutMode: string;
  approvedBy: string | null;
  recorded?: object;
  state: PersistedScheduleState;
  updatedAt: string;  // ISO 8601
}
```

### Errors

- **400** – Missing or invalid `result` / `optimizedState`; or `human_review` without `approvedBy`.
- **409** – `rollout.mode === "shadow"` (use recommend/optimize only, do not apply).

---

## POST /api/ai/rollback

Revert a prior apply by `applyId`.

### Request body

```ts
{
  applyId: string;
  rolledBackBy: string;
  reason?: string;
}
```

### Success response (200)

```ts
{
  ok: true;
  applyId: string;
  rolledBackBy: string;
  recorded?: object;
  state: PersistedScheduleState;
  updatedAt: string;
}
```

### Errors

- **400** – Missing `applyId` or `rolledBackBy`.
- **404** – No apply record for `applyId`.
- **409** – Record already rolled back or stored state invalid.

---

## GET /api/ai/agents/optimize/result

Returns the last multi-agent optimization result from shared memory (from the most recent POST /api/ai/agents/optimize). Use for polling after async runs.

### Success response (200)

Same shape as the object returned by POST /api/ai/agents/optimize (e.g. `success`, `schedule`, `decisions`, `metrics`, `duration`).

### Errors

- **404** – No result available (run optimize first).
