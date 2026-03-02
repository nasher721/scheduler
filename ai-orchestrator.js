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
  const hardConstraintTypes = ["missing_provider", "skill_mismatch", "time_off_violation", "double_booked"];
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

export { listProviders, listProviderMetrics, recordAutomationOutcome };
