import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useCopilot } from "@/hooks/useCopilot";
import { useScheduleStore } from "@/store";
import type { CopilotContext } from "@/types";
import {
  Bot,
  Send,
  X,
  Loader2,
  User,
  Sparkles,
  Plus,
  Trash2,
  MessageSquare,
} from "lucide-react";

interface CopilotChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  context?: Partial<CopilotContext>;
}

export function CopilotChatDrawer({ isOpen, onClose, context = {} }: CopilotChatDrawerProps) {
  const store = useScheduleStore();
  const [inputValue, setInputValue] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const slots = store.slots;
  const totalSlots = slots.length;
  const unfilledSlots = slots.filter((s) => !s.providerId).length;
  
  const copilotContext: CopilotContext = {
    viewType: context.viewType || "week",
    selectedDate: context.selectedDate || store.selectedDate || null,
    selectedProviderId: context.selectedProviderId || store.selectedProviderId || null,
    userRole: context.userRole || store.currentUser?.role || "CLINICIAN",
    visibleProviderCount: context.visibleProviderCount || store.providers.length,
    scheduleSummary: context.scheduleSummary || { totalSlots, unfilledSlots, providerCount: store.providers.length },
    currentUser: context.currentUser || (store.currentUser ? { id: store.currentUser.id, name: store.currentUser.name } : null),
  };

  const { 
    messages, 
    isLoading, 
    isTyping, 
    sendMessage, 
    suggestions 
  } = useCopilot({
    context: copilotContext,
    onError: (error) => {
      console.error("Copilot error:", error);
    },
  });

  const currentConversation = store.copilotConversations.find(
    c => c.id === store.currentConversationId
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] bg-slate-900/40"
            onClick={onClose}
            aria-label="Close drawer"
          />
          
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed top-0 right-0 z-[60] h-full w-full max-w-lg bg-white shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-violet-50">
                    <Bot className="h-5 w-5 text-blue-600" />
                  </div>
                  <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-yellow-500" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Schedule Copilot</h2>
                  <p className="text-xs text-slate-500">
                    {currentConversation?.title || "New conversation"}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    showHistory ? "bg-blue-100 text-blue-600" : "text-slate-500 hover:bg-slate-100"
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={createNewChat}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-b border-slate-100 bg-slate-50"
                >
                  <div className="p-3 max-h-40 overflow-y-auto">
                    <div className="space-y-1">
                      {store.copilotConversations.map((conv) => (
                        <button
                          key={conv.id}
                          type="button"
                          onClick={() => loadChat(conv.id)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between",
                            conv.id === store.currentConversationId
                              ? "bg-blue-100 text-blue-700"
                              : "hover:bg-slate-100 text-slate-600"
                          )}
                        >
                          <span className="truncate flex-1">{conv.title}</span>
                          <button
                            type="button"
                            onClick={(e) => deleteChat(conv.id, e)}
                            className="p-1 hover:bg-red-100 hover:text-red-600 rounded opacity-0 group-hover:opacity-100"
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

            <div className="flex-1 overflow-y-auto px-4 py-4" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600">
                  <p className="font-medium text-slate-800 mb-2">Ask me about your schedule</p>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li>Who's covering this weekend?</li>
                    <li>Show me conflicts for next week</li>
                    <li>Optimize the schedule</li>
                  </ul>
                </div>
              ) : (
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
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                          <Bot className="h-4 w-4 text-blue-600" />
                        </div>
                      )}
                      
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                          message.role === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-800"
                        )}
                      >
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        
                        {message.role === "assistant" && message.suggestions && message.suggestions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {message.suggestions.map((suggestion, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setInputValue(suggestion);
                                  inputRef.current?.focus();
                                }}
                                className="text-xs px-2 py-1 rounded-full bg-white border border-slate-200 hover:bg-slate-50"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {message.role === "user" && (
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600">
                          <User className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex gap-2 justify-start">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                        <Bot className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="bg-slate-100 rounded-2xl rounded-bl-md px-3 py-2 flex items-center gap-1">
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {suggestions.length > 0 && !isLoading && (
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.slice(0, 3).map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setInputValue(suggestion);
                        inputRef.current?.focus();
                      }}
                      className="text-xs px-2 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 border-t border-slate-100">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your schedule..."
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  disabled={isLoading}
                />
                <button
                  type="button"
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
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
