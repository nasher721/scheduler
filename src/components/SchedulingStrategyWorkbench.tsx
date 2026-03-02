import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Settings2, Wand2 } from "lucide-react";
import { useScheduleStore } from "../store";

type ScenarioTemplate = {
  id: string;
  name: string;
  trigger: string;
  impacts: string[];
  guardrails: string[];
  interventions: string[];
};

const scenarioTemplates: ScenarioTemplate[] = [
  {
    id: "census-surge",
    name: "ICU Census Surge",
    trigger: "Unexpected increase in admissions, transfer-ins, or consult volume.",
    impacts: ["Critical coverage gaps", "Uneven night burden", "Higher fatigue risk"],
    guardrails: [
      "Set per-provider rolling max shifts for high-volume weeks.",
      "Use avoid-pairing for novice + novice combinations on nights.",
    ],
    interventions: [
      "Convert low-priority slots to backup-only coverage.",
      "Reserve at least one provider with AIRWAY or STROKE skills daily.",
    ],
  },
  {
    id: "provider-outage",
    name: "Provider Outage / Leave",
    trigger: "Sick calls, emergency leave, or credentialing delays.",
    impacts: ["Single-point failure for skills", "Cross-campus conflicts", "Unfilled critical slots"],
    guardrails: [
      "Define max weekly load for remaining providers.",
      "Add avoid-pairing rule to separate providers with overlapping constraints.",
    ],
    interventions: [
      "Create a contingency scenario snapshot before reassignment.",
      "Prioritize NIGHT_FLOAT and NEURO_CRITICAL skill coverage before standard shifts.",
    ],
  },
  {
    id: "fairness-rebalance",
    name: "Fairness & Burnout Rebalance",
    trigger: "Persistent assignment skew over multiple weeks.",
    impacts: ["Morale erosion", "Excessive consecutive nights", "Reduced schedule acceptance"],
    guardrails: [
      "Cap weekly shift totals for overloaded providers.",
      "Enforce separation rules for high-risk pairings to reduce repeated co-coverage.",
    ],
    interventions: [
      "Use preferred dates to improve assignment satisfaction.",
      "Regenerate assignments after adding constraints and compare scenarios.",
    ],
  },
];

export function SchedulingStrategyWorkbench() {
  const { providers, slots, customRules, addCustomRule } = useScheduleStore();
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(scenarioTemplates[0].id);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(providers[0]?.id ?? "");
  const [maxShifts, setMaxShifts] = useState<number>(4);

  const selectedScenario = useMemo(
    () => scenarioTemplates.find((scenario) => scenario.id === selectedScenarioId) ?? scenarioTemplates[0],
    [selectedScenarioId],
  );

  const riskDigest = useMemo(() => {
    const unfilledCritical = slots.filter((slot) => slot.priority === "CRITICAL" && !slot.providerId).length;
    const missingNightFloat = providers.filter((provider) => !provider.skills.includes("NIGHT_FLOAT")).length;

    const assignedCounts = providers
      .map((provider) => ({
        id: provider.id,
        name: provider.name,
        totalAssigned: slots.filter((slot) => slot.providerId === provider.id).length,
      }))
      .sort((a, b) => b.totalAssigned - a.totalAssigned);

    const mostLoaded = assignedCounts[0];

    return {
      unfilledCritical,
      missingNightFloat,
      mostLoaded,
      hasMaxShiftProtection: customRules.some((rule) => rule.type === "MAX_SHIFTS_PER_WEEK"),
    };
  }, [customRules, providers, slots]);

  const handleApplyRule = () => {
    if (!selectedProviderId || maxShifts < 1) return;
    addCustomRule({
      type: "MAX_SHIFTS_PER_WEEK",
      providerId: selectedProviderId,
      maxShifts,
    });
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-end justify-between border-b border-slate-100 pb-6">
          <div>
            <h2 className="text-4xl font-serif text-slate-900 tracking-tight">Scheduling Strategy Workbench</h2>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-2">
              scenario navigation + rule blueprinting
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="stone-panel p-5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Critical Gaps</p>
            <p className="text-3xl font-bold text-rose-600 mt-2">{riskDigest.unfilledCritical}</p>
          </div>
          <div className="stone-panel p-5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">No NIGHT_FLOAT skill</p>
            <p className="text-3xl font-bold text-amber-600 mt-2">{riskDigest.missingNightFloat}</p>
          </div>
          <div className="stone-panel p-5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Max Shift Guardrail</p>
            <p className="text-sm font-semibold text-slate-800 mt-3 flex items-center gap-2">
              {riskDigest.hasMaxShiftProtection ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
              {riskDigest.hasMaxShiftProtection ? "Configured" : "Not configured"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <section className="xl:col-span-2 satin-panel p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Scenario Library</h3>
            <div className="space-y-2">
              {scenarioTemplates.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => setSelectedScenarioId(scenario.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${selectedScenarioId === scenario.id ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700">{scenario.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{scenario.trigger}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="xl:col-span-3 satin-panel p-6 space-y-5">
            <h3 className="text-xl font-serif text-slate-900">{selectedScenario.name}</h3>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Likely Impacts</p>
              <ul className="space-y-2">
                {selectedScenario.impacts.map((impact) => (
                  <li key={impact} className="text-sm text-slate-700">• {impact}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Recommended Guardrails</p>
              <ul className="space-y-2">
                {selectedScenario.guardrails.map((guardrail) => (
                  <li key={guardrail} className="text-sm text-slate-700">• {guardrail}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Operational Interventions</p>
              <ul className="space-y-2">
                {selectedScenario.interventions.map((intervention) => (
                  <li key={intervention} className="text-sm text-slate-700">• {intervention}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <section className="satin-panel p-6">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4"><Wand2 className="w-4 h-4" /> Rapid Rule Composer</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Provider</label>
              <select
                value={selectedProviderId}
                onChange={(event) => setSelectedProviderId(event.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              >
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>{provider.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Max shifts (7-day)</label>
              <input
                type="number"
                min={1}
                value={maxShifts}
                onChange={(event) => setMaxShifts(Math.max(1, Number(event.target.value) || 1))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleApplyRule}
              className="bg-primary text-white rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Apply Rule
            </button>
          </div>
          {riskDigest.mostLoaded && (
            <p className="text-xs text-slate-500 mt-4">
              Suggested first action: protect <span className="font-semibold text-slate-700">{riskDigest.mostLoaded.name}</span>, currently assigned {riskDigest.mostLoaded.totalAssigned} shifts.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
