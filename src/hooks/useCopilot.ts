import { useState, useCallback, useEffect } from "react";
import { useScheduleStore } from "@/store";
import type { CopilotMessage } from "@/store";
import {
  sendCopilotMessage,
  parseCopilotIntent,
  getCopilotSuggestions,
  type CopilotContext
} from "@/lib/api";

interface UseCopilotOptions {
  context: CopilotContext;
  onMessageReceived?: (message: CopilotMessage) => void;
  onError?: (error: Error) => void;
}

interface UseCopilotReturn {
  messages: CopilotMessage[];
  isLoading: boolean;
  isTyping: boolean;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  suggestions: string[];
  refreshSuggestions: () => Promise<void>;
}

export function useCopilot(options: UseCopilotOptions): UseCopilotReturn {
  const store = useScheduleStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Get current conversation messages from store
  const currentConversation = store.copilotConversations.find(
    c => c.id === store.currentConversationId
  );
  const messages = currentConversation?.messages || [];

  // Create conversation if none exists
  useEffect(() => {
    if (!store.currentConversationId) {
      store.createConversation();
    }
  }, [store.currentConversationId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!store.currentConversationId) return;

    setIsLoading(true);
    setIsTyping(true);

    // Add user message to store
    const userMessage: CopilotMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    store.addMessageToConversation(store.currentConversationId, userMessage);

    try {
      const response = await sendCopilotMessage(
        content,
        options.context,
        messages
      );

      const assistantMessage: CopilotMessage = {
        id: response.result.messageId,
        role: "assistant",
        content: response.result.response,
        timestamp: response.updatedAt,
        intent: response.result.intent,
        confidence: response.result.confidence,
        suggestions: response.result.suggestions,
        requiresConfirmation: response.result.requiresConfirmation,
        actions: response.result.actions,
      };

      store.addMessageToConversation(store.currentConversationId, assistantMessage);
      setSuggestions(response.result.suggestions || []);
      options.onMessageReceived?.(assistantMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      const assistantMessage: CopilotMessage = {
        id: `error_${Date.now()}`,
        role: "assistant",
        content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
        timestamp: new Date().toISOString(),
        suggestions: ["Try again", "Show help"],
      };

      store.addMessageToConversation(store.currentConversationId, assistantMessage);
      options.onError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  }, [store, store.currentConversationId, messages, options.context, options.onMessageReceived, options.onError]);

  const clearMessages = useCallback(() => {
    if (store.currentConversationId) {
      store.deleteConversation(store.currentConversationId);
      store.createConversation();
    }
  }, [store]);

  const refreshSuggestions = useCallback(async () => {
    try {
      const response = await getCopilotSuggestions(options.context);
      const recs = response.result.recommendations || [];
      setSuggestions(recs.map((r) => r.title));
    } catch (error) {
      console.error("Failed to refresh suggestions:", error);
    }
  }, [options.context]);

  return {
    messages,
    isLoading,
    isTyping,
    sendMessage,
    clearMessages,
    suggestions,
    refreshSuggestions,
  };
}

// Hook for parsing intent (useful for inline suggestions)
export function useCopilotIntent() {
  const [isParsing, setIsParsing] = useState(false);

  const parseIntent = useCallback(async (text: string, context: CopilotContext) => {
    setIsParsing(true);
    try {
      const result = await parseCopilotIntent(text, context);
      return result.result;
    } finally {
      setIsParsing(false);
    }
  }, []);

  return { parseIntent, isParsing };
}
