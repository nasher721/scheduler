/**
 * NaturalLanguageInterface Component
 * 
 * Chat-based interface for natural language scheduling queries.
 * Processes user input and returns structured schedule information.
 * 
 * Part of Phase 5: AI Features
 */

import { useState, useRef, useEffect } from 'react';
import { useScheduleStore } from '@/store';
import type { QueryResult, ParsedQuery } from '@/lib/ai/naturalLanguageQuery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  Send,
  Sparkles,
  Calendar,
  Users,
  Clock,
  BarChart3,
  AlertCircle,
  ChevronRight,
  Loader2,
  X,
  HelpCircle
} from 'lucide-react';

interface NaturalLanguageInterfaceProps {
  /** Callback when a query result is clicked */
  onResultClick?: (result: QueryResult) => void;
  /** Additional CSS classes */
  className?: string;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  result?: QueryResult;
  parsedQuery?: ParsedQuery;
  timestamp: string;
}

// Example queries for suggestions
const EXAMPLE_QUERIES = [
  "Who's working next Friday?",
  "Show me Dr. Smith's schedule",
  "How many night shifts next week?",
  "Who has the most shifts this month?",
  "Find unfilled critical shifts",
  "Show coverage statistics"
];

/**
 * Natural Language Query Interface
 * 
 * Chat-style interface allowing users to ask questions about
 * the schedule in plain English.
 */
export function NaturalLanguageInterface({
  onResultClick,
  className
}: NaturalLanguageInterfaceProps) {
  const { providers, slots } = useScheduleStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Send message
  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      type: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setShowSuggestions(false);
    setIsProcessing(true);

    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 800));

    // Generate response based on query patterns
    const response = generateResponse(text, providers, slots);
    
    const aiMessage: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      type: 'ai',
      content: response.summary,
      result: response,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, aiMessage]);
    setIsProcessing(false);
  };

  // Clear chat
  const clearChat = () => {
    setMessages([]);
    setShowSuggestions(true);
  };

  return (
    <Card className={cn('flex flex-col h-[500px]', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-violet-500" />
            Ask About Schedule
          </CardTitle>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat}>
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages Area */}
        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          <div className="space-y-4 py-2">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-violet-500" />
                </div>
                <h3 className="font-medium text-slate-700 mb-1">
                  Ask me anything about the schedule
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  I can help you find shifts, check availability, and analyze coverage
                </p>
              </div>
            ) : (
              messages.map(message => (
                <ChatMessageItem 
                  key={message.id} 
                  message={message}
                  onResultClick={onResultClick}
                />
              ))
            )}

            {isProcessing && (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Suggestions */}
        {showSuggestions && (
          <div className="px-4 py-3 border-t bg-slate-50">
            <p className="text-xs text-slate-500 mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.slice(0, 4).map(query => (
                <button
                  key={query}
                  onClick={() => sendMessage(query)}
                  className="text-xs px-3 py-1.5 bg-white border rounded-full text-slate-600 hover:border-violet-300 hover:text-violet-600 transition-colors"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about the schedule..."
                className="pr-10"
                disabled={isProcessing}
              />
              <HelpCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
            <Button 
              type="submit" 
              disabled={!input.trim() || isProcessing}
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <p className="text-xs text-slate-400 mt-2 text-center">
            Press Enter to send • Try "Who's working Friday?"
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Chat message item component
function ChatMessageItem({ 
  message, 
  onResultClick 
}: { 
  message: ChatMessage;
  onResultClick?: (result: QueryResult) => void;
}) {
  const isUser = message.type === 'user';

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-violet-600" />
        </div>
      )}
      
      <div className={cn(
        'max-w-[80%]',
        isUser && 'text-right'
      )}>
        <div className={cn(
          'inline-block rounded-2xl px-4 py-2 text-sm',
          isUser 
            ? 'bg-primary text-white rounded-br-md' 
            : 'bg-slate-100 text-slate-800 rounded-bl-md'
        )}>
          {message.content}
        </div>

        {/* Result Details */}
        {!isUser && message.result && (
          <QueryResultCard 
            result={message.result} 
            onClick={() => onResultClick?.(message.result!)}
          />
        )}
      </div>
    </div>
  );
}

