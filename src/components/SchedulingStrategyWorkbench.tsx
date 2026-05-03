import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  Wand2,
} from "lucide-react";
import { useScheduleStore } from "../store";
import { buildScheduleRiskDigest, type RiskSeverity } from "@/lib/scheduleRisk";
import { cn } from "@/lib/utils";

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
    trigger: "Unexpected admissions, transfer-ins, or consult volume.",
    impacts: ["Critical coverage gaps", "Uneven night burden", "Higher fatigue risk"],
    guardrails: [
      "Cap rolling weekly shift totals for the most loaded providers.",
      "Prefer NIGHT_FLOAT and AIRWAY coverage before flexible services.",
    ],
    interventions: [
      "Fill critical-service gaps before standard services.",
      "Reserve one backup provider for high-acuity dates.",
    ],
  },
  {
    id: "provider-outage",
    name: "Provider Outage / Leave",
    trigger: "Sick calls, emergency leave, or credentialing delays.",
    impacts: ["Single-point skill failure", "Cross-campus conflicts", "Unfilled critical slots"],
    guardrails: [
      "Protect remaining providers with max-shift limits.",
      "Separate repeated pairings when a service loses depth.",
    ],
    interventions: [
      "Create a scenario snapshot before reassignment.",
      "Prioritize NIGHT_FLOAT and NEURO_CRITICAL coverage first.",
    ],
  },
  {
    id: "fairness-rebalance",
    name: "Fairness & Burnout Rebalance",
    trigger: "Assignment skew persists over multiple weeks.",
    impacts: ["Morale erosion", "Excessive nights", "Reduced schedule acceptance"],
    guardrails: [
      "Apply weekly max-shift rules to overloaded providers.",
      "Recheck night variance before publishing.",
    ],
    interventions: [
      "Use preferred dates to improve acceptance.",
      "Compare a rebalance scenario against the active schedule.",
    ],
  },
];

