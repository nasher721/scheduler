const DEFAULT_PROVIDERS = [
  { id: "openai", label: "OpenAI", models: ["gpt-4.1-mini", "gpt-4.1"], envKey: "OPENAI_API_KEY" },
  { id: "anthropic", label: "Anthropic", models: ["claude-3-5-sonnet-latest"], envKey: "ANTHROPIC_API_KEY" },
  { id: "google", label: "Google Gemini", models: ["gemini-2.0-flash"], envKey: "GEMINI_API_KEY" },
];

const POLICY_PROFILES = {
  balanced: {
    coverageCompletion: 0.35,
    fatigueRiskMinimization: 0.2,
    fairnessEquityDistribution: 0.2,
    preferenceSatisfaction: 0.15,
    continuityOfCare: 0.1,
  },
  safety_first: {
    coverageCompletion: 0.45,
    fatigueRiskMinimization: 0.25,
    fairnessEquityDistribution: 0.15,
    preferenceSatisfaction: 0.05,
    continuityOfCare: 0.1,
  },
  fairness_first: {
    coverageCompletion: 0.3,
    fatigueRiskMinimization: 0.15,
    fairnessEquityDistribution: 0.35,
    preferenceSatisfaction: 0.1,
    continuityOfCare: 0.1,
  },
};

const ROLLOUT_MODES = {
  SHADOW: "shadow",
  HUMAN_REVIEW: "human_review",
  AUTO_APPLY: "auto_apply",
};

const POLICY_AUTO_APPLY_THRESHOLD = {
  balanced: 88,
  safety_first: 92,
  fairness_first: 90,
};

const PROVIDER_PRICING_USD_PER_1K_TOKENS = {
  openai: 0.01,
  anthropic: 0.012,
  google: 0.005,
};

const providerMetrics = new Map();

const isArray = (value) => Array.isArray(value);
const isNightShift = (slot) => slot?.type === "NIGHT";

function getConfiguredProvider() {
  return (process.env.AI_DEFAULT_PROVIDER || "openai").toLowerCase();
}

function getProviderMeta(providerId) {
  return DEFAULT_PROVIDERS.find((provider) => provider.id === providerId) || DEFAULT_PROVIDERS[0];
}

function getPreferredModel(providerId) {
  const provider = getProviderMeta(providerId);
  return process.env.AI_MODEL || provider.models[0];
}

function listProviders() {
  const configuredProvider = getConfiguredProvider();
  return DEFAULT_PROVIDERS.map((provider) => ({
    ...provider,
    configured: provider.id === configuredProvider,
    enabled: Boolean(process.env[provider.envKey]),
  }));
}

function normalizeObjectiveWeights(input = {}) {
  const policy = String(input?.policyProfile || "balanced").toLowerCase();
  const base = POLICY_PROFILES[policy] || POLICY_PROFILES.balanced;
  const merged = { ...base, ...(input?.objectiveWeights || {}) };

  const keys = Object.keys(POLICY_PROFILES.balanced);
  const sum = keys.reduce((acc, key) => acc + (Number.isFinite(merged[key]) ? Math.max(0, merged[key]) : 0), 0);
  if (sum <= 0) return { policyProfile: policy, objectiveWeights: { ...base } };

  const normalized = Object.fromEntries(keys.map((key) => [key, Math.max(0, merged[key] || 0) / sum]));
  return { policyProfile: policy, objectiveWeights: normalized };
}

function summarizeState(state) {
  const providers = isArray(state?.providers) ? state.providers : [];
  const slots = isArray(state?.slots) ? state.slots : [];
  const assignedSlots = slots.filter((slot) => slot?.providerId).length;

  return {
    providers,
    slots,
    assignedSlots,
    unassignedSlots: Math.max(0, slots.length - assignedSlots),
    coveragePct: slots.length > 0 ? Math.round((assignedSlots / slots.length) * 100) : 0,
  };
}

function getWeekStart(dateString) {
  const date = new Date(dateString);
  const day = date.getUTCDay();
  const mondayDelta = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + mondayDelta);
  return monday.toISOString().slice(0, 10);
}

