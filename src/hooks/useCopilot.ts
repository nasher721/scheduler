import { useState, useCallback, useEffect, useRef } from "react";
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

  // Use refs for callbacks to avoid dependency issues
  const optionsRef = useRef(options);
  const storeRef = useRef(store);
  
  // Keep refs up to date
  useEffect(() => {
    optionsRef.current = options;
    storeRef.current = store;
  });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.currentConversationId]);

  const sendMessage = useCallback(async (content: string) => {
    const currentStore = storeRef.current;
    const currentOptions = optionsRef.current;
    
    if (!currentStore.currentConversationId) return;

    setIsLoading(true);
    setIsTyping(true);

    // Add user message to store
    const userMessage: CopilotMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    currentStore.addMessageToConversation(currentStore.currentConversationId, userMessage);

    try {
      const response = await sendCopilotMessage(
        content,
        currentOptions.context,
        currentStore.copilotConversations.find(c => c.id === currentStore.currentConversationId)?.messages || []
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

      currentStore.addMessageToConversation(currentStore.currentConversationId, assistantMessage);
      setSuggestions(response.result.suggestions || []);
      currentOptions.onMessageReceived?.(assistantMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      const assistantMessage: CopilotMessage = {
        id: `error_${Date.now()}`,
        role: "assistant",
        content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
        timestamp: new Date().toISOString(),
        suggestions: ["Try again", "Show help"],
      };

      currentStore.addMessageToConversation(currentStore.currentConversationId, assistantMessage);
      currentOptions.onError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  }, []); // No dependencies needed since we use refs

  const clearMessages = useCallback(() => {
    const currentStore = storeRef.current;
    if (currentStore.currentConversationId) {
      currentStore.deleteConversation(currentStore.currentConversationId);
      currentStore.createConversation();
    }
  }, []);

  const refreshSuggestions = useCallback(async () => {
    const currentOptions = optionsRef.current;
    try {
      const response = await getCopilotSuggestions(currentOptions.context);
      const recs = response.result.recommendations || [];
      setSuggestions(recs.map((r) => r.title));
    } catch (error) {
      console.error("Failed to refresh suggestions:", error);
    }
  }, []);

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
