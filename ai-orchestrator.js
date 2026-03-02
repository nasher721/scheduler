const DEFAULT_PROVIDERS = [
  { id: "openai", label: "OpenAI", models: ["gpt-4.1-mini", "gpt-4.1"], envKey: "OPENAI_API_KEY" },
  { id: "anthropic", label: "Anthropic", models: ["claude-3-5-sonnet-latest"], envKey: "ANTHROPIC_API_KEY" },
  { id: "google", label: "Google Gemini", models: ["gemini-2.0-flash"], envKey: "GEMINI_API_KEY" },
];

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
    providerStats.totalAssigned += 1;
    providerStats.byDate.add(slot.date);

    const weekStart = getWeekStart(slot.date);
    providerStats.weekly.set(weekStart, (providerStats.weekly.get(weekStart) || 0) + 1);

    if (isNightShift(slot)) {
      if (providerStats.lastNightDate) {
        const prev = new Date(providerStats.lastNightDate);
        const curr = new Date(slot.date);
        const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
        providerStats.consecutiveNights = diffDays === 1 ? providerStats.consecutiveNights + 1 : 1;
      } else {
        providerStats.consecutiveNights = 1;
      }
      providerStats.lastNightDate = slot.date;
    }
  }

  return stats;
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
      if (stats.consecutiveNights >= maxConsecutive && stats.lastNightDate === slot.date) continue;
    }

    candidates.push({ provider, score: stats.totalAssigned * 100 + assignedThisWeek * 10 });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.score - b.score || a.provider.name.localeCompare(b.provider.name));
  return candidates[0].provider;
}

function deterministicRecommendations(state, provider) {
  const { providers, slots, unassignedSlots, coveragePct } = summarizeState(state);

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
    const weekStart = getWeekStart(slot.date);
    stats.totalAssigned += 1;
    stats.byDate.add(slot.date);
    stats.weekly.set(weekStart, (stats.weekly.get(weekStart) || 0) + 1);

    changes.push({
      slotId: slot.id || null,
      action: "assign_provider",
      providerId: winner.id,
      reason: "Greedy solver assignment from eligible least-loaded candidate.",
    });
  }

  const optimizedState = { ...state, slots };
  const summary = summarizeState(optimizedState);
  return {
    provider,
    source: "deterministic-fallback",
    objectiveScore: Math.max(0, summary.coveragePct - changes.filter((entry) => entry.action !== "assign_provider").length),
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

  return {
    provider,
    source: "deterministic-fallback",
    scenario,
    baseline: { coveragePct, unassignedSlots },
    projected: { coveragePct: projectedCoverage, unassignedSlots: projectedUnassigned },
  };
}

function deterministicConflicts(state, provider) {
  const slots = isArray(state?.slots) ? state.slots : [];
  const providers = new Map((isArray(state?.providers) ? state.providers : []).map((entry) => [entry.id, entry]));
  const conflicts = [];
  const seenProviderDate = new Set();

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

    const key = `${slot.providerId}:${slot.date}`;
    if (seenProviderDate.has(key)) {
      conflicts.push({ type: "double_booked", severity: "medium", slotId: slot?.id || null, message: "Provider is assigned more than once on this date." });
    } else {
      seenProviderDate.add(key);
    }
  }

  return { provider, source: "deterministic-fallback", conflictCount: conflicts.length, conflicts };
}

function deterministicExplain(input, provider) {
  const decision = input?.decision || input?.change || input || {};
  const objectiveWeights = input?.objectiveWeights || {};

  return {
    provider,
    source: "deterministic-fallback",
    explanation:
      "This recommendation prioritizes critical coverage first, then least-loaded eligible providers, and finally fairness under hard constraints.",
    decision,
    objectiveWeights,
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

function withMetadata(result, llmResponse) {
  return { ...result, llm: { provider: llmResponse.provider, model: llmResponse.model, source: llmResponse.source } };
}

async function executeTask(task, payload, fallbackBuilder) {
  const provider = getConfiguredProvider();
  const fallbackResult = fallbackBuilder(payload, provider);

  try {
    const llmResponse = await callConfiguredProvider(task, payload);
    if (!llmResponse) return fallbackResult;

    const parsed = parseStructuredText(llmResponse.text);
    if (!parsed || typeof parsed !== "object") return withMetadata({ ...fallbackResult, llmText: llmResponse.text }, llmResponse);
    return withMetadata({ ...fallbackResult, ...parsed, source: "llm+fallback-shape" }, llmResponse);
  } catch (error) {
    return { ...fallbackResult, warning: error instanceof Error ? error.message : "Unknown provider error" };
  }
}

export async function buildRecommendations(input) {
  const state = input?.state || input;
  return executeTask("recommendations", state, deterministicRecommendations);
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

export { listProviders };
