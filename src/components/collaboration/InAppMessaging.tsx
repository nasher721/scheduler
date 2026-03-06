import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, 
  Send, 
  X, 
  User, 
  Circle,
  ChevronDown,
  MoreHorizontal,
  Phone,
  Video
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useScheduleStore } from '@/store';
import { useToast } from '@/hooks/useToast';
import { useOfflineMode } from '@/lib/pwa/offlineMode';
import { formatDistanceToNow } from 'date-fns';

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  timestamp: string;
  read: boolean;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  url: string;
  size?: number;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
}

interface ChatMessageProps {
  message: Message;
  isOwn: boolean;
  senderName: string;
}

function ChatMessage({ message, isOwn, senderName }: ChatMessageProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {!isOwn && (
          <p className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {senderName}
          </p>
        )}
        <div
          className={`px-4 py-2 rounded-2xl ${
            isOwn
              ? 'bg-blue-600 text-white rounded-br-md'
              : isDark 
                ? 'bg-slate-700 text-slate-100 rounded-bl-md' 
                : 'bg-slate-200 text-slate-900 rounded-bl-md'
          }`}
        >
          <p className="text-sm">{message.content}</p>
        </div>
        <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
          {isOwn && (
            <span className="ml-2">
              {message.read ? '✓✓' : '✓'}
            </span>
          )}
        </p>
      </div>
    </motion.div>
  );
}

