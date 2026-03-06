/**
 * ShiftComments Component
 * 
 * Threaded commenting system for shift-level discussions.
 * Supports @mentions, replies, and notifications.
 * 
 * Part of Phase 4: Real-time Collaboration
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useScheduleStore, type ShiftSlot, type Provider } from '@/store';
import type { ShiftComment } from '@/types/calendar';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  Send,
  AtSign,
  MoreHorizontal,
  Trash2,
  Edit2,
  CornerDownRight,
  X,
  Check,
  Smile
} from 'lucide-react';

interface ShiftCommentsProps {
  slot: ShiftSlot;
  isOpen: boolean;
  onClose: () => void;
}

// Mock comments data
const MOCK_COMMENTS: ShiftComment[] = [
  {
    id: 'cmt-1',
    slotId: 'slot-1',
    authorId: 'user-1',
    authorName: 'Dr. Sarah Chen',
    content: 'I can take this shift if no one else is available. @drross are you able to swap?',
    mentions: ['provider-2'],
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'cmt-2',
    slotId: 'slot-1',
    authorId: 'user-2',
    authorName: 'Dr. Michael Ross',
    content: 'Yes, I can swap with you. I\'ll update the schedule.',
    mentions: [],
    parentId: 'cmt-1',
    createdAt: new Date(Date.now() - 1800000).toISOString()
  },
  {
    id: 'cmt-3',
    slotId: 'slot-1',
    authorId: 'user-3',
    authorName: 'Dr. Emily Wang',
    content: 'Thanks for handling this!',
    mentions: [],
    createdAt: new Date(Date.now() - 900000).toISOString()
  }
];

export function ShiftComments({ slot, isOpen, onClose }: ShiftCommentsProps) {
  const { providers, currentUser } = useScheduleStore();
  const [comments, setComments] = useState<ShiftComment[]>(MOCK_COMMENTS);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter comments for this slot
  const slotComments = useMemo(() => {
    return comments.filter(c => c.slotId === slot.id);
  }, [comments, slot.id]);

  // Group comments by parent (threaded)
  const threadedComments = useMemo(() => {
    const threads = new Map<string | null, ShiftComment[]>();
    
    slotComments.forEach(comment => {
      const parentId = comment.parentId || null;
      if (!threads.has(parentId)) {
        threads.set(parentId, []);
      }
      threads.get(parentId)?.push(comment);
    });
    
    return threads;
  }, [slotComments]);

  // Top-level comments
  const topLevelComments = threadedComments.get(null) || [];

  // Filter providers for mentions
  const mentionableProviders = useMemo(() => {
    if (!mentionSearch) return providers.slice(0, 5);
    return providers.filter(p => 
      p.name.toLowerCase().includes(mentionSearch.toLowerCase())
    ).slice(0, 5);
  }, [providers, mentionSearch]);

  // Handle mention detection
  const handleInputChange = (value: string) => {
    setNewComment(value);
    
    // Check for @ mention
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1 && lastAtIndex === value.length - 1) {
      setShowMentionPicker(true);
      setMentionSearch('');
    } else if (showMentionPicker) {
      const afterAt = value.slice(lastAtIndex + 1);
      if (afterAt.includes(' ')) {
        setShowMentionPicker(false);
      } else {
        setMentionSearch(afterAt);
      }
    }
  };

  // Insert mention
  const insertMention = (provider: Provider) => {
    const lastAtIndex = newComment.lastIndexOf('@');
    const beforeAt = newComment.slice(0, lastAtIndex);
    const newValue = `${beforeAt}@${provider.name} `;
    setNewComment(newValue);
    setShowMentionPicker(false);
    inputRef.current?.focus();
  };

  // Submit comment
  const submitComment = () => {
    if (!newComment.trim() || !currentUser) return;

    // Parse mentions
    const mentionedIds: string[] = [];
    providers.forEach(p => {
      if (newComment.includes(`@${p.name}`)) {
        mentionedIds.push(p.id);
      }
    });

    const comment: ShiftComment = {
      id: `cmt-${Date.now()}`,
      slotId: slot.id,
      authorId: currentUser.id,
      authorName: currentUser.name,
      content: newComment.trim(),
      mentions: mentionedIds,
      parentId: replyingTo || undefined,
      createdAt: new Date().toISOString()
    };

    setComments(prev => [...prev, comment]);
    setNewComment('');
    setReplyingTo(null);
  };

  // Edit comment
  const saveEdit = (commentId: string) => {
    setComments(prev => prev.map(c => 
      c.id === commentId ? { ...c, content: editContent, editedAt: new Date().toISOString() } : c
    ));
    setEditingComment(null);
    setEditContent('');
  };

  // Delete comment
  const deleteComment = (commentId: string) => {
    if (confirm('Delete this comment?')) {
      setComments(prev => prev.filter(c => c.id !== commentId));
    }
  };

  // Get initials
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [slotComments.length]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Comments
            </h3>
            <p className="text-sm text-slate-500">
              {format(parseISO(slot.date), 'MMM d')} • {slot.type} shift
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Comments List */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {topLevelComments.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500">No comments yet</p>
                <p className="text-sm text-slate-400">
                  Start a conversation about this shift
                </p>
              </div>
            ) : (
              topLevelComments.map(comment => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  replies={threadedComments.get(comment.id) || []}
                  currentUser={currentUser}
                  isEditing={editingComment === comment.id}
                  editContent={editContent}
                  onEditChange={setEditContent}
                  onSaveEdit={() => saveEdit(comment.id)}
                  onCancelEdit={() => setEditingComment(null)}
                  onStartEdit={() => {
                    setEditingComment(comment.id);
                    setEditContent(comment.content);
                  }}
                  onDelete={() => deleteComment(comment.id)}
                  onReply={() => setReplyingTo(comment.id)}
                  isReplying={replyingTo === comment.id}
                  getInitials={getInitials}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t space-y-3">
          {replyingTo && (
            <div className="flex items-center justify-between text-sm text-slate-500 bg-slate-50 p-2 rounded">
              <span>Replying to comment</span>
              <button onClick={() => setReplyingTo(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="relative">
            <textarea
              ref={inputRef}
              value={newComment}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Add a comment... Use @ to mention"
              className="w-full px-4 py-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  submitComment();
                }
              }}
            />

            {/* Mention Picker */}
            {showMentionPicker && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border rounded-lg shadow-lg z-10">
                <div className="p-2 border-b">
                  <p className="text-xs font-medium text-slate-500">Mention someone</p>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {mentionableProviders.map(provider => (
                    <button
                      key={provider.id}
                      onClick={() => insertMention(provider)}
                      className="w-full flex items-center gap-2 p-2 hover:bg-slate-50 text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
                        {getInitials(provider.name)}
                      </div>
                      <span className="text-sm">{provider.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Press Cmd+Enter to send
            </div>
            <Button 
              onClick={submitComment}
              disabled={!newComment.trim()}
              size="sm"
            >
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Comment Thread Component
function CommentThread({
  comment,
  replies,
  currentUser,
  isEditing,
  editContent,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onDelete,
  onReply,
  isReplying,
  getInitials
}: {
  comment: ShiftComment;
  replies: ShiftComment[];
  currentUser: Provider | null;
  isEditing: boolean;
  editContent: string;
  onEditChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
  onReply: () => void;
  isReplying: boolean;
  getInitials: (name: string) => string;
}) {
  const isOwnComment = currentUser?.id === comment.authorId;

  return (
    <div className={cn('space-y-3', replies.length > 0 && 'pb-3 border-b border-slate-100')}>
      {/* Main Comment */}
      <div className="flex gap-3">
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs">
            {getInitials(comment.authorName)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{comment.authorName}</span>
            <span className="text-xs text-slate-400">
              {formatDistanceToNow(parseISO(comment.createdAt), { addSuffix: true })}
            </span>
            {comment.editedAt && (
              <span className="text-xs text-slate-400">(edited)</span>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => onEditChange(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm resize-none"
                rows={3}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={onSaveEdit}>
                  <Check className="w-3 h-3 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={onCancelEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {comment.content}
              </p>

              <div className="flex items-center gap-3 mt-2">
                <button 
                  onClick={onReply}
                  className="text-xs text-slate-500 hover:text-primary flex items-center gap-1"
                >
                  <CornerDownRight className="w-3 h-3" />
                  Reply
                </button>

                {isOwnComment && (
                  <>
                    <button 
                      onClick={onStartEdit}
                      className="text-xs text-slate-500 hover:text-primary flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                    <button 
                      onClick={onDelete}
                      className="text-xs text-slate-500 hover:text-rose-500 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-11 space-y-3">
          {replies.map(reply => (
            <div key={reply.id} className="flex gap-3">
              <Avatar className="w-6 h-6 flex-shrink-0">
                <AvatarFallback className="bg-slate-200 text-slate-600 text-xs">
                  {getInitials(reply.authorName)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{reply.authorName}</span>
                  <span className="text-xs text-slate-400">
                    {formatDistanceToNow(parseISO(reply.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-slate-700">{reply.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Comment count badge
export function CommentCount({ slotId, count }: { slotId: string; count?: number }) {
  const displayCount = count || 0;
  
  if (displayCount === 0) return null;

  return (
    <Badge 
      variant="outline" 
      className="text-[10px] flex items-center gap-1 bg-violet-50 text-violet-600 border-violet-200"
    >
      <MessageSquare className="w-3 h-3" />
      {displayCount}
    </Badge>
  );
}
