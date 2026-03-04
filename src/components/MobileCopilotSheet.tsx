import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import { useScheduleStore } from "@/store";
import type { SpeechRecognition, SpeechRecognitionEvent } from "@/types/speechRecognition";
import { 
  Bot, 
  Send, 
  X, 
  Sparkles,
  User,
  Plus,
  History,
  Trash2,
  Mic,
  Keyboard
} from "lucide-react";

interface MobileCopilotSheetProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function MobileCopilotSheet({ isOpen, onToggle }: MobileCopilotSheetProps) {
  const store = useScheduleStore();
  const [inputValue, setInputValue] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [dragY, setDragY] = useState(0);

  // Get current conversation
  const currentConversation = store.copilotConversations.find(
    c => c.id === store.currentConversationId
  );
  const messages = currentConversation?.messages || [];

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionConstructor) {
      recognitionRef.current = new SpeechRecognitionConstructor();
      recognitionRef.current.continuous = false;
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
          setInputValue(finalTranscript);
        }
      };
      
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 150 || info.velocity.y > 500) {
      onToggle();
    }
    setDragY(0);
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    // Send message logic here
    setInputValue("");
  };

  const toggleVoice = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInputValue("");
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggle}
            className="fixed inset-0 bg-black/50 z-40 sm:hidden"
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            initial={{ y: "100%" }}
            animate={{ y: dragY }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDrag={(_, info) => setDragY(Math.max(0, info.offset.y))}
            onDragEnd={handleDragEnd}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl sm:hidden max-h-[85vh] flex flex-col"
            style={{ y: dragY }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
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
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    showHistory ? "bg-blue-100 text-blue-600" : "text-slate-500"
                  )}
                >
                  <History className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => store.createConversation()}
                  className="p-2 text-slate-500"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button onClick={onToggle} className="p-2 text-slate-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* History Panel */}
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  className="border-b bg-slate-50 overflow-hidden"
                >
                  <div className="p-3 max-h-40 overflow-y-auto">
                    <div className="space-y-1">
                      {store.copilotConversations.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => {
                            store.loadConversation(conv.id);
                            setShowHistory(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between",
                            conv.id === store.currentConversationId
                              ? "bg-blue-100 text-blue-700"
                              : "bg-white text-slate-700"
                          )}
                        >
                          <span className="truncate">{conv.title}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              store.deleteConversation(conv.id);
                            }}
                            className="p-1 text-slate-400 hover:text-red-600"
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-blue-600" />
                    </div>
                  )}
                  
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                      message.role === "user"
                        ? "bg-blue-600 text-white rounded-br-md"
                        : "bg-slate-100 rounded-bl-md"
                    )}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {message.suggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => setInputValue(suggestion)}
                            className="text-xs px-2 py-1 rounded-full bg-white/20"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {message.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t bg-white safe-area-pb">
              <div className="flex gap-2">
                <button
                  onClick={toggleVoice}
                  className={cn(
                    "p-3 rounded-xl transition-colors",
                    isListening 
                      ? "bg-red-100 text-red-600 animate-pulse" 
                      : "bg-slate-100 text-slate-500"
                  )}
                >
                  <Mic className="h-5 w-5" />
                </button>
                
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={isListening ? "Listening..." : "Type a message..."}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                
                <button 
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className="p-3 bg-blue-600 text-white rounded-xl disabled:opacity-50"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
              
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-slate-400">
                  AI assistant • May require confirmation
                </span>
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Keyboard className="h-3 w-3" />
                  <span>Cmd+K to close</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
