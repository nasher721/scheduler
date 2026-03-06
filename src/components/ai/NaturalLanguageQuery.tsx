import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Sparkles, X, Loader2 } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useScheduleStore } from '@/store';
import { useNaturalLanguageQuery, type QueryResult } from '@/lib/ai/naturalLanguageQuery';
import { useToast } from '@/hooks/useToast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  result?: QueryResult;
  timestamp: Date;
}

export function NaturalLanguageQuery() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const toast = useToast();
  
  const providers = useScheduleStore(state => state.providers);
  const slots = useScheduleStore(state => state.slots);
  const { ask } = useNaturalLanguageQuery(providers, slots);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Listen for shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      const result = ask(userMessage.content);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.summary,
        result,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      toast.error('Failed to process your question. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [input, isProcessing, ask, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const suggestions = [
    "Who's working this weekend?",
    "Show me Dr. Smith's schedule",
    "How many night shifts does each provider have?",
    "What shifts are unfilled?",
  ];

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 ${
          isDark 
            ? 'bg-blue-600 hover:bg-blue-500 text-white' 
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        <Sparkles className="w-5 h-5" />
        <span className="font-medium hidden sm:inline">Ask AI</span>
        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 ml-1 text-xs bg-white/20 rounded">
          ⌘L
        </kbd>
      </button>

      {/* Chat modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`fixed inset-4 md:inset-auto md:bottom-24 md:right-6 md:w-[480px] md:h-[600px] rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col ${
                isDark ? 'bg-slate-900' : 'bg-white'
              }`}
            >
              {/* Header */}
              <div className={`flex items-center justify-between px-4 py-3 border-b ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${
                    isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                  }`}>
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Schedule Assistant
                    </h3>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Ask about schedules, providers, or coverage
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className={`p-2 rounded-lg transition-colors ${
                    isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Messages */}
              <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${
                isDark ? 'bg-slate-900' : 'bg-slate-50'
              }`}>
                {messages.length === 0 && (
                  <div className="space-y-3">
                    <div className={`text-center py-8 ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">What would you like to know?</p>
                      <p className="text-sm mt-1">Ask me anything about the schedule</p>
                    </div>

                    <div className="space-y-2">
                      <p className={`text-xs font-medium uppercase tracking-wider ${
                        isDark ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        Try asking:
                      </p>
                      {suggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setInput(suggestion);
                            inputRef.current?.focus();
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                            isDark 
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' 
                              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === 'user' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === 'user'
                        ? isDark ? 'bg-blue-600' : 'bg-blue-500'
                        : isDark ? 'bg-slate-700' : 'bg-slate-200'
                    }`}>
                      {message.role === 'user' ? (
                        <User className="w-4 h-4 text-white" />
                      ) : (
                        <Bot className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-slate-600'}`} />
                      )}
                    </div>

                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : isDark 
                          ? 'bg-slate-800 text-slate-100' 
                          : 'bg-white text-slate-900 border border-slate-200'
                    }`}>
                      <p className="text-sm leading-relaxed">{message.content}</p>
                      
                      {message.result?.details && (
                        <div className={`mt-2 pt-2 text-xs border-t ${
                          message.role === 'user' 
                            ? 'border-blue-500/30 text-blue-100' 
                            : isDark 
                              ? 'border-slate-700 text-slate-400' 
                              : 'border-slate-200 text-slate-500'
                        }`}>
                          <pre className="whitespace-pre-wrap font-mono">{message.result.details}</pre>
                        </div>
                      )}

                      {message.result?.type === 'LIST' && Array.isArray(message.result.data) && (
                        <div className={`mt-2 space-y-1 ${
                          message.role === 'user' ? 'text-blue-100' : isDark ? 'text-slate-300' : 'text-slate-600'
                        }`}>
                          {(message.result.data as any[]).slice(0, 5).map((item, i) => (
                            <div key={i} className="text-xs">
                              • {item.date || item.type}: {item.location}
                            </div>
                          ))}
                          {(message.result.data as any[]).length > 5 && (
                            <div className="text-xs opacity-70">
                              ... and {(message.result.data as any[]).length - 5} more
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isProcessing && (
                  <div className="flex gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      isDark ? 'bg-slate-700' : 'bg-slate-200'
                    }`}>
                      <Bot className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-slate-600'}`} />
                    </div>
                    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl ${
                      isDark ? 'bg-slate-800' : 'bg-white border border-slate-200'
                    }`}>
                      <Loader2 className={`w-4 h-4 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                      <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Thinking...
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className={`p-4 border-t ${
                isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
              }`}>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
                  isDark 
                    ? 'bg-slate-800 border-slate-700 focus-within:border-blue-500' 
                    : 'bg-slate-50 border-slate-200 focus-within:border-blue-500'
                }`}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about schedules..."
                    className={`flex-1 bg-transparent border-none outline-none text-sm ${
                      isDark ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={!input.trim() || isProcessing}
                    className={`p-2 rounded-lg transition-colors ${
                      input.trim() && !isProcessing
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : isDark ? 'text-slate-600' : 'text-slate-300'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className={`mt-2 text-xs text-center ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Press Enter to send, Escape to close
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default NaturalLanguageQuery;