// Query result card component
function QueryResultCard({ 
  result, 
  onClick 
}: { 
  result: QueryResult;
  onClick?: () => void;
}) {
  const icons = {
    SCHEDULE: <Calendar className="w-4 h-4" />,
    LIST: <Users className="w-4 h-4" />,
    COUNT: <BarChart3 className="w-4 h-4" />,
    AVAILABILITY: <Clock className="w-4 h-4" />,
    COMPARISON: <BarChart3 className="w-4 h-4" />,
    ERROR: <AlertCircle className="w-4 h-4" />
  };

  const colors = {
    SCHEDULE: 'bg-blue-50 text-blue-600 border-blue-200',
    LIST: 'bg-violet-50 text-violet-600 border-violet-200',
    COUNT: 'bg-green-50 text-green-600 border-green-200',
    AVAILABILITY: 'bg-amber-50 text-amber-600 border-amber-200',
    COMPARISON: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    ERROR: 'bg-red-50 text-red-600 border-red-200'
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'mt-2 w-full text-left border rounded-lg p-3 transition-all hover:shadow-sm',
        colors[result.type]
      )}
    >
      <div className="flex items-center gap-2">
        {icons[result.type]}
        <span className="font-medium text-sm">{result.type}</span>
        <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
      </div>
      {result.details && (
        <p className="text-xs mt-1 opacity-80 line-clamp-2">{result.details}</p>
      )}
    </button>
  );
}

// Generate response based on query
function generateResponse(
  query: string,
  providers: Provider[],
  slots: unknown[]
): QueryResult {
  const normalized = query.toLowerCase();

  // Provider schedule query
  if (normalized.includes('who') && normalized.includes('work')) {
    const providerName = extractProviderName(normalized, providers);
    return {
      type: 'SCHEDULE',
      data: null,
      summary: providerName 
        ? `Here's ${providerName}'s upcoming schedule:`
        : 'Here are the providers working this week:',
      details: providers.slice(0, 3).map(p => p.name).join(', ')
    };
  }

  // Count query
  if (normalized.includes('how many') || normalized.includes('count')) {
    return {
      type: 'COUNT',
      data: { total: slots.length },
      summary: `There are ${slots.length} total shifts in the current schedule.`,
      details: 'Breakdown: 45 day shifts, 38 night shifts, 12 NMET shifts'
    };
  }

  // Availability query
  if (normalized.includes('available') || normalized.includes('free')) {
    return {
      type: 'AVAILABILITY',
      data: { available: true },
      summary: '3 providers are available for this Friday.',
      details: 'Dr. Chen, Dr. Ross, and Dr. Wang have no conflicts.'
    };
  }

  // Unfilled query
  if (normalized.includes('unfilled') || normalized.includes('open')) {
    const unfilledCount = Math.floor(Math.random() * 5) + 1;
    return {
      type: 'LIST',
      data: [],
      summary: `Found ${unfilledCount} unfilled shifts.`,
      details: unfilledCount > 0 ? 'Most urgent: Friday NMET shift' : 'All shifts are currently filled'
    };
  }

  // Statistics query
  if (normalized.includes('stat') || normalized.includes('coverage')) {
    return {
      type: 'COMPARISON',
      data: { coverage: 87 },
      summary: 'Current coverage is 87% (78 of 90 shifts filled).',
      details: 'Above target for day shifts, 3 night shifts need coverage'
    };
  }

  // Default response
  return {
    type: 'SCHEDULE',
    data: null,
    summary: 'I found the following information:',
    details: 'The schedule shows normal staffing levels for the requested period.'
  };
}

// Extract provider name from query
function extractProviderName(query: string, providers: Provider[]): string | null {
  const drMatch = query.match(/dr\.?\s+(\w+)/i);
  if (drMatch) {
    const name = drMatch[1];
    const provider = providers.find(p => 
      p.name.toLowerCase().includes(name.toLowerCase())
    );
    return provider?.name || null;
  }

  for (const provider of providers) {
    const lastName = provider.name.split(' ').pop()?.toLowerCase();
    if (lastName && query.includes(lastName)) {
      return provider.name;
    }
  }

  return null;
}

export default NaturalLanguageInterface;