function getDayDiff(fromDate, toDate) {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

function updateNightShiftStats(stats, date) {
  const diff = stats.lastNightDate ? getDayDiff(stats.lastNightDate, date) : null;
  stats.consecutiveNights = diff === 1 ? stats.consecutiveNights + 1 : 1;
  stats.lastNightDate = date;
}

function applyAssignmentToProviderStats(stats, slot) {
  stats.totalAssigned += 1;
  stats.byDate.add(slot.date);

  const weekStart = getWeekStart(slot.date);
  stats.weekly.set(weekStart, (stats.weekly.get(weekStart) || 0) + 1);

  if (isNightShift(slot)) {
    updateNightShiftStats(stats, slot.date);
  }
}

function getMaxShiftsForProvider(state, providerId) {
  const rules = isArray(state?.customRules) ? state.customRules : [];
  const rule = rules.find((entry) => entry?.type === "MAX_SHIFTS_PER_WEEK" && entry?.providerId === providerId);
  return Number.isFinite(rule?.maxShifts) ? rule.maxShifts : Infinity;
}

function providerHasSkill(provider, skill) {
  if (!skill) return true;
  return isArray(provider?.skills) && provider.skills.includes(skill);
}

function isProviderUnavailable(provider, date) {
  const requests = isArray(provider?.timeOffRequests) ? provider.timeOffRequests : [];
  return requests.some((entry) => entry?.date === date);
}

function getCredentialStatus(credential, date) {
  if (!credential || typeof credential !== "object") return "active";
  if (credential.status === "pending_verification") return "pending_verification";
  if (!credential.expiresAt || typeof credential.expiresAt !== "string") return credential.status || "active";

  const target = new Date(`${date || new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const expiry = new Date(`${credential.expiresAt}T00:00:00Z`);
  if (Number.isNaN(target.valueOf()) || Number.isNaN(expiry.valueOf())) return credential.status || "active";
  return expiry < target ? "expired" : credential.status || "active";
}

function providerHasExpiredCredential(provider, date) {
  const credentials = isArray(provider?.credentials) ? provider.credentials : [];
  return credentials.some((credential) => getCredentialStatus(credential, date) === "expired");
}

function buildProviderStats(state) {
  const stats = new Map();
  const slots = isArray(state?.slots) ? state.slots : [];

  for (const provider of isArray(state?.providers) ? state.providers : []) {
    stats.set(provider.id, {
      totalAssigned: 0,
      byDate: new Set(),
      weekly: new Map(),
      consecutiveNights: 0,
      lastNightDate: null,
    });
  }

  const sorted = [...slots].sort((a, b) => String(a?.date).localeCompare(String(b?.date)));
  for (const slot of sorted) {
    if (!slot?.providerId || !stats.has(slot.providerId)) continue;
    const providerStats = stats.get(slot.providerId);
    applyAssignmentToProviderStats(providerStats, slot);
  }

  return stats;
}

function calculateAssignmentCounts(state) {
  const counts = new Map();
  const slots = isArray(state?.slots) ? state.slots : [];
  for (const slot of slots) {
    if (!slot?.providerId) continue;
    counts.set(slot.providerId, (counts.get(slot.providerId) || 0) + 1);
  }
  return counts;
}

function calculateStdDev(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function computeObjectiveBreakdown(state, input = {}) {
  const summary = summarizeState(state);
  const { policyProfile, objectiveWeights } = normalizeObjectiveWeights(input);
  const assignmentCounts = calculateAssignmentCounts(state);
  const providerList = isArray(state?.providers) ? state.providers : [];
  const assignmentVector = providerList.map((provider) => assignmentCounts.get(provider.id) || 0);
  const fairnessPenalty = calculateStdDev(assignmentVector) * 10;
  const fairnessScore = Math.max(0, 100 - fairnessPenalty);

  let nightSlots = 0;
  let nightWithRecoveryLimit = 0;
  for (const slot of isArray(state?.slots) ? state.slots : []) {
    if (!isNightShift(slot) || !slot?.providerId) continue;
    nightSlots += 1;
    const provider = providerList.find((entry) => entry.id === slot.providerId);
    if (Number.isFinite(provider?.maxConsecutiveNights)) nightWithRecoveryLimit += 1;
  }

  const fatigueScore = nightSlots === 0 ? 100 : Math.round((nightWithRecoveryLimit / nightSlots) * 100);
  const preferencePenalty = deterministicConflicts(state, "local").conflicts.filter((entry) => entry.type === "time_off_violation").length * 25;
  const preferenceScore = Math.max(0, 100 - preferencePenalty);
  const continuityScore = Math.max(0, 100 - Math.round(summary.unassignedSlots * 5));
  const coverageScore = summary.coveragePct;

  const weightedScore =
    coverageScore * objectiveWeights.coverageCompletion +
    fatigueScore * objectiveWeights.fatigueRiskMinimization +
    fairnessScore * objectiveWeights.fairnessEquityDistribution +
    preferenceScore * objectiveWeights.preferenceSatisfaction +
    continuityScore * objectiveWeights.continuityOfCare;

  return {
    policyProfile,
    objectiveWeights,
    objectiveBreakdown: {
      coverageCompletion: coverageScore,
      fatigueRiskMinimization: fatigueScore,
      fairnessEquityDistribution: Math.round(fairnessScore),
      preferenceSatisfaction: preferenceScore,
      continuityOfCare: continuityScore,
    },
    objectiveScore: Math.round(weightedScore),
  };
}

function evaluateGuardrails(state) {
  const analysis = deterministicConflicts(state, "local");
  const hardConstraintTypes = ["missing_provider", "skill_mismatch", "time_off_violation", "double_booked", "expired_credential"];
  const hardViolations = analysis.conflicts.filter((entry) => hardConstraintTypes.includes(entry.type));

  return {
    passed: hardViolations.length === 0,
    hardViolationCount: hardViolations.length,
    hardViolations,
  };
}

function evaluateRolloutReadiness({ objectives, guardrails, changes }) {
  const policyKey = objectives.policyProfile in POLICY_AUTO_APPLY_THRESHOLD ? objectives.policyProfile : "balanced";
  const autoApplyThreshold = POLICY_AUTO_APPLY_THRESHOLD[policyKey];
  const manualAssignments = (isArray(changes) ? changes : []).filter((change) => change?.action === "mark_for_manual_assignment").length;
  const hardViolationPenalty = guardrails.hardViolationCount * 40;
  const manualPenalty = manualAssignments * 12;
  const confidenceScore = Math.max(0, Math.min(100, objectives.objectiveScore - hardViolationPenalty - manualPenalty));
  const reasons = [];

  if (!guardrails.passed) reasons.push("Hard constraint violations detected.");
  if (manualAssignments > 0) reasons.push(`${manualAssignments} slot(s) still require manual assignment.`);
  if (confidenceScore < autoApplyThreshold) {
    reasons.push(`Confidence ${confidenceScore} is below auto-apply threshold ${autoApplyThreshold} for ${policyKey}.`);
  }

  const mode =
    guardrails.passed && manualAssignments === 0 && confidenceScore >= autoApplyThreshold
      ? ROLLOUT_MODES.AUTO_APPLY
      : confidenceScore >= Math.max(60, autoApplyThreshold - 20)
        ? ROLLOUT_MODES.HUMAN_REVIEW
        : ROLLOUT_MODES.SHADOW;

  return {
    mode,
    autoApplyEligible: mode === ROLLOUT_MODES.AUTO_APPLY,
    confidenceScore,
    autoApplyThreshold,
    reasons,
    metrics: {
      hardViolationCount: guardrails.hardViolationCount,
      manualAssignmentCount: manualAssignments,
      objectiveScore: objectives.objectiveScore,
    },
  };
}

function chooseBestProvider(state, slot, providerStats) {
  const providers = isArray(state?.providers) ? state.providers : [];
  const candidates = [];

  for (const provider of providers) {
    const stats = providerStats.get(provider.id);
    if (!stats) continue;
    if (!providerHasSkill(provider, slot?.requiredSkill)) continue;
    if (isProviderUnavailable(provider, slot?.date)) continue;
    if (providerHasExpiredCredential(provider, slot?.date)) continue;
    if (stats.byDate.has(slot?.date)) continue;

    const weekStart = getWeekStart(slot.date);
    const assignedThisWeek = stats.weekly.get(weekStart) || 0;
    const maxShifts = getMaxShiftsForProvider(state, provider.id);
    if (assignedThisWeek >= maxShifts) continue;

    if (isNightShift(slot)) {
      const maxConsecutive = Number.isFinite(provider?.maxConsecutiveNights) ? provider.maxConsecutiveNights : 99;
      const nextIsConsecutiveNight = stats.lastNightDate ? getDayDiff(stats.lastNightDate, slot.date) === 1 : false;
      const projectedConsecutiveNights = nextIsConsecutiveNight ? stats.consecutiveNights + 1 : 1;
      if (projectedConsecutiveNights > maxConsecutive) continue;
    }

    candidates.push({ provider, score: stats.totalAssigned * 100 + assignedThisWeek * 10 });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.score - b.score || a.provider.name.localeCompare(b.provider.name));
  return candidates[0].provider;
}

function deterministicRecommendations(input, provider) {
  const state = input?.state || input;
  const { providers, slots, unassignedSlots, coveragePct } = summarizeState(state);
  const objectives = computeObjectiveBreakdown(state, input);

  return {
    provider,
    source: "deterministic-fallback",
    summary: {
      totalProviders: providers.length,
      totalSlots: slots.length,
      unassignedSlots,
      coveragePct,
    },
    recommendations: [
      {
        id: "fill-critical-gaps",
        title: "Backfill uncovered critical slots",
        impact: unassignedSlots > 0 ? "high" : "low",
        rationale:
          unassignedSlots > 0
            ? `There are ${unassignedSlots} uncovered slots. Prioritize coverage before preference matching.`
            : "All slots are currently assigned. Maintain contingency float coverage.",
      },
      {
        id: "reduce-single-provider-load",
        title: "Reduce concentration risk",
        impact: "medium",
        rationale: "Spread weekly assignments evenly to improve fairness and reduce fatigue risk.",
      },
    ],
    ...objectives,
  };
}

function deterministicOptimize(input, provider) {
  const state = input?.state || input;
  const slots = isArray(state?.slots) ? structuredClone(state.slots) : [];
  const providerStats = buildProviderStats({ ...state, slots });
  const changes = [];

  const priorityRank = { CRITICAL: 0, STANDARD: 1 };
  const sortedSlots = [...slots].sort((a, b) => {
    const byPriority = (priorityRank[a?.priority] ?? 99) - (priorityRank[b?.priority] ?? 99);
    if (byPriority !== 0) return byPriority;

    if (isNightShift(a) !== isNightShift(b)) return isNightShift(a) ? -1 : 1;
    return String(a?.date || "").localeCompare(String(b?.date || ""));
  });

  for (const slot of sortedSlots) {
    if (slot.providerId) continue;

    const winner = chooseBestProvider(state, slot, providerStats);
    if (!winner) {
      changes.push({
        slotId: slot.id || null,
        action: "mark_for_manual_assignment",
        reason: "No eligible provider found given skill/time-off/rule constraints.",
      });
      continue;
    }

    slot.providerId = winner.id;
    const stats = providerStats.get(winner.id);
    applyAssignmentToProviderStats(stats, slot);

    changes.push({
      slotId: slot.id || null,
      action: "assign_provider",
      providerId: winner.id,
      reason: "Greedy solver assignment from eligible least-loaded candidate.",
    });
  }

  const optimizedState = { ...state, slots };
  const objectives = computeObjectiveBreakdown(optimizedState, input);
  const guardrails = evaluateGuardrails(optimizedState);
  const rollout = evaluateRolloutReadiness({ objectives, guardrails, changes });
  return {
    provider,
    source: "deterministic-fallback",
    objectiveScore: objectives.objectiveScore,
    objectiveBreakdown: objectives.objectiveBreakdown,
    objectiveWeights: objectives.objectiveWeights,
    policyProfile: objectives.policyProfile,
    guardrails,
    rollout,
    changes,
    optimizedState,
  };
}

function deterministicSimulate(input, provider) {
  const state = input?.state || input;
  const scenario = input?.scenario || {};
  const { unassignedSlots, coveragePct } = summarizeState(state);

  const absences = isArray(scenario.absentProviderIds) ? scenario.absentProviderIds.length : 0;
  const surge = Number.isFinite(scenario.censusSurgePct) ? scenario.censusSurgePct : 0;

  const projectedCoverage = Math.max(0, coveragePct - absences * 3 - Math.floor(surge / 10));
  const projectedUnassigned = Math.max(0, unassignedSlots + absences + Math.floor(surge / 15));

  const objectives = computeObjectiveBreakdown(state, input);

  return {
    provider,
    source: "deterministic-fallback",
    scenario,
    baseline: { coveragePct, unassignedSlots },
    projected: { coveragePct: projectedCoverage, unassignedSlots: projectedUnassigned },
    objectiveScore: objectives.objectiveScore,
    objectiveBreakdown: objectives.objectiveBreakdown,
    objectiveWeights: objectives.objectiveWeights,
    policyProfile: objectives.policyProfile,
  };
}

function deterministicConflicts(state, provider) {
  const slots = isArray(state?.slots) ? state.slots : [];
  const providers = new Map((isArray(state?.providers) ? state.providers : []).map((entry) => [entry.id, entry]));
  const maxShiftRules = new Map(
    (isArray(state?.customRules) ? state.customRules : [])
      .filter((rule) => rule?.type === "MAX_SHIFTS_PER_WEEK" && rule?.providerId)
      .map((rule) => [rule.providerId, rule.maxShifts]),
  );
  const conflicts = [];
  const seenProviderDate = new Set();
  const weeklyAssignments = new Map();

  for (const slot of slots) {
    if (!slot?.providerId) {
      conflicts.push({ type: "unassigned_slot", severity: "high", slotId: slot?.id || null, message: "Slot has no assigned provider." });
      continue;
    }

    const providerProfile = providers.get(slot.providerId);
    if (!providerProfile) {
      conflicts.push({ type: "missing_provider", severity: "high", slotId: slot?.id || null, message: "Assigned provider does not exist." });
      continue;
    }

    if (!providerHasSkill(providerProfile, slot.requiredSkill)) {
      conflicts.push({ type: "skill_mismatch", severity: "high", slotId: slot?.id || null, message: "Provider missing required skill for slot." });
    }

    if (isProviderUnavailable(providerProfile, slot.date)) {
      conflicts.push({
        type: "time_off_violation",
        severity: "high",
        slotId: slot?.id || null,
        message: "Provider is assigned on an approved time-off date.",
      });
    }

    if (providerHasExpiredCredential(providerProfile, slot.date)) {
      conflicts.push({
        type: "expired_credential",
        severity: "high",
        slotId: slot?.id || null,
        message: "Provider has an expired credential for this date.",
      });
    }

    const key = `${slot.providerId}:${slot.date}`;
    if (seenProviderDate.has(key)) {
      conflicts.push({ type: "double_booked", severity: "medium", slotId: slot?.id || null, message: "Provider is assigned more than once on this date." });
    } else {
      seenProviderDate.add(key);
    }

    const weekKey = `${slot.providerId}:${getWeekStart(slot.date)}`;
    weeklyAssignments.set(weekKey, (weeklyAssignments.get(weekKey) || 0) + 1);

    const maxShifts = maxShiftRules.get(slot.providerId);
    if (Number.isFinite(maxShifts) && weeklyAssignments.get(weekKey) > maxShifts) {
      conflicts.push({
        type: "max_shifts_per_week_exceeded",
        severity: "medium",
        slotId: slot?.id || null,
        message: "Provider exceeds configured maximum shifts for this week.",
      });
    }
  }

  return { provider, source: "deterministic-fallback", conflictCount: conflicts.length, conflicts };
}

function deterministicExplain(input, provider) {
  const decision = input?.decision || input?.change || input || {};
  const { objectiveWeights, policyProfile } = normalizeObjectiveWeights(input);

  return {
    provider,
    source: "deterministic-fallback",
    explanation:
      "This recommendation prioritizes critical coverage first, then least-loaded eligible providers, and finally fairness under hard constraints.",
    decision,
    objectiveWeights,
    policyProfile,
  };
}

function buildPrompt(task, payload) {
  return `You are an ICU scheduling copilot. Task: ${task}. Return JSON only.\n${JSON.stringify(payload || {}, null, 2)}`;
}

async function callOpenAI(task, payload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: getPreferredModel("openai"), input: buildPrompt(task, payload), temperature: 0.2 }),
  });

  if (!response.ok) throw new Error(`OpenAI request failed (${response.status})`);

  const data = await response.json();
  return { provider: "openai", model: getPreferredModel("openai"), source: "llm", text: data?.output_text || "" };
}

async function callAnthropic(task, payload) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: getPreferredModel("anthropic"),
      max_tokens: 600,
      temperature: 0.2,
      messages: [{ role: "user", content: buildPrompt(task, payload) }],
    }),
  });

  if (!response.ok) throw new Error(`Anthropic request failed (${response.status})`);

  const data = await response.json();
  const firstText = data?.content?.find((entry) => entry?.type === "text")?.text || "";
  return { provider: "anthropic", model: getPreferredModel("anthropic"), source: "llm", text: firstText };
}

async function callGemini(task, payload) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = getPreferredModel("google");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: { temperature: 0.2 },
        contents: [{ parts: [{ text: buildPrompt(task, payload) }] }],
      }),
    },
  );

  if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((entry) => entry?.text || "").join("\n") || "";
  return { provider: "google", model, source: "llm", text };
}

async function callConfiguredProvider(task, payload) {
  const provider = getConfiguredProvider();
  if (provider === "anthropic") return callAnthropic(task, payload);
  if (provider === "google") return callGemini(task, payload);
  return callOpenAI(task, payload);
}

function parseStructuredText(text) {
  if (!text || typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getMetricsKey(provider, model) {
  return `${provider || "unknown"}:${model || "unknown"}`;
}

function estimateTokens(text) {
  if (!text || typeof text !== "string") return 0;
  return Math.max(1, Math.round(text.length / 4));
}

function estimateCostUsd(provider, tokens) {
  const pricePer1k = PROVIDER_PRICING_USD_PER_1K_TOKENS[provider] || 0;
  return Number(((tokens / 1000) * pricePer1k).toFixed(6));
}

function ensureMetricsEntry(provider, model) {
  const key = getMetricsKey(provider, model);
  if (!providerMetrics.has(key)) {
    providerMetrics.set(key, {
      provider: provider || "unknown",
      model: model || "unknown",
      requestCount: 0,
      llmSuccessCount: 0,
      fallbackCount: 0,
      failureCount: 0,
      totalLatencyMs: 0,
      avgLatencyMs: 0,
      totalEstimatedCostUsd: 0,
      acceptedCount: 0,
      rollbackCount: 0,
      violationCount: 0,
      acceptedRate: 0,
      rollbackRate: 0,
      violationRate: 0,
      lastUpdatedAt: null,
    });
  }

  return providerMetrics.get(key);
}

function refreshDerivedRates(entry) {
  entry.avgLatencyMs = entry.requestCount > 0 ? Number((entry.totalLatencyMs / entry.requestCount).toFixed(2)) : 0;
  entry.acceptedRate = entry.requestCount > 0 ? Number((entry.acceptedCount / entry.requestCount).toFixed(3)) : 0;
  entry.rollbackRate = entry.requestCount > 0 ? Number((entry.rollbackCount / entry.requestCount).toFixed(3)) : 0;
  entry.violationRate = entry.requestCount > 0 ? Number((entry.violationCount / entry.requestCount).toFixed(3)) : 0;
  entry.lastUpdatedAt = new Date().toISOString();
}

function recordRequestMetrics({ provider, model, latencyMs, usedLlm, usedFallback, failed, text }) {
  const entry = ensureMetricsEntry(provider, model);
  entry.requestCount += 1;
  entry.totalLatencyMs += Math.max(0, Math.round(latencyMs || 0));
  if (usedLlm) entry.llmSuccessCount += 1;
  if (usedFallback) entry.fallbackCount += 1;
  if (failed) entry.failureCount += 1;

  const estimatedTokens = estimateTokens(text);
  entry.totalEstimatedCostUsd = Number((entry.totalEstimatedCostUsd + estimateCostUsd(provider, estimatedTokens)).toFixed(6));
  refreshDerivedRates(entry);
}

function resolveProviderModelFromResult(result) {
  if (result?.llm?.provider || result?.llm?.model) {
    return {
      provider: result?.llm?.provider || getConfiguredProvider(),
      model: result?.llm?.model || getPreferredModel(result?.llm?.provider || getConfiguredProvider()),
    };
  }

  const provider = result?.provider || getConfiguredProvider();
  return { provider, model: `deterministic-${provider}` };
}

function withMetadata(result, llmResponse) {
  return { ...result, llm: { provider: llmResponse.provider, model: llmResponse.model, source: llmResponse.source } };
}

async function executeTask(task, payload, fallbackBuilder) {
  const provider = getConfiguredProvider();
  const fallbackResult = fallbackBuilder(payload, provider);
  const startedAt = Date.now();

  try {
    const llmResponse = await callConfiguredProvider(task, payload);
    if (!llmResponse) {
      recordRequestMetrics({
        provider,
        model: `deterministic-${provider}`,
        latencyMs: Date.now() - startedAt,
        usedLlm: false,
        usedFallback: true,
        failed: false,
      });
      return fallbackResult;
    }

    const parsed = parseStructuredText(llmResponse.text);
    const result =
      !parsed || typeof parsed !== "object"
        ? withMetadata({ ...fallbackResult, llmText: llmResponse.text }, llmResponse)
        : withMetadata({ ...fallbackResult, ...parsed, source: "llm+fallback-shape" }, llmResponse);

    recordRequestMetrics({
      provider: llmResponse.provider,
      model: llmResponse.model,
      latencyMs: Date.now() - startedAt,
      usedLlm: true,
      usedFallback: false,
      failed: false,
      text: llmResponse.text,
    });

    return result;
  } catch (error) {
    recordRequestMetrics({
      provider,
      model: `deterministic-${provider}`,
      latencyMs: Date.now() - startedAt,
      usedLlm: false,
      usedFallback: true,
      failed: true,
    });
    return { ...fallbackResult, warning: error instanceof Error ? error.message : "Unknown provider error" };
  }
}

function listProviderMetrics() {
  return [...providerMetrics.values()]
    .map((entry) => ({ ...entry }))
    .sort((a, b) => String(a.provider).localeCompare(String(b.provider)) || String(a.model).localeCompare(String(b.model)));
}

function recordAutomationOutcome(input = {}) {
  const { provider, model } = resolveProviderModelFromResult(input?.result || input);
  const entry = ensureMetricsEntry(provider, model);
  if (input?.accepted === true) entry.acceptedCount += 1;
  if (input?.rolledBack === true) entry.rollbackCount += 1;

  const violationCount = Number.isFinite(input?.violationCount)
    ? Math.max(0, Number(input.violationCount))
    : Number.isFinite(input?.result?.guardrails?.hardViolationCount)
      ? Math.max(0, Number(input.result.guardrails.hardViolationCount))
      : 0;
  entry.violationCount += violationCount;
  refreshDerivedRates(entry);

  return {
    provider,
    model,
    acceptedCount: entry.acceptedCount,
    rollbackCount: entry.rollbackCount,
    violationCount: entry.violationCount,
  };
}

export async function buildRecommendations(input) {
  return executeTask("recommendations", input, deterministicRecommendations);
}

export async function optimizeSchedule(input) {
  return executeTask("optimize", input, deterministicOptimize);
}

export async function simulateScenario(input) {
  return executeTask("simulate", input, deterministicSimulate);
}

export async function detectConflicts(input) {
  const state = input?.state || input;
  return executeTask("conflicts", state, deterministicConflicts);
}

export async function explainDecision(input) {
  return executeTask("explain", input, deterministicExplain);
}

export async function parseExcelStructure(input) {
  const task = "Analyze the provided Excel sample data and suggest a mapping to the target schedule fields. " +
    "Target fields are: date, dayG20, dayH22, dayAkron, night, consults, nmet, jeopardy, recovery, vacation. " +
    "Return a JSON object with 'mapping' (a Record<TargetField, SourceHeader>) and 'confidence' (0-1).";

  return executeTask("parse-excel", input, (payload) => {
    return {
      mapping: {},
      confidence: 0,
      source: "deterministic-fallback",
      message: "AI parsing not available for this task in fallback mode."
    };
  });
}

// ==================== COPILOT / INTENT PARSING ====================

const SUPPORTED_INTENTS = [
  "request_time_off",
  "request_swap",
  "optimize_schedule",
  "check_coverage",
  "assign_shift",
  "unassign_shift",
  "save_scenario",
  "load_scenario",
  "delete_scenario",
  "explain_assignment",
  "simulate_scenario",
  "get_recommendations",
  "show_conflicts",
  "resolve_conflicts",
  "adjust_preferences",
  "greeting",
  "unknown"
];

const SUPPORTED_COPILOT_ACTIONS = [
  "check_coverage",
  "show_coverage",
  "detect_conflicts",
  "resolve_conflicts",
  "auto_assign",
  "optimize_schedule",
  "assign_shift",
  "unassign_shift",
  "save_scenario",
  "create_scenario",
  "load_scenario",
  "delete_scenario",
  "explain_assignments",
];

const COPILOT_EXAMPLE_PROMPTS = [
  "Optimize schedule",
  "Show conflicts",
  "Assign day shift on selected date",
  "Save scenario Weekend Plan",
  "Explain my assignments",
];

const INTENT_PATTERNS = {
  greeting: /^(hi|hello|hey|good morning|good afternoon|good evening)/i,
  request_time_off: /(need|want|request).*(off|vacation|time off|pto|away)/i,
  request_swap: /(swap|trade|exchange|switch).*(shift|with)/i,
  optimize_schedule: /(optimize|balance|improve|better|fix|adjust).*(schedule|shifts|fair)/i,
  check_coverage: /(who|coverage|covering|working|on call|oncall).*(weekend|night|day|shift)/i,
  assign_shift: /(assign|schedule|put).*(day|night|nmet|jeopardy|recovery|consult|shift).*(to|for)?/i,
  unassign_shift: /(unassign|remove|clear).*(shift|assignment|coverage)/i,
  save_scenario: /(save|create).*(scenario|snapshot)/i,
  load_scenario: /(load|open|restore).*(scenario|snapshot)/i,
  delete_scenario: /(delete|remove).*(scenario|snapshot)/i,
  explain_assignment: /(why|how come|explain).*(assigned|schedule|shift)/i,
  simulate_scenario: /(what if|simulate|scenario|suppose|if).*(sick|absent|missing)/i,
  get_recommendations: /(recommend|suggest|advice|how can|what should)/i,
  resolve_conflicts: /(resolve|fix|auto[- ]?fix).*(conflict|problem|issue|violation)/i,
  show_conflicts: /(conflict|problem|issue|violation|overlap|double)/i,
  adjust_preferences: /(prefer|want|like).*(fewer|less|more|weekend|night)/i,
};

function deterministicParseIntent(input, provider) {
  const text = String(input?.text || "").toLowerCase().trim();
  
  if (!text) {
    return {
      provider,
      source: "deterministic-fallback",
      intent: "unknown",
      confidence: 0,
      entities: {},
      originalText: input?.text || ""
    };
  }

  // Try pattern matching
  for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
    if (pattern.test(text)) {
      return {
        provider,
        source: "deterministic-fallback",
        intent,
        confidence: 0.7,
        entities: extractEntitiesRuleBased(text),
        originalText: input?.text || ""
      };
    }
  }

  // Default to unknown
  return {
    provider,
    source: "deterministic-fallback",
    intent: "unknown",
    confidence: 0.3,
    entities: extractEntitiesRuleBased(text),
    originalText: input?.text || ""
  };
}

function extractEntitiesRuleBased(text) {
  const entities = {
    providerName: null,
    date: null,
    dateRange: null,
    shiftType: null,
    targetProvider: null,
    scenarioName: null,
  };

  // Extract provider names (Dr. X or simple names)
  const nameMatch = text.match(/(?:dr\.?\s*)?(\w+)(?:\s+(?:smith|johnson|lee|chen|kim|patel|martinez|brown))/i);
  if (nameMatch) {
    entities.providerName = nameMatch[0];
  }

  // Extract "with X" for swaps
  const withMatch = text.match(/with\s+(?:dr\.?\s*)?(\w+)/i);
  if (withMatch) {
    entities.targetProvider = withMatch[1];
  }

  // Extract dates (simplified)
  const datePatterns = [
    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    /(next\s+(?:mon|tues|wednes|thurs|fri|satur|sun)day)/i,
    /(tomorrow|today|next week)/i,
    /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})/i
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      entities.date = match[0];
      break;
    }
  }

  // Extract shift types
  const shiftMatch = text.match(/(day|night|evening|morning|g20|h22|akron|consult|nmet|jeopardy|recovery)/i);
  if (shiftMatch) {
    entities.shiftType = shiftMatch[1].toUpperCase();
  }

  const scenarioMatch = text.match(/scenario\s+(?:named\s+)?["']?([a-z0-9 _-]{2,40})["']?/i);
  if (scenarioMatch) {
    entities.scenarioName = scenarioMatch[1].trim();
  }

  return entities;
}

function buildIntentPrompt(text, context) {
  return `Parse the user intent from this ICU scheduling request.

Available intents:
- request_time_off: User wants time off for specific date(s)
- request_swap: User wants to swap shifts with another provider
- optimize_schedule: User wants to improve/optimize the current schedule
- check_coverage: User is asking who is covering a specific time
- explain_assignment: User wants to understand why they were assigned something
- simulate_scenario: User wants to simulate what would happen in a scenario
- get_recommendations: User wants general scheduling advice/recommendations
- show_conflicts: User wants to see scheduling conflicts or problems
- adjust_preferences: User wants to change their scheduling preferences
- greeting: Simple greeting/hello
- unknown: None of the above

User message: "${text}"

Current context:
- View type: ${context?.viewType || 'unknown'}
- Selected date: ${context?.selectedDate || 'none'}
- User role: ${context?.userRole || 'unknown'}
- Visible providers: ${context?.visibleProviderCount || 0}

Return ONLY a JSON object:
{
  "intent": "one of the above intent names",
  "confidence": 0.0-1.0,
  "entities": {
    "providerName": "extracted name or null",
    "date": "extracted date reference or null",
    "shiftType": "DAY|NIGHT|G20|H22|AKRON|CONSULT|NMET|JEOPARDY|RECOVERY or null",
      "targetProvider": "for swaps, who to swap with or null",
      "scenarioName": "scenario name when provided, else null"
  }
}`;
}

export async function parseIntent(input) {
  const provider = getConfiguredProvider();
  const task = "intent-parsing";
  const payload = {
    text: input?.text,
    context: input?.context || {}
  };

  // Use LLM if available, otherwise deterministic
  return executeTask(task, payload, deterministicParseIntent);
}

export function listCopilotCapabilities() {
  return {
    capabilitySchemaVersion: "2026-03-04",
    intents: [...SUPPORTED_INTENTS],
    actions: [...SUPPORTED_COPILOT_ACTIONS],
    confirmationRequiredIntents: ["optimize_schedule"],
    examplePrompts: [...COPILOT_EXAMPLE_PROMPTS],
  };
}

// ==================== CONTEXTUAL RECOMMENDATIONS ====================

function buildContextualRecommendations(input, context) {
  const base = deterministicRecommendations(input, context?.provider);
  const recommendations = [...(base.recommendations || [])];
  const providers = isArray(input?.state?.providers) ? input.state.providers : [];

  // Add context-specific recommendations
  if (context?.viewType === 'week' && context?.selectedDate) {
    const date = context.selectedDate;
    const dayOfWeek = new Date(date).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    recommendations.push({
      id: 'day-specific-check',
      title: isWeekend ? 'Weekend coverage verification' : 'Weekday staffing review',
      impact: isWeekend ? 'high' : 'medium',
      rationale: isWeekend 
        ? `Weekend shifts for ${date} should be verified for adequate coverage.`
        : `Review ${date} assignments for balanced workload distribution.`,
      context: { date, isWeekend }
    });
  }

  if (context?.selectedProvider) {
    recommendations.push({
      id: 'provider-specific',
      title: `Review ${context.selectedProvider.name}'s assignments`,
      impact: 'medium',
      rationale: 'Check for fairness relative to targets and preferences.',
      context: { providerId: context.selectedProvider.id }
    });
  } else if (context?.selectedProviderId) {
    const selectedProvider = providers.find((provider) => provider?.id === context.selectedProviderId);
    if (selectedProvider) {
      recommendations.push({
        id: 'provider-specific',
        title: `Review ${selectedProvider.name}'s assignments`,
        impact: 'medium',
        rationale: 'Check for fairness relative to targets and preferences.',
        context: { providerId: selectedProvider.id }
      });
    }
  }

  return {
    ...base,
    recommendations,
    context,
    source: base.source
  };
}

