import { useState, useCallback, useEffect, useRef } from "react";
import { useScheduleStore, type CopilotMessage, type CopilotConversation } from "@/store";
import type { SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from "@/types/speechRecognition";
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

  // Use refs for store and options to avoid dependency issues
  const storeRef = useRef(store);
  const optionsRef = useRef(options);
  
  // Keep refs up to date
  useEffect(() => {
    storeRef.current = store;
    optionsRef.current = options;
  });

  // Get current conversation messages
  const currentConversation = store.copilotConversations.find(
    c => c.id === store.currentConversationId
  );
  const messages = currentConversation?.messages || [];

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionConstructor) {
      const recognition = new SpeechRecognitionConstructor();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
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

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.currentConversationId]);

  const sendMessage = useCallback(async (content: string) => {
    const currentStore = storeRef.current;
    const currentOptions = optionsRef.current;
    
    if (!currentStore.currentConversationId) return;

    setIsLoading(true);
    setIsTyping(true);

    // Add user message
    const userMessage: CopilotMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    currentStore.addMessageToConversation(currentStore.currentConversationId, userMessage);

    try {
      const currentMessages = currentStore.copilotConversations.find(
        c => c.id === currentStore.currentConversationId
      )?.messages || [];
      
      const response = await sendCopilotMessage(
        content,
        currentOptions.context,
        currentMessages
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
  }, []); // No dependencies since we use refs

  const createNewConversation = useCallback(() => {
    storeRef.current.createConversation();
  }, []);

  const loadConversation = useCallback((id: string) => {
    storeRef.current.loadConversation(id);
  }, []);

  const deleteConversation = useCallback((id: string) => {
    storeRef.current.deleteConversation(id);
  }, []);

  const clearCurrentConversation = useCallback(() => {
    const currentStore = storeRef.current;
    if (currentStore.currentConversationId) {
      // Delete and create new
      currentStore.deleteConversation(currentStore.currentConversationId);
      currentStore.createConversation();
    }
  }, []);

  const recordFeedback = useCallback((messageId: string, action: 'accepted' | 'rejected' | 'modified' | 'ignored') => {
    const currentStore = storeRef.current;
    const currentMessages = currentStore.copilotConversations.find(
      c => c.id === currentStore.currentConversationId
    )?.messages || [];
    const message = currentMessages.find(m => m.id === messageId);
    
    if (message?.intent) {
      currentStore.recordCopilotFeedback({
        conversationId: currentStore.currentConversationId || '',
        messageId,
        intent: message.intent,
        action,
      });
    }
  }, []);

  const getIntentScore = useCallback((intent: string) => {
    return storeRef.current.getCopilotPreferenceScore(intent);
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

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      setTranscript("");
      setIsListening(true);
      recognitionRef.current.start();
    } else {
      storeRef.current.showToast({
        type: 'error',
        title: 'Voice Not Supported',
        message: 'Your browser does not support voice input'
      });
    }
  }, []);

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


