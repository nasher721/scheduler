/**
 * CommentsSystem Component
 * 
 * Integrated comment system for shifts with @mentions and threading.
 * Displays as a sidebar or panel within the calendar view.
 * 
 * Part of Phase 4: Real-time Collaboration
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useScheduleStore } from '@/store';
import type { ShiftComment, ShiftSlot, Provider } from '@/types/calendar';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  Send,
  AtSign,
  CornerDownRight,
  X,
  Check,
  MoreVertical,
  Trash2,
  Edit2
} from 'lucide-react';

export interface CommentsSystemProps {
  /** The shift slot being discussed */
  slot: ShiftSlot;
  /** Available providers for @mentions */
  providers: Provider[];
  /** Callback when comment is added */
  onAddComment?: (comment: Omit<ShiftComment, 'id' | 'createdAt'>) => void;
  /** Callback when comment is edited */
  onEditComment?: (id: string, content: string) => void;
  /** Callback when comment is deleted */
  onDeleteComment?: (id: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Threaded comments component with @mentions and real-time updates
 */
export function CommentsSystem({
  slot,
  providers,
  onAddComment,
  onEditComment,
  onDeleteComment,
  className
}: CommentsSystemProps) {
  const { currentUser, comments: existingComments = [] } = useScheduleStore();
  const [comments, setComments] = useState<ShiftComment[]>(existingComments.filter(c => c.slotId === slot.id));
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter comments for this slot
  const slotComments = useMemo(() => {
    return comments.filter(c => c.slotId === slot.id);
  }, [comments, slot.id]);

  // Group by thread
  const threads = useMemo(() => {
    const topLevel: ShiftComment[] = [];
    const replies = new Map<string, ShiftComment[]>();
    
    slotComments.forEach(comment => {
      if (comment.parentId) {
        if (!replies.has(comment.parentId)) {
          replies.set(comment.parentId, []);
        }
        replies.get(comment.parentId)?.push(comment);
      } else {
        topLevel.push(comment);
      }
    });
    
    return { topLevel, replies };
  }, [slotComments]);

  // Filter providers for mentions
  const filteredProviders = useMemo(() => {
    if (!mentionQuery) return providers.slice(0, 5);
    return providers.filter(p => 
      p.name.toLowerCase().includes(mentionQuery.toLowerCase())
    ).slice(0, 5);
  }, [providers, mentionQuery]);

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Handle input with mention detection
  const handleInput = (value: string, cursor: number) => {
    setNewComment(value);
    setCursorPosition(cursor);

    // Check for @ mention
    const beforeCursor = value.slice(0, cursor);
    const lastAtIndex = beforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const afterAt = beforeCursor.slice(lastAtIndex + 1);
      if (!afterAt.includes(' ')) {
        setShowMentions(true);
        setMentionQuery(afterAt);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  // Insert mention
  const insertMention = (provider: Provider) => {
    const beforeCursor = newComment.slice(0, cursorPosition);
    const afterCursor = newComment.slice(cursorPosition);
    const lastAtIndex = beforeCursor.lastIndexOf('@');
    
    const newBefore = beforeCursor.slice(0, lastAtIndex) + `@${provider.name} `;
    const newValue = newBefore + afterCursor;
    
    setNewComment(newValue);
    setShowMentions(false);
    
    // Restore cursor position
    setTimeout(() => {
      if (inputRef.current) {
        const newCursor = newBefore.length;
        inputRef.current.setSelectionRange(newCursor, newCursor);
        inputRef.current.focus();
      }
    }, 0);
  };

  // Submit comment
  const submitComment = () => {
    if (!newComment.trim() || !currentUser) return;

    // Parse mentions
    const mentions: string[] = [];
    providers.forEach(p => {
      if (newComment.includes(`@${p.name}`)) {
        mentions.push(p.id);
      }
    });

    const comment: ShiftComment = {
      id: `cmt-${Date.now()}`,
      slotId: slot.id,
      authorId: currentUser.id,
      authorName: currentUser.name,
      content: newComment.trim(),
      mentions,
      parentId: replyingTo || undefined,
      createdAt: new Date().toISOString()
    };

    setComments(prev => [...prev, comment]);
    onAddComment?.({
      slotId: slot.id,
      authorId: currentUser.id,
      authorName: currentUser.name,
      content: newComment.trim(),
      mentions,
      parentId: replyingTo || undefined
    });

    setNewComment('');
    setReplyingTo(null);
  };

  // Start editing
  const startEdit = (comment: ShiftComment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  // Save edit
  const saveEdit = () => {
    if (!editingId) return;
    
    setComments(prev => prev.map(c => 
      c.id === editingId 
        ? { ...c, content: editContent, editedAt: new Date().toISOString() }
        : c
    ));
    
    onEditComment?.(editingId, editContent);
    setEditingId(null);
    setEditContent('');
  };

  // Delete comment
  const deleteComment = (id: string) => {
    if (!confirm('Delete this comment?')) return;
    
    setComments(prev => prev.filter(c => c.id !== id));
    onDeleteComment?.(id);
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [slotComments.length]);

  return (
    <div className={cn('flex flex-col h-full bg-white border rounded-lg', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Comments</h3>
          <Badge variant="secondary" className="text-xs">
            {slotComments.length}
          </Badge>
        </div>
      </div>

      {/* Comments List */}
      <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
        <div className="space-y-4">
          {threads.topLevel.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No comments yet</p>
              <p className="text-xs text-slate-400">
                Start a conversation about this shift
              </p>
            </div>
          ) : (
            threads.topLevel.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                replies={threads.replies.get(comment.id) || []}
                currentUser={currentUser}
                providers={providers}
                isEditing={editingId === comment.id}
                editContent={editContent}
                onEditChange={setEditContent}
                onSaveEdit={saveEdit}
                onCancelEdit={() => setEditingId(null)}
                onStartEdit={() => startEdit(comment)}
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
      <div className="px-4 py-3 border-t space-y-2">
        {replyingTo && (
          <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-2 rounded">
            <span className="flex items-center gap-1">
              <CornerDownRight className="w-3 h-3" />
              Replying to comment
            </span>
            <button onClick={() => setReplyingTo(null)}>
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="relative">
          <textarea
            ref={inputRef}
            value={newComment}
            onChange={(e) => handleInput(e.target.value, e.target.selectionStart)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submitComment();
              }
            }}
            placeholder="Add a comment... Use @ to mention"
            className="w-full px-3 py-2 pr-10 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary min-h-[72px]"
            rows={3}
          />

          {/* Mention Suggestions */}
          {showMentions && (
            <div className="absolute bottom-full left-0 mb-2 w-56 bg-white border rounded-lg shadow-lg z-20">
              <div className="px-3 py-2 border-b bg-slate-50">
                <p className="text-xs font-medium text-slate-500">Mention someone</p>
              </div>
              <div className="max-h-40 overflow-y-auto py-1">
                {filteredProviders.map(provider => (
                  <button
                    key={provider.id}
                    onClick={() => insertMention(provider)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left"
                  >
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs">
                        {getInitials(provider.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{provider.name}</span>
                  </button>
                ))}
                {filteredProviders.length === 0 && (
                  <p className="px-3 py-2 text-sm text-slate-400">No matches</p>
                )}
              </div>
            </div>
          )}

          <AtSign className="absolute bottom-3 right-3 w-4 h-4 text-slate-400" />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Cmd+Enter to send
          </span>
          <Button 
            onClick={submitComment}
            disabled={!newComment.trim()}
            size="sm"
          >
            <Send className="w-4 h-4 mr-1" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

// Individual Comment Component
interface CommentItemProps {
  comment: ShiftComment;
  replies: ShiftComment[];
  currentUser: Provider | null;
  providers: Provider[];
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
  isReply?: boolean;
}

function CommentItem({
  comment,
  replies,
  currentUser,
  providers,
  isEditing,
  editContent,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onDelete,
  onReply,
  isReplying,
  getInitials,
  isReply = false
}: CommentItemProps) {
  const isOwn = currentUser?.id === comment.authorId;

  // Parse content to highlight mentions
  const renderContent = (content: string) => {
    const parts = content.split(/(@\w+\s\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="text-primary font-medium bg-primary/10 px-1 rounded">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className={cn('space-y-2', isReply && 'ml-6 pl-3 border-l-2 border-slate-100')}>
      <div className="flex gap-2">
        <Avatar className={cn('flex-shrink-0', isReply ? 'w-6 h-6' : 'w-8 h-8')}>
          <AvatarFallback className={cn(
            'text-white font-medium',
            isReply ? 'text-[10px] bg-slate-400' : 'text-xs bg-gradient-to-br from-blue-500 to-indigo-600'
          )}>
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
                className="w-full px-2 py-1 text-sm border rounded resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                rows={2}
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 px-2" onClick={onSaveEdit}>
                  <Check className="w-3 h-3 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onCancelEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-700 leading-relaxed">
                {renderContent(comment.content)}
              </p>

              <div className="flex items-center gap-3 mt-1">
                {!isReply && (
                  <button 
                    onClick={onReply}
                    className="text-xs text-slate-500 hover:text-primary flex items-center gap-1 transition-colors"
                  >
                    <CornerDownRight className="w-3 h-3" />
                    Reply
                  </button>
                )}

                {isOwn && (
                  <>
                    <button 
                      onClick={onStartEdit}
                      className="text-xs text-slate-500 hover:text-primary flex items-center gap-1 transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                    <button 
                      onClick={onDelete}
                      className="text-xs text-slate-500 hover:text-rose-500 flex items-center gap-1 transition-colors"
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
        <div className="space-y-2">
          {replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              replies={[]}
              currentUser={currentUser}
              providers={providers}
              isEditing={false}
              editContent=""
              onEditChange={() => {}}
              onSaveEdit={() => {}}
              onCancelEdit={() => {}}
              onStartEdit={() => {}}
              onDelete={() => {}}
              onReply={() => {}}
              isReplying={false}
              getInitials={getInitials}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CommentsSystem;
