import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useCopilot } from "@/hooks/useCopilot";
import { useScheduleStore } from "@/store";
import { useCopilotKeyboard, useMobileDetect } from "@/hooks/useKeyboardShortcuts";
import { MobileCopilotSheet } from "./MobileCopilotSheet";
import { KeyboardHelpOverlay } from "./KeyboardHelpOverlay";
import { ConversationExportDialog } from "./ConversationExportDialog";
import { 
  Bot, 
  Send, 
  X, 
  Minimize2, 
  Sparkles,
  Loader2,
  User,
  Lightbulb,
  ChevronRight,
  Plus,
  History,
  Trash2,
  Mic,
  MicOff,
  ThumbsUp,
  ThumbsDown,
  Keyboard,
  Settings
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CopilotPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function CopilotPanel({ isOpen, onToggle }: CopilotPanelProps) {
  const store = useScheduleStore();
  const [inputValue, setInputValue] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const recognitionRef = useRef<any | null>(null);
  
  // Mobile detection
  const { isMobile } = useMobileDetect();
  
  // Keyboard shortcuts
  const { showHelp, setShowHelp } = useCopilotKeyboard(
    isOpen,
    onToggle,
    () => store.createConversation(),
    () => inputRef.current?.focus()
  );

  // Build context from current store state
  const context = {
    viewType: "week" as const,
    selectedDate: store.selectedDate || null,
    selectedProviderId: store.selectedProviderId || null,
    userRole: store.currentUser?.role || "CLINICIAN",
    visibleProviderCount: store.providers.length,
  };

  const { 
    messages, 
    isLoading, 
    isTyping, 
    sendMessage, 
    suggestions,
    clearMessages
  } = useCopilot({
    context,
    onError: (error) => {
      console.error("Copilot error:", error);
    },
  });

  // Get current conversation info
  const currentConversation = store.copilotConversations.find(
    c => c.id === store.currentConversationId
  );

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }
        
        if (finalTranscript) {
          setInputValue(finalTranscript);
        }
      };
      
      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    const message = inputValue.trim();
    setInputValue("");
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    inputRef.current?.focus();
  };

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      store.showToast({
        type: 'error',
        title: 'Voice Not Supported',
        message: 'Your browser does not support voice input'
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInputValue("");
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const handleFeedback = (messageId: string, action: 'accepted' | 'rejected') => {
    store.recordCopilotFeedback({
      conversationId: store.currentConversationId || '',
      messageId,
      intent: messages.find(m => m.id === messageId)?.intent || 'unknown',
      action,
    });
    
    store.showToast({
      type: 'success',
      title: 'Feedback Recorded',
      message: 'Thank you for helping me improve!'
    });
  };

  const createNewChat = () => {
    store.createConversation();
    setShowHistory(false);
  };

  const loadChat = (id: string) => {
    store.loadConversation(id);
    setShowHistory(false);
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    store.deleteConversation(id);
  };

  return (
    <>
      {/* Floating toggle button when collapsed */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed right-4 top-20 z-50 w-12 h-12 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all hover:scale-105"
        >
          <Bot className="h-5 w-5" />
        </button>
      )}

      {/* Main panel */}
      <aside
        className={cn(
          "fixed right-0 top-16 z-40 h-[calc(100vh-4rem)] bg-white border-l shadow-xl transition-all duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0 w-[380px] opacity-100" : "translate-x-full w-0 opacity-0 overflow-hidden"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-transparent">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bot className="h-5 w-5 text-blue-600" />
              <Sparkles className="h-3 w-3 text-yellow-500 absolute -top-1 -right-1" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm">Schedule AI</span>
              {currentConversation && (
                <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                  {currentConversation.title}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setShowHelp(true)}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
              title="Keyboard Shortcuts (Shift+?)"
            >
              <Keyboard className="h-4 w-4" />
            </button>
            <button 
              onClick={() => setShowExportDialog(true)}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
              title="Export/Import"
            >
              <Settings className="h-4 w-4" />
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                showHistory ? "bg-blue-100 text-blue-600" : "hover:bg-slate-100 text-slate-500"
              )}
              title="History"
            >
              <History className="h-4 w-4" />
            </button>
            <button 
              onClick={createNewChat}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
              title="New Chat (Ctrl/Cmd+N)"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button 
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500" 
              onClick={onToggle}
              title="Minimize"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            <button 
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500" 
              onClick={onToggle}
              title="Close (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Conversation History Sidebar */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-slate-100 bg-slate-50 overflow-hidden"
            >
              <div className="p-3 max-h-48 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-600">Recent Conversations</span>
                  <button 
                    onClick={createNewChat}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    New
                  </button>
                </div>
                <div className="space-y-1">
                  {store.copilotConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => loadChat(conv.id)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center justify-between group",
                        conv.id === store.currentConversationId
                          ? "bg-blue-100 text-blue-700"
                          : "hover:bg-slate-100 text-slate-600"
                      )}
                    >
                      <span className="truncate flex-1">{conv.title}</span>
                      <button
                        onClick={(e) => deleteChat(conv.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 hover:text-red-600 rounded transition-all"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 px-4 py-4 overflow-y-auto" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-2",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="h-4 w-4 text-blue-600" />
                  </div>
                )}
                
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    message.role === "user"
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-slate-100 rounded-bl-md"
                  )}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  
                  {/* Suggestion chips */}
                  {message.role === "assistant" && message.suggestions && message.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {message.suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="text-xs px-2 py-1 rounded-full bg-white hover:bg-slate-50 transition-colors border border-slate-200"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Feedback buttons for assistant messages */}
                  {message.role === "assistant" && message.intent && (
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-200/50">
                      <span className="text-[10px] text-slate-400">Was this helpful?</span>
                      <button
                        onClick={() => handleFeedback(message.id, 'accepted')}
                        className="p-1 hover:bg-green-100 rounded transition-colors"
                        title="Helpful"
                      >
                        <ThumbsUp className="h-3 w-3 text-slate-400 hover:text-green-600" />
                      </button>
                      <button
                        onClick={() => handleFeedback(message.id, 'rejected')}
                        className="p-1 hover:bg-red-100 rounded transition-colors"
                        title="Not helpful"
                      >
                        <ThumbsDown className="h-3 w-3 text-slate-400 hover:text-red-600" />
                      </button>
                    </div>
                  )}
                </div>

                {message.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex gap-2 justify-start">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-blue-600" />
                </div>
                <div className="bg-slate-100 rounded-2xl rounded-bl-md px-3 py-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick suggestions */}
        {suggestions.length > 0 && !isLoading && (
          <div className="px-4 py-2 border-t bg-slate-50">
            <div className="flex items-center gap-1 text-xs text-slate-500 mb-1.5">
              <Lightbulb className="h-3 w-3" />
              <span>Quick actions</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.slice(0, 3).map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInputValue(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="text-xs px-2 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1"
                >
                  {suggestion}
                  <ChevronRight className="h-3 w-3" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="p-3 border-t bg-white">
          <div className="flex gap-2">
            {/* Voice button */}
            <button
              onClick={toggleVoice}
              className={cn(
                "p-2 rounded-lg transition-colors",
                isListening 
                  ? "bg-red-100 text-red-600 animate-pulse" 
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              )}
              title={isListening ? "Stop listening" : "Voice input"}
            >
              {isListening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </button>
            
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "Listening..." : "Type a message..."}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              disabled={isLoading}
            />
            <button 
              onClick={handleSend} 
              disabled={!inputValue.trim() || isLoading}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <div className="text-[10px] text-slate-400">
              AI assistant • Responses may require confirmation
            </div>
            {messages.length > 1 && (
              <button
                onClick={clearMessages}
                className="text-[10px] text-slate-400 hover:text-red-600 transition-colors"
              >
                Clear chat
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Sheet */}
      {isMobile && (
        <MobileCopilotSheet isOpen={isOpen} onToggle={onToggle} />
      )}

      {/* Keyboard Help Overlay */}
      <KeyboardHelpOverlay 
        isOpen={showHelp} 
        onClose={() => setShowHelp(false)} 
      />

      {/* Export/Import Dialog */}
      <ConversationExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
      />
    </>
  );
}
