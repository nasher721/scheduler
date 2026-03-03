import { optimizeSchedule } from "./ai-orchestrator.js";

export function listSolverProfiles() {
  return [
    {
      id: "greedy-balanced",
      label: "Greedy Balanced",
      description: "Deterministic greedy pass optimized for safe baseline coverage.",
      engine: "deterministic-greedy",
      default: true,
    },
    {
      id: "cp-sat-future",
      label: "CP-SAT (planned)",
      description: "Reserved profile for OR-Tools CP-SAT integration.",
      engine: "planned",
      default: false,
    },
  ];
}

export async function optimizeWithSolver(input = {}) {
  const solverProfile = String(input?.solverProfile || "greedy-balanced").toLowerCase();
  const optimization = await optimizeSchedule(input);

  return {
    ...optimization,
    source: "solver-service",
    solver: {
      profile: solverProfile,
      engine: solverProfile === "cp-sat-future" ? "planned" : "deterministic-greedy",
      hybridMode: true,
      nextStep:
        solverProfile === "cp-sat-future"
          ? "Implement OR-Tools CP-SAT service adapter and route this profile to it."
          : null,
    },
  };
}