export async function getCopilotSuggestions(input) {
  const { state, context } = input || {};
  const provider = getConfiguredProvider();
  
  // Always use contextual recommendations for suggestions
  return buildContextualRecommendations({ state }, context);
}

export async function processCopilotMessage(input) {
  const { message, context, conversationHistory = [] } = input || {};
  
  // Step 1: Parse intent
  const intentResult = await parseIntent({ text: message, context });
  
  // Step 2: Build response based on intent
  const response = await buildCopilotResponse(intentResult, context, conversationHistory);
  
  return {
    messageId: generateMessageId(),
    intent: intentResult.intent,
    confidence: intentResult.confidence,
    entities: intentResult.entities,
    response: response.message,
    suggestions: response.suggestions || [],
    requiresConfirmation: response.requiresConfirmation || false,
    preview: response.preview || null,
    actions: response.actions || []
  };
}

function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function buildCopilotResponse(intentResult, context, history) {
  const { intent, entities, confidence } = intentResult;
  
  const responses = {
    greeting: {
      message: "Hello! I'm your scheduling assistant. How can I help you today? You can ask me to:\n• Request time off\n• Check coverage\n• Optimize the schedule\n• Find conflicts\n• Or just tell me what you need!",
      suggestions: ['Show my schedule', 'Who covers next weekend?', 'Optimize schedule'],
      requiresConfirmation: false
    },
    
    request_time_off: {
      message: entities.date 
        ? `I'll help you request time off${entities.date ? ` for ${entities.date}` : ''}. Let me check coverage first.`
        : "I'd be happy to help you request time off. What date(s) do you need?",
      suggestions: entities.date ? ['Check coverage', 'Submit request', 'Find alternative'] : ['Next Monday', 'Next week', 'March 15-17'],
      requiresConfirmation: false,
      actions: entities.date ? [{ type: 'check_coverage', date: entities.date }] : []
    },
    
    request_swap: {
      message: entities.targetProvider
        ? `I can help you swap shifts with ${entities.targetProvider}. Which shift would you like to swap?`
        : "I can help you arrange a shift swap. Which shift do you want to swap and with whom?",
      suggestions: ['My next night shift', 'This weekend', 'Let me pick from calendar'],
      requiresConfirmation: false
    },
    
    optimize_schedule: {
      message: "I'll analyze the current schedule and suggest optimizations for better fairness and coverage.",
      suggestions: ['Optimize now', 'Show me conflicts first', 'Adjust optimization goals'],
      requiresConfirmation: true,
      preview: { type: 'optimization', estimatedImpact: 'Calculating...' },
      actions: [{ type: "auto_assign" }]
    },
    
    check_coverage: {
      message: entities.date 
        ? `Let me check coverage${entities.date ? ` for ${entities.date}` : ''}${entities.shiftType ? ` (${entities.shiftType})` : ''}.`
        : "Which date or time period would you like me to check coverage for?",
      suggestions: ['This weekend', 'Next week', 'Tonight', 'All uncovered shifts'],
      requiresConfirmation: false,
      actions: [{ type: 'show_coverage', date: entities.date, shiftType: entities.shiftType }]
    },
    
    explain_assignment: {
      message: "I'll explain the reasoning behind your assignments. Looking at your targets, preferences, and fairness across the team...",
      suggestions: ['Why so many nights?', 'Why this weekend?', 'Show my fairness score'],
      requiresConfirmation: false,
      actions: [{ type: 'explain_assignments', providerId: context?.currentUser?.id }]
    },
    
    simulate_scenario: {
      message: "I can simulate what would happen in that scenario. This helps us prepare contingency plans.",
      suggestions: ['Dr. Smith sick', 'Census surge 20%', 'Multiple absences'],
      requiresConfirmation: false,
      preview: { type: 'simulation', scenario: 'absence' }
    },
    
    get_recommendations: {
      message: "Here are my recommendations based on the current schedule:",
      suggestions: ['Show all recommendations', 'Focus on fairness', 'Focus on coverage'],
      requiresConfirmation: false
    },
    
    show_conflicts: {
      message: "I'll scan the schedule for conflicts, double-bookings, and constraint violations.",
      suggestions: ['Show all conflicts', 'Show critical only', 'Auto-fix where possible'],
      requiresConfirmation: false,
      actions: [{ type: 'detect_conflicts' }]
    },

    resolve_conflicts: {
      message: "I can auto-resolve conflicts that support safe auto-fixes and leave the rest for manual review.",
      suggestions: ['Run auto-fix now', 'Show unresolved only', 'Rescan conflicts'],
      requiresConfirmation: false,
      actions: [{ type: "detect_conflicts" }, { type: "resolve_conflicts" }]
    },

    assign_shift: {
      message: entities.date
        ? `I can assign a shift${entities.shiftType ? ` (${entities.shiftType})` : ""} on ${entities.date}.`
        : "I can assign a shift. Tell me the date (and optional shift type).",
      suggestions: ['Assign selected date', 'Assign night shift', 'Assign day shift'],
      requiresConfirmation: false,
      actions: [{ type: "assign_shift", date: entities.date, shiftType: entities.shiftType, providerName: entities.targetProvider || entities.providerName }]
    },

    unassign_shift: {
      message: entities.date
        ? `I can clear the assignment${entities.shiftType ? ` for ${entities.shiftType}` : ""} on ${entities.date}.`
        : "I can remove a shift assignment. Tell me the date (and optional shift type).",
      suggestions: ['Clear selected date', 'Clear night shift', 'Clear day shift'],
      requiresConfirmation: false,
      actions: [{ type: "unassign_shift", date: entities.date, shiftType: entities.shiftType }]
    },

    save_scenario: {
      message: entities.scenarioName
        ? `Saving scenario "${entities.scenarioName}".`
        : "I can save the current plan as a scenario snapshot.",
      suggestions: ['Save scenario as Weekend Plan', 'Save scenario as Backup Roster'],
      requiresConfirmation: false,
      actions: [{ type: "save_scenario", scenarioName: entities.scenarioName }]
    },

    load_scenario: {
      message: entities.scenarioName
        ? `I can load scenario "${entities.scenarioName}".`
        : "I can load a saved scenario. Tell me which one.",
      suggestions: ['Load latest scenario', 'Load Weekend Plan'],
      requiresConfirmation: false,
      actions: [{ type: "load_scenario", scenarioName: entities.scenarioName }]
    },

    delete_scenario: {
      message: entities.scenarioName
        ? `I can delete scenario "${entities.scenarioName}".`
        : "I can delete a saved scenario. Tell me which one.",
      suggestions: ['Delete latest scenario', 'Delete Weekend Plan'],
      requiresConfirmation: false,
      actions: [{ type: "delete_scenario", scenarioName: entities.scenarioName }]
    },
    
    adjust_preferences: {
      message: "I can help you update your scheduling preferences. What would you like to change?",
      suggestions: ['Fewer weekends', 'Fewer nights', 'More day shifts', 'Specific dates off'],
      requiresConfirmation: false
    },
    
    unknown: {
      message: "I'm not sure I understood. I can help you with:\n• Requesting time off or swaps\n• Checking coverage\n• Optimizing the schedule\n• Explaining assignments\n• Finding conflicts\n\nWhat would you like to do?",
      suggestions: ['Request time off', 'Check coverage', 'Optimize schedule', 'Show help'],
      requiresConfirmation: false
    }
  };

  const baseResponse = responses[intent] || responses.unknown;
  
  // Add confidence indicator for low-confidence intents
  if (confidence < 0.7 && intent !== 'unknown') {
    baseResponse.message = `I think you want to ${intent.replace(/_/g, ' ')}, but I'm not entirely sure. ${baseResponse.message}`;
  }

  return baseResponse;
}

export { listProviders, listProviderMetrics, recordAutomationOutcome, buildContextualRecommendations };