const severityConfig: Record<RiskSeverity, { label: string; className: string; icon: ReactNode }> = {
  critical: {
    label: "Needs action",
    className: "border-error/25 bg-error/10 text-error",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  warning: {
    label: "Review needed",
    className: "border-warning/25 bg-warning/10 text-warning",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  healthy: {
    label: "Ready",
    className: "border-success/25 bg-success/10 text-success",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
};

export function SchedulingStrategyWorkbench() {
  const { providers, slots, customRules, addCustomRule, createScenario } = useScheduleStore();
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(scenarioTemplates[0].id);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [maxShifts, setMaxShifts] = useState<number>(4);

  const riskDigest = useMemo(
    () => buildScheduleRiskDigest(slots, providers, customRules),
    [customRules, providers, slots],
  );
  const selectedScenario = useMemo(
    () => scenarioTemplates.find((scenario) => scenario.id === selectedScenarioId) ?? scenarioTemplates[0],
    [selectedScenarioId],
  );
  const selectedProvider =
    providers.find((provider) => provider.id === selectedProviderId) ??
    providers.find((provider) => provider.id === riskDigest.mostLoadedProvider?.providerId) ??
    providers[0];
  const severity = severityConfig[riskDigest.severity];
  const topCriticalGaps = riskDigest.criticalUnfilled.slice(0, 4);
  const topMismatches = riskDigest.skillMismatches.slice(0, 3);

  const handleApplyRule = () => {
    if (!selectedProvider || maxShifts < 1) return;
    addCustomRule({
      type: "MAX_SHIFTS_PER_WEEK",
      providerId: selectedProvider.id,
      maxShifts,
    });
  };

  const handleCreateScenario = () => {
    createScenario(`${selectedScenario.name} ${new Date().toLocaleDateString()}`);
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="satin-panel p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground-muted">
                Live strategy cockpit
              </p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Scheduling Strategy
              </h2>
            </div>
            <div className={cn("inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold", severity.className)}>
              {severity.icon}
              {severity.label}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <MetricTile label="Coverage" value={`${riskDigest.coveragePercent}%`} tone={riskDigest.coveragePercent >= 95 ? "success" : riskDigest.coveragePercent >= 80 ? "warning" : "error"} />
            <MetricTile label="Filled" value={`${riskDigest.filledSlots}/${riskDigest.totalSlots}`} />
            <MetricTile label="Critical gaps" value={riskDigest.criticalUnfilled.length} tone={riskDigest.criticalUnfilled.length > 0 ? "error" : "success"} />
            <MetricTile label="Skill mismatches" value={riskDigest.skillMismatches.length} tone={riskDigest.skillMismatches.length > 0 ? "warning" : "success"} />
            <MetricTile label="Load risks" value={riskDigest.overloadedProviders.length} tone={riskDigest.overloadedProviders.length > 0 ? "warning" : "success"} />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
          <section className="satin-panel p-5">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <ClipboardList className="h-4 w-4" />
                  Scenario Playbook
                </h3>
                <p className="mt-1 text-sm text-foreground-muted">Choose the operating mode, then apply the next guardrail.</p>
              </div>
              <button
                type="button"
                onClick={handleCreateScenario}
                className="command-button shrink-0"
              >
                Save scenario
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {scenarioTemplates.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => setSelectedScenarioId(scenario.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    selectedScenarioId === scenario.id
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-surface hover:border-primary/30",
                  )}
                >
                  <p className="text-sm font-bold text-foreground">{scenario.name}</p>
                  <p className="mt-1 text-xs leading-5 text-foreground-muted">{scenario.trigger}</p>
                </button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <PlaybookColumn title="Likely impacts" items={selectedScenario.impacts} />
              <PlaybookColumn title="Guardrails" items={selectedScenario.guardrails} />
              <PlaybookColumn title="Interventions" items={selectedScenario.interventions} />
            </div>
          </section>

          <section className="satin-panel p-5">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Wand2 className="h-4 w-4" />
              Next Best Actions
            </h3>
            <div className="mt-4 flex flex-col gap-3">
              {riskDigest.recommendedActions.map((action) => (
                <div key={action} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-sm font-medium leading-6 text-foreground-secondary">{action}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <section className="satin-panel p-5 xl:col-span-2">
            <div className="flex items-center gap-2 border-b border-border pb-4">
              <Stethoscope className="h-4 w-4 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Risk Queue</h3>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <RiskList
                title="Critical gaps"
                empty="No critical coverage gaps."
                items={topCriticalGaps.map((gap) => `${gap.date} - ${gap.location} - ${gap.type}`)}
                tone="error"
              />
              <RiskList
                title="Skill mismatches"
                empty="No mismatched assignments."
                items={topMismatches.map(({ slot, provider }) => `${provider.name} needs ${slot.requiredSkill} for ${slot.location}`)}
                tone="warning"
              />
            </div>
          </section>

          <section className="satin-panel p-5">
            <div className="flex items-center gap-2 border-b border-border pb-4">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Rapid Guardrail</h3>
            </div>

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Provider</span>
                <select
                  value={selectedProvider?.id ?? ""}
                  onChange={(event) => setSelectedProviderId(event.target.value)}
                  className="input-base w-full rounded-lg py-2 text-sm"
                >
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Max shifts per week</span>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={maxShifts}
                  onChange={(event) => setMaxShifts(Math.min(14, Math.max(1, Number(event.target.value) || 1)))}
                  className="input-base w-full rounded-lg py-2 text-sm"
                />
              </label>

              <button
                type="button"
                onClick={handleApplyRule}
                disabled={!selectedProvider}
                className="command-button w-full justify-center bg-primary text-primary-foreground disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                Apply guardrail
              </button>

              {riskDigest.mostLoadedProvider && (
                <div className="rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm text-foreground-secondary">
                  <p className="font-semibold text-foreground">Suggested target</p>
                  <p className="mt-1">
                    {riskDigest.mostLoadedProvider.providerName} is assigned {riskDigest.mostLoadedProvider.totalAssigned} shifts
                    against a target of {riskDigest.mostLoadedProvider.totalTarget}.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "success" | "warning" | "error";
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">{label}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-bold text-foreground",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "error" && "text-error",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function PlaybookColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">{title}</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <p key={item} className="text-sm leading-6 text-foreground-secondary">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function RiskList({
  title,
  items,
  empty,
  tone,
}: {
  title: string;
  items: string[];
  empty: string;
  tone: "error" | "warning";
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm font-bold text-foreground">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/10 p-3 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4" />
            {empty}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item}
              className={cn(
                "rounded-lg border p-3 text-sm font-medium leading-6",
                tone === "error" ? "border-error/20 bg-error/10 text-error" : "border-warning/20 bg-warning/10 text-warning",
              )}
            >
              {item}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
