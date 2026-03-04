import { useState, useCallback, useEffect, useRef } from "react";
import { useScheduleStore, type CopilotMessage, type CopilotConversation } from "@/store";
import {
  sendCopilotMessage,
  parseCopilotIntent,
  getCopilotSuggestions,
  type CopilotContext
} from "@/lib/api";

interface UseCopilotEnhancedOptions {
  context: CopilotContext;
  onMessageReceived?: (message: CopilotMessage) => void;
  onError?: (error: Error) => void;
}

interface UseCopilotEnhancedReturn {
  // Messages
  messages: CopilotMessage[];
  isLoading: boolean;
  isTyping: boolean;
  sendMessage: (content: string) => Promise<void>;

  // Conversations
  conversations: CopilotConversation[];
  currentConversationId: string | null;
  createNewConversation: () => void;
  loadConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  clearCurrentConversation: () => void;

  // Feedback
  recordFeedback: (messageId: string, action: 'accepted' | 'rejected' | 'modified' | 'ignored') => void;
  getIntentScore: (intent: string) => number;

  // Suggestions
  suggestions: string[];
  refreshSuggestions: () => Promise<void>;

  // Voice
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  transcript: string;
}

export function useCopilotEnhanced(options: UseCopilotEnhancedOptions): UseCopilotEnhancedReturn {
  const store = useScheduleStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Get current conversation messages
  const currentConversation = store.copilotConversations.find(
    c => c.id === store.currentConversationId
  );
  const messages = currentConversation?.messages || [];

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setTranscript(prev => prev + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  // Create new conversation if none exists
  useEffect(() => {
    if (!store.currentConversationId) {
      store.createConversation();
    }
  }, [store.currentConversationId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!store.currentConversationId) return;

    setIsLoading(true);
    setIsTyping(true);

    // Add user message
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
  }, [store.currentConversationId, messages, options.context, options.onMessageReceived, options.onError]);

  const createNewConversation = useCallback(() => {
    store.createConversation();
  }, [store]);

  const loadConversation = useCallback((id: string) => {
    store.loadConversation(id);
  }, [store]);

  const deleteConversation = useCallback((id: string) => {
    store.deleteConversation(id);
  }, [store]);

  const clearCurrentConversation = useCallback(() => {
    if (store.currentConversationId) {
      // Delete and create new
      store.deleteConversation(store.currentConversationId);
      store.createConversation();
    }
  }, [store]);

  const recordFeedback = useCallback((messageId: string, action: 'accepted' | 'rejected' | 'modified' | 'ignored') => {
    const message = messages.find(m => m.id === messageId);
    if (message?.intent) {
      store.recordCopilotFeedback({
        conversationId: store.currentConversationId || '',
        messageId,
        intent: message.intent,
        action,
      });
    }
  }, [messages, store.currentConversationId, store]);

  const getIntentScore = useCallback((intent: string) => {
    return store.getCopilotPreferenceScore(intent);
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

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      setTranscript("");
      setIsListening(true);
      recognitionRef.current.start();
    } else {
      store.showToast({
        type: 'error',
        title: 'Voice Not Supported',
        message: 'Your browser does not support voice input'
      });
    }
  }, [store]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  // Auto-submit transcript when voice stops
  useEffect(() => {
    if (!isListening && transcript.trim() && !isLoading) {
      sendMessage(transcript.trim());
      setTranscript("");
    }
  }, [isListening, transcript, isLoading, sendMessage]);

  return {
    messages,
    isLoading,
    isTyping,
    sendMessage,
    conversations: store.copilotConversations,
    currentConversationId: store.currentConversationId,
    createNewConversation,
    loadConversation,
    deleteConversation,
    clearCurrentConversation,
    recordFeedback,
    getIntentScore,
    suggestions,
    refreshSuggestions,
    isListening,
    startListening,
    stopListening,
    transcript,
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

// TypeScript declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    onend: () => void;
    start: () => void;
    stop: () => void;
  }

  interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: {
      length: number;
      [index: number]: {
        isFinal: boolean;
        [index: number]: {
          transcript: string;
        };
      };
    };
  }

  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
  }

  var SpeechRecognition: {
    prototype: SpeechRecognition;
    new(): SpeechRecognition;
  };
}
