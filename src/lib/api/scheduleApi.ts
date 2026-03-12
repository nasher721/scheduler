/**
 * Schedule read-only API – summary, scenarios, last optimization result, agent tools
 */

import { requestJson } from "./client";

export interface ScheduleSummaryResponse {
  startDate: string;
  numWeeks: number;
  slotCount: number;
  scenarioCount: number;
  providerCount: number;
  updatedAt: string;
}

export interface ScheduleScenariosResponse {
  scenarios: unknown[];
  total: number;
  updatedAt: string;
}

export interface LastOptimizationResultResponse {
  success: boolean;
  schedule?: unknown;
  decisions?: unknown[];
  metrics?: Record<string, number>;
  duration?: number;
  timestamp?: number;
}

export interface AgentToolDescriptor {
  id: string;
  method: string;
  path: string;
  description: string;
  params: Record<string, string>;
}

export interface AgentToolsResponse {
  tools: AgentToolDescriptor[];
  updatedAt: string;
}

export async function fetchScheduleSummary(): Promise<ScheduleSummaryResponse> {
  return requestJson<ScheduleSummaryResponse>(
    "/api/schedule/summary",
    { method: "GET" },
    "Fetch schedule summary"
  );
}

export async function fetchScheduleScenarios(): Promise<ScheduleScenariosResponse> {
  return requestJson<ScheduleScenariosResponse>(
    "/api/schedule/scenarios",
    { method: "GET" },
    "Fetch schedule scenarios"
  );
}

export async function fetchLastOptimizationResult(): Promise<LastOptimizationResultResponse | null> {
  try {
    return await requestJson<LastOptimizationResultResponse>(
      "/api/ai/agents/optimize/result",
      { method: "GET" },
      "Fetch last optimization result"
    );
  } catch {
    return null;
  }
}

export async function fetchAgentTools(): Promise<AgentToolsResponse> {
  return requestJson<AgentToolsResponse>(
    "/api/agent-tools",
    { method: "GET" },
    "Fetch agent tools"
  );
}
