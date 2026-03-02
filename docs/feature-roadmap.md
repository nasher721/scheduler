# Neuro ICU Scheduler: 5 High-Impact Feature Proposals and Delivery Plan

This document proposes five product features that build on the existing scheduling, analytics,
scenario, and AI-assist capabilities.

## 1) Credentialing and Competency Expiration Management

### Why it matters
The scheduler already understands skills, but ICU staffing also depends on **active credentials**
(ACLS, NIHSS, stroke certification, annual competencies). Preventing assignments to expired or
soon-to-expire clinicians reduces clinical risk and rework.

### Scope
- Add credential records per staff member with:
  - `credentialType`
  - `issuedAt`
  - `expiresAt`
  - `status` (`active`, `expiring_soon`, `expired`, `pending_verification`)
- Add hard guardrail: block expired credentials from assignment.
- Add soft warning: highlight assignments with credentials expiring within configurable threshold
  (e.g., 30 days).
- Add dashboard widget: upcoming expirations by unit role.

### Delivery plan
1. **Data model + validation**
   - Extend state schema for staff credential objects.
   - Add server-side validation in `PUT /api/state`.
2. **Scheduling integration**
   - Enforce expired credential block in deterministic assignment pass.
   - Add warning tags in shift cards for near-expiry credentials.
3. **UI + analytics**
   - Add a credential panel in staff detail drawer/form.
   - Add risk tile for expiring/expired counts.
4. **Operational rollout**
   - Import helper for initial credential data.
   - Feature flag rollout for pilot roster first.

---

## 2) Demand Forecasting + Census-Aware Staffing Recommendations

### Why it matters
Current schedules can be optimized for constraints, but forward-looking staffing should incorporate
predicted census acuity and surge trends.

### Scope
- Add baseline forecasting API:
  - input: historical census + acuity trend
  - output: recommended staffing matrix by date/shift
- Add variance visualization:
  - planned coverage vs forecasted demand.
- Add risk bands (`low`, `moderate`, `high`) when predicted demand exceeds staffing.

### Delivery plan
1. **Forecast input pipeline**
   - Add endpoint for uploading/importing historical demand snapshots.
   - Normalize and store demand history for model use.
2. **Forecast service**
   - Implement deterministic baseline model first (moving average / weighted trend).
   - Keep model behind provider-agnostic interface for future ML upgrade.
3. **Planner integration**
   - Add recommendation deltas into `POST /api/ai/recommendations` payload.
   - Display suggested reinforcement shifts.
4. **Monitoring and calibration**
   - Track forecast error weekly.
   - Add recalibration controls and confidence intervals.

---

## 3) Fatigue and Rest-Window Safety Rules

### Why it matters
Clinical safety and retention benefit from fatigue-aware scheduling. Current constraint handling can
be extended with evidence-based rest windows and consecutive-night protections.

### Scope
- Add configurable fatigue policy profile:
  - minimum hours between shifts
  - max consecutive nights
  - max shifts in rolling 7 days
  - protected recovery day after night block
- Add “fatigue risk score” per person and per schedule.
- Add auto-suggest alternatives for high-risk assignments.

### Delivery plan
1. **Policy engine extension**
   - Add fatigue policy object to schedule config.
   - Add hard + soft fatigue checks in conflict analysis endpoint.
2. **Risk scoring**
   - Compute schedule-level and individual fatigue metrics.
   - Persist metrics in analytics state.
3. **UX integration**
   - Inline warnings on assignment attempts violating fatigue policies.
   - One-click “fix high-fatigue assignments” recommendation.
4. **Governance rollout**
   - Start with warning-only mode.
   - Transition selected constraints to hard blocks after leadership approval.

---

## 4) Self-Service Availability and Shift Swap Workflow

### Why it matters
Schedulers spend significant time collecting updates through ad hoc channels. A controlled
self-service workflow reduces manual coordination and improves data freshness.

### Scope
- Staff availability submission window (vacation, education, shift preferences).
- Swap marketplace with rule checks before approval.
- Approval queue for charge nurse/scheduler.
- Full audit log for who requested/approved/rejected each action.

### Delivery plan
1. **Workflow primitives**
   - Add request entities (`availability_update`, `swap_request`) with lifecycle states.
2. **Rules + validation**
   - Reuse core scheduling guardrails to pre-validate proposed swaps.
3. **Reviewer UX**
   - Add queue views with diff preview before approval.
4. **Apply + rollback integration**
   - Route approved changes through existing apply-history + rollback pathways.

---

## 5) Automated Notifications and Escalation Playbooks

### Why it matters
When coverage is at risk, delays in communication cause overtime spikes and last-minute staffing
gaps. Automated alerts and escalation policies improve response times.

### Scope
- Triggered notifications for:
  - uncovered critical shifts
  - high fatigue risk
  - pending approvals nearing deadline
- Multi-channel delivery adapters (email/SMS/chat webhook).
- Escalation ladder by elapsed response time.
- Alert outcomes dashboard (acknowledged, resolved, escalated).

### Delivery plan
1. **Event framework**
   - Emit domain events from scheduling, approvals, and risk evaluations.
2. **Notification service**
   - Add templating + channel adapters with retry logic.
3. **Escalation engine**
   - Configurable policy by alert type and role.
4. **Observability**
   - Add delivery metrics, acknowledgment SLA, and incident trend reporting.

---

## Suggested Sequencing (Quarterly)

- **Q1 (Foundation):** Feature 1 + Feature 3 baseline policy engine.
- **Q2 (Operational efficiency):** Feature 4 end-to-end workflow with approvals.
- **Q3 (Proactive planning):** Feature 2 forecasting baseline + recommendations.
- **Q4 (Reliability at scale):** Feature 5 notifications + escalation + metrics hardening.

## Success Metrics

- Reduction in uncovered critical shifts.
- Reduction in manual schedule edits after publication.
- Reduction in fatigue-rule violations.
- Improvement in schedule approval turnaround time.
- Improvement in forecast-vs-actual staffing variance.
