# App Improvements & Implementation Plan

This plan proposes five high-impact improvements for the Neuro ICU Scheduler, prioritized to improve safety, scheduling quality, and operational speed.

## 1) Credential Compliance Guardrails

### Improvement
Add credential validity awareness (active, expiring soon, expired) directly into assignment logic and dashboards.

### Why
Schedulers should not accidentally assign clinicians with expired critical certifications.

### Implementation plan
1. Extend provider/staff model with credential entries (`type`, `issuedAt`, `expiresAt`, `status`).
2. Add server validation in `PUT /api/state` and reject invalid credential shapes.
3. Block assignments for expired credentials in scheduling logic.
4. Add UI warnings for soon-to-expire credentials and an analytics tile for expiring counts.
5. Add import mapping support for credential fields in Excel workflows.

### Success metric
- 0 assignments with expired credentials after rollout.

---

## 2) Fatigue & Rest-Window Safety Policy Engine

### Improvement
Introduce configurable fatigue rules (minimum rest, max consecutive nights, max rolling weekly shifts).

### Why
Fatigue-aware scheduling improves clinician safety, retention, and policy compliance.

### Implementation plan
1. Add policy config model in state (hard vs soft constraints).
2. Integrate fatigue checks into conflict analysis and assignment suggestions.
3. Compute per-clinician and schedule-level fatigue scores.
4. Add inline warnings and one-click “fix high-risk assignment” recommendations.
5. Roll out in warning-only mode first, then hard-enforce selected constraints.

### Success metric
- 30% reduction in fatigue-rule violations by quarter end.

---

## 3) Demand Forecasting + Coverage Gap Recommendations

### Improvement
Incorporate forecasted census/acuity trends to suggest proactive staffing adjustments.

### Why
Constraint-satisfying schedules can still underperform when demand surges are not forecasted.

### Implementation plan
1. Create demand-history ingestion endpoint and normalization storage.
2. Implement deterministic baseline forecasting (moving average + weighted trend).
3. Compare planned coverage against forecasted demand and label risk bands.
4. Feed recommendation deltas into AI recommendation and optimizer workflows.
5. Add weekly calibration reporting (forecast error + confidence range).

### Success metric
- 20% improvement in forecast-vs-staffing variance.

---

## 4) Self-Service Availability & Shift Swap Workflow

### Improvement
Enable staff to submit availability updates and request swaps through a controlled workflow.

### Why
Reduces scheduler back-and-forth and improves data freshness and transparency.

### Implementation plan
1. Add workflow entities for availability updates and swap requests.
2. Reuse scheduling guardrails to pre-validate swap feasibility.
3. Build reviewer queue with before/after diff previews.
4. Route approved changes through existing apply-history/rollback paths.
5. Add complete audit trail for request, review, and outcome events.

### Success metric
- 40% reduction in manual scheduling adjustments after publication.

---

## 5) Automated Notifications & Escalation Playbooks

### Improvement
Add event-driven alerts for uncovered critical shifts, high fatigue risk, and pending approvals.

### Why
Faster alerting reduces overtime spikes and unfilled high-priority shifts.

### Implementation plan
1. Emit domain events from scheduling, approvals, and analytics modules.
2. Implement notification templating and delivery adapters (email/SMS/webhook).
3. Add escalation policies by alert type, role, and elapsed response time.
4. Track delivery, acknowledgment, and resolution metrics.
5. Add operational dashboard for SLA and escalation trends.

### Success metric
- 25% faster mean time to acknowledgment for urgent staffing risks.

---

## Recommended sequencing (2 quarters)

### Quarter 1 (Safety + Workflow)
- Credential Compliance Guardrails
- Fatigue & Rest-Window Safety Policy Engine (warning-first rollout)
- Self-Service Availability & Shift Swap foundation

### Quarter 2 (Proactive + Scale)
- Demand Forecasting + Coverage Gap Recommendations
- Automated Notifications & Escalation Playbooks
- Hardening pass on observability, policy tuning, and adoption metrics

## Delivery governance

- Ship each improvement behind feature flags.
- Include migration and rollback plans for data model changes.
- Define owner + KPI baseline before development starts.
- Review results in a monthly operating cadence and reprioritize backlog based on measured impact.