interface ConversationListProps {
  conversations: Conversation[];
  providers: any[];
  currentUserId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function ConversationList({ 
  conversations, 
  providers, 
  currentUserId,
  selectedId,
  onSelect 
}: ConversationListProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const getParticipantName = (conversation: Conversation) => {
    const otherId = conversation.participantIds.find(id => id !== currentUserId);
    const provider = providers.find(p => p.id === otherId);
    return provider?.name || 'Unknown';
  };

  const getParticipantStatus = (conversation: Conversation) => {
    // Would check online status from presence system
    return Math.random() > 0.5; // Placeholder
  };

  return (
    <div className={`h-full overflow-y-auto border-r ${
      isDark ? 'border-slate-700' : 'border-slate-200'
    }`}>
      <div className={`p-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
        <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Messages
        </h3>
      </div>

      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {conversations.length === 0 ? (
          <div className={`p-8 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No conversations yet</p>
          </div>
        ) : (
          conversations.map((conversation) => {
            const isSelected = selectedId === conversation.id;
            const isOnline = getParticipantStatus(conversation);

            return (
              <button
                key={conversation.id}
                onClick={() => onSelect(conversation.id)}
                className={`w-full flex items-center gap-3 p-4 transition-colors ${
                  isSelected
                    ? isDark ? 'bg-slate-700' : 'bg-blue-50'
                    : isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
                }`}
              >
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isDark ? 'bg-slate-600' : 'bg-slate-200'
                  }`}>
                    <User className={`w-5 h-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} />
                  </div>
                  {isOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-800" />
                  )}
                </div>

                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {getParticipantName(conversation)}
                    </p>
                    {conversation.unreadCount > 0 && (
                      <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </div>
                  {conversation.lastMessage && (
                    <p className={`text-sm truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {conversation.lastMessage.content}
                    </p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function InAppMessaging() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const toast = useToast();
  const { isOnline } = useOfflineMode();
  
  const providers = useScheduleStore((s) => s.providers);
  const currentUser = useScheduleStore((s) => s.currentUser);

  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load mock data on mount
  useEffect(() => {
    // In production, this would fetch from API
    const mockConversations: Conversation[] = providers
      .filter((p) => p.id !== currentUser?.id)
      .slice(0, 5)
      .map((provider, i) => ({
        id: `conv-${i}`,
        participantIds: [currentUser!.id, provider.id],
        unreadCount: i === 0 ? 2 : 0,
        updatedAt: new Date(Date.now() - i * 3600000).toISOString(),
        lastMessage: i === 0 ? {
          id: 'msg-1',
          senderId: provider.id,
          recipientId: currentUser!.id,
          content: 'Can we swap shifts next week?',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          read: false,
        } : undefined,
      }));

    setConversations(mockConversations);
  }, [providers, currentUser]);

  // Load messages when conversation selected
  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    // Mock messages
    const mockMessages: Message[] = [
      {
        id: '1',
        senderId: conversations.find((c) => c.id === selectedConversationId)?.participantIds.find((id) => id !== currentUser?.id) || '',
        recipientId: currentUser!.id,
        content: 'Hi! Can we talk about the schedule?',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        read: true,
      },
      {
        id: '2',
        senderId: currentUser!.id,
        recipientId: conversations.find((c) => c.id === selectedConversationId)?.participantIds.find((id) => id !== currentUser?.id) || '',
        content: 'Sure, what do you need?',
        timestamp: new Date(Date.now() - 3500000).toISOString(),
        read: true,
      },
      {
        id: '3',
        senderId: conversations.find((c) => c.id === selectedConversationId)?.participantIds.find((id) => id !== currentUser?.id) || '',
        recipientId: currentUser!.id,
        content: 'Can we swap shifts next week? I have a family event.',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        read: false,
      },
    ];

    setMessages(mockMessages);
  }, [selectedConversationId, conversations, currentUser]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!inputMessage.trim() || !selectedConversationId) return;

    if (!isOnline) {
      toast.error('Cannot send messages while offline');
      return;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: currentUser!.id,
      recipientId: conversations.find((c) => c.id === selectedConversationId)?.participantIds.find((id) => id !== currentUser?.id) || '',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString(),
      read: false,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputMessage('');
  }, [inputMessage, selectedConversationId, isOnline, currentUser, conversations, toast]);

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);
  const otherParticipant = selectedConversation?.participantIds.find((id) => id !== currentUser?.id);
  const otherProvider = providers.find((p) => p.id === otherParticipant);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 ${
          isDark 
            ? 'bg-slate-800 hover:bg-slate-700 text-white' 
            : 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-200'
        }`}
      >
        <div className="relative">
          <MessageCircle className="w-5 h-5" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {totalUnread}
            </span>
          )}
        </div>
        <span className="font-medium hidden sm:inline">Messages</span>
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
              className={`fixed inset-4 md:inset-auto md:bottom-24 md:left-6 md:w-[800px] md:h-[600px] rounded-2xl shadow-2xl z-50 overflow-hidden flex ${
                isDark ? 'bg-slate-900' : 'bg-white'
              }`}
            >
              {/* Conversations sidebar */}
              <div className="w-full md:w-72 flex-shrink-0">
                <ConversationList
                  conversations={conversations}
                  providers={providers}
                  currentUserId={currentUser?.id || ''}
                  selectedId={selectedConversationId}
                  onSelect={setSelectedConversationId}
                />
              </div>

              {/* Chat area */}
              <div className="flex-1 flex flex-col hidden md:flex">
                {selectedConversation ? (
                  <>
                    {/* Header */}
                    <div className={`flex items-center justify-between px-4 py-3 border-b ${
                      isDark ? 'border-slate-700' : 'border-slate-200'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isDark ? 'bg-slate-700' : 'bg-slate-200'
                          }`}>
                            <User className={`w-5 h-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} />
                          </div>
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-900" />
                        </div>
                        <div>
                          <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {otherProvider?.name}
                          </p>
                          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Online
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button className={`p-2 rounded-lg transition-colors ${
                          isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                        }`}>
                          <Phone className="w-5 h-5" />
                        </button>
                        <button className={`p-2 rounded-lg transition-colors ${
                          isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                        }`}>
                          <Video className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setIsOpen(false)}
                          className={`p-2 rounded-lg transition-colors ${
                            isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                          }`}
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Messages */}
                    <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${
                      isDark ? 'bg-slate-900' : 'bg-slate-50'
                    }`}>
                      {messages.map((message) => (
                        <ChatMessage
                          key={message.id}
                          message={message}
                          isOwn={message.senderId === currentUser?.id}
                          senderName={providers.find((p) => p.id === message.senderId)?.name || 'Unknown'}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className={`p-4 border-t ${
                      isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'
                    }`}>
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
                        isDark 
                          ? 'bg-slate-800 border-slate-700 focus-within:border-blue-500' 
                          : 'bg-slate-50 border-slate-200 focus-within:border-blue-500'
                      }`}>
                        <input
                          type="text"
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                          placeholder="Type a message..."
                          className={`flex-1 bg-transparent border-none outline-none text-sm ${
                            isDark ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
                          }`}
                        />
                        <button
                          onClick={handleSend}
                          disabled={!inputMessage.trim()}
                          className={`p-2 rounded-full transition-colors ${
                            inputMessage.trim()
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : isDark ? 'text-slate-600' : 'text-slate-300'
                          }`}
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={`flex-1 flex flex-col items-center justify-center ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    <MessageCircle className="w-16 h-16 mb-4 opacity-50" />
                    <p className="font-medium">Select a conversation</p>
                    <p className="text-sm mt-1">Choose someone from the list to start messaging</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default InAppMessaging;
