/**
 * Copilot AI API
 * AI assistant chat and intent parsing
 */

import { requestJson } from "./client";
import {
  type CopilotMessage,
  type CopilotContext,
} from "../../types";

export interface CopilotChatResponse {
  result: {
    messageId: string;
    intent: string;
    confidence: number;
    entities: Record<string, unknown>;
    response: string;
    suggestions: string[];
    requiresConfirmation: boolean;
    preview: unknown | null;
    actions: unknown[];
  };
  updatedAt: string;
}

export interface CopilotIntentResponse {
  result: {
    provider: string;
    source: string;
    intent: string;
    confidence: number;
    entities: {
      providerName: string | null;
      date: string | null;
      shiftType: string | null;
      targetProvider: string | null;
    };
    originalText: string;
  };
  updatedAt: string;
}

export interface CopilotSuggestionsResponse {
  result: {
    recommendations: Array<{
      id: string;
      title: string;
      impact: 'high' | 'medium' | 'low';
      rationale: string;
      context?: Record<string, unknown>;
    }>;
    context: CopilotContext;
    source: string;
  };
  updatedAt: string;
}

export interface CopilotCapabilitiesResponse {
  result: {
    capabilitySchemaVersion: string;
    intents: string[];
    actions: string[];
    confirmationRequiredIntents: string[];
    examplePrompts: string[];
  };
  updatedAt: string;
}

export async function sendCopilotMessage(
  message: string,
  context: CopilotContext,
  conversationHistory: CopilotMessage[] = []
): Promise<CopilotChatResponse> {
  return requestJson<CopilotChatResponse>(
    "/api/copilot/chat",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, context, conversationHistory }),
    },
    "Send copilot message"
  );
}

export async function parseCopilotIntent(
  text: string,
  context: CopilotContext
): Promise<CopilotIntentResponse> {
  return requestJson<CopilotIntentResponse>(
    "/api/copilot/intent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, context }),
    },
    "Parse copilot intent"
  );
}

export async function getCopilotSuggestions(
  context: CopilotContext
): Promise<CopilotSuggestionsResponse> {
  const params = new URLSearchParams();
  if (context.viewType) params.append('viewType', context.viewType);
  if (context.selectedDate) params.append('selectedDate', context.selectedDate);
  if (context.selectedProviderId) params.append('selectedProviderId', context.selectedProviderId);
  if (context.userRole) params.append('userRole', context.userRole);
  if (context.visibleProviderCount !== undefined) params.append('visibleProviderCount', context.visibleProviderCount.toString());

  return requestJson<CopilotSuggestionsResponse>(
    `/api/copilot/suggestions?${params.toString()}`,
    {
      method: "GET",
    },
    "Get copilot suggestions"
  );
}

export async function getCopilotCapabilities(): Promise<CopilotCapabilitiesResponse> {
  return requestJson<CopilotCapabilitiesResponse>(
    "/api/copilot/capabilities",
    {
      method: "GET",
    },
    "Load copilot capabilities"
  );
}

// Marketplace copilot query (Step 5)
export interface CopilotQueryResponse {
  query: string;
  intent: 'coverage_request' | 'schedule_query' | 'availability_check' | 'unknown';
  entities: {
    providerName?: string;
    date?: string;
    shiftType?: string;
  };
  matches?: Array<{
    providerId: string;
    providerName: string;
    score: number;
    availability?: string[];
  }>;
  explanation?: string;
}

export async function queryCopilot(
  query: string,
  context?: { dateRange?: string[] }
): Promise<CopilotQueryResponse> {
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'}/api/copilot/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, context }),
  });
  if (!res.ok) throw new Error('Failed to query copilot');
  return res.json();
}
