# CRUD Completeness Audit

**Scope:** Entities in store.ts, Supabase schema, and server/API layer.  
**Criteria:** Agent-accessible tools or APIs (store actions + `src/lib/api/*`) providing Create, Read, Update, Delete.

---

## CRUD Completeness Audit

### Entity CRUD Analysis

| Entity | Create | Read | Update | Delete | Score (full CRUD?) |
|--------|--------|------|--------|--------|--------------------|
| **slots** | Yes (setScheduleRange / saveScheduleState upsert) | Yes (store, loadScheduleState) | Yes (assignShift) | Yes (saveScheduleState sync / clearAssignments) | Yes |
| **providers** | Yes (addProvider, registerProvider) | Yes (store, loadScheduleState) | Yes (updateProvider) | Yes (removeProvider, saveScheduleState) | Yes |
| **scenarios** | Yes (createScenario) | Yes (store) | No | Yes (deleteScenario) | No |
| **templates** | Yes (createTemplate) | Yes (store) | No | Yes (deleteTemplate) | No |
| **shift_requests** | Yes (createShiftRequest) | Yes (listShiftRequests) | Yes (reviewShiftRequest) | Yes (deleteShiftRequest) | Yes |
| **swap_requests** | Yes (createSwapRequest) | Yes (store) | Yes (approve/reject/cancel) | Yes (cancelSwapRequest) | Yes |
| **custom_rules** | Yes (addCustomRule) | Yes (store) | No | Yes (removeCustomRule) | No |
| **notifications** | Yes (sendNotification, store + API) | Yes (store, listNotificationHistory) | Yes (updateNotification) | Yes (deleteNotification) | Yes |
| **holidays** | Yes (addHolidayAssignment) | Yes (store) | No | Yes (removeHolidayAssignment) | No |
| **conflicts** | Yes (detectConflicts) | Yes (store) | Yes (acknowledgeConflict, resolveConflict) | Yes (ignoreConflict) | Yes |
| **copilot_conversations** | Yes (createConversation) | Yes (store) | Yes (addMessageToConversation) | Yes (deleteConversation) | Yes |
| **apply_history** | No | Yes (fetchApplyHistory, fetchApplyHistorySummary) | No | No | No |
| **preference_models** | Yes (analyzeProviderPatterns) | Yes (store, getProviderPreferenceProfile) | No | No | No |
| **anomaly_alerts** | No | Yes (useAnomalyAlerts / GET /api/ai/anomalies/alerts) | No | No | No |
| **profiles** | Yes (via auth trigger on signup) | No dedicated API | No | No | No |
| **audit_logs** | Yes (implicit via store actions) | Yes (store, loadScheduleState) | No | No | No |
| **email_events** | Yes (submitInboundEmail) | Yes (listEmailEvents) | Yes (updateEmailEvent) | Yes (deleteEmailEvent) | Yes |
| **global_settings** | N/A (single config key) | Yes (loadScheduleState) | Yes (saveScheduleState) | N/A | Partial |

---

### Overall Score: **9 / 18** entities with full CRUD (**50%**)

*(Counting only entities where all four operations Create, Read, Update, Delete are present and meaningful. global_settings treated as partial.)*

---

### Incomplete Entities (missing operations)

| Entity | Missing operations |
|--------|--------------------|
| **scenarios** | Update (no `updateScenario`) |
| **templates** | Update (no `updateTemplate`) |
| **custom_rules** | Update (no `updateCustomRule`) |
| **holidays** | Update (no `updateHolidayAssignment`) |
| **apply_history** | Create, Update, Delete (read-only API; server-managed) |
| **preference_models** | Update, Delete (ML-generated; regenerate only) |
| **anomaly_alerts** | Create, Update, Delete (read-only API) |
| **profiles** | Read (dedicated), Update, Delete (no profile API; profile created by auth trigger) |
| **audit_logs** | Update, Delete (append-only via store; no per-entry update/delete) |

---

### Recommendations

1. **Add Update where useful**
   - **Scenarios:** Add `updateScenario(id, { name })` in store (and persist via schedule state if applicable).
   - **Templates:** Add `updateTemplate(id, partial)` in store so name/description/pattern can be edited without delete+recreate.
   - **Custom rules:** Add `updateCustomRule(id, partial)` in store.
   - **Holidays:** Add `updateHolidayAssignment(holidayName, date, partial)` in store (e.g. change provider or shift type).

2. **Apply history**
   - Keep as read-only from the client; ensure server documents that apply records are system-generated. If agents need to “record” an apply, add a dedicated “record apply” API that only creates; no client-side update/delete.

3. **Preference models (preference_profiles)**
   - Treat as derived data: document that “update” = re-run `analyzeProviderPatterns`, and “delete” = clear or overwrite. Optionally add `clearPreferenceProfile(providerId)` and/or `regeneratePreferenceProfiles()` for clarity.

4. **Anomaly alerts**
   - If alerts are system-generated only, document read-only. If agents/schedulers should dismiss or resolve alerts, add `updateAnomalyAlert(id, { acknowledged, resolved })` and/or `deleteAnomalyAlert(id)` (or equivalent) in API and wire to store/UI.

5. **Profiles**
   - Add a small profile API: `getProfile(id)`, `updateProfile(id, payload)` (and optionally `listProfiles`). Keep create via auth trigger; add delete only if business rules allow (e.g. soft-delete or admin-only).

6. **Audit logs**
   - Keep append-only. If needed, add read API (e.g. `listAuditLogs(filters)`) for reporting; do not add update/delete unless compliance explicitly requires redaction.

7. **Agent tool surface**
   - Ensure `fetchAgentTools()` (or equivalent) exposes all of the above CRUD operations so agents can create, read, update, and delete entities where supported.

8. **Persistence parity**
   - Entities that live only in the store (e.g. swap_requests, scenarios, templates, holidays, copilot_conversations) are persisted via `global_settings.schedule_config` in `saveScheduleState` / `loadScheduleState`. Confirm that all of these are included in the persisted blob and loaded on init so agent and user actions survive refresh and rehydration.
