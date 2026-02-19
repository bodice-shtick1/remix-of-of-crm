import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useInternalChat, type ChatRoom, type TeamMember, type ChatMessage } from '@/hooks/useInternalChat';
import { useReactions } from '@/hooks/useReactions';
import { useChatSearch } from '@/hooks/useChatSearch';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Search, Send, Users, Plus, MessageSquare, Check, CheckCheck,
  Pencil, Trash2, X, Reply, Copy, Paperclip, ChevronUp, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ChatFileAttachment } from './ChatFileAttachment';
import { ChatMentionInput, renderMentionText } from './ChatMentionInput';



// Typing dots animation component
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="h-1 w-1 rounded-full bg-current animate-[bounce_1s_ease-in-out_0s_infinite]" />
      <span className="h-1 w-1 rounded-full bg-current animate-[bounce_1s_ease-in-out_0.15s_infinite]" />
      <span className="h-1 w-1 rounded-full bg-current animate-[bounce_1s_ease-in-out_0.3s_infinite]" />
    </span>
  );
}

// Read receipt icon: single check = delivered, double check = read
function ReadReceipt({ isRead, isMyMessage }: { isRead: boolean; isMyMessage: boolean }) {
  if (!isMyMessage) return null;
  const Icon = isRead ? CheckCheck : Check;
  return (
    <Icon className={cn(
      'inline-block h-3.5 w-3.5 ml-0.5 shrink-0 transition-colors',
      isRead ? 'text-primary-foreground' : 'text-primary-foreground/50'
    )} />
  );
}

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Вчера';
  return format(d, 'dd.MM', { locale: ru });
}

function UserAvatar({ name, avatarUrl, online, size = 'md' }: { name: string; avatarUrl?: string | null; online?: boolean; size?: 'sm' | 'md' }) {
  const initials = name?.slice(0, 2).toUpperCase() || '??';
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <div className="relative shrink-0">
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className={cn(sizeClass, 'rounded-full object-cover')} />
      ) : (
        <div className={cn('avatar-initials rounded-full', sizeClass)}>{initials}</div>
      )}
      {online !== undefined && (
        <span className={cn(
          'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card',
          online ? 'bg-success' : 'bg-muted-foreground/30'
        )} />
      )}
    </div>
  );
}

// ─── Quick emoji picker for reactions ───
const QUICK_EMOJIS = ['👍', '❤️', '🔥', '😂', '✅', '🚀'];

// ─── Context menu content for message actions ───
function MessageContextMenuItems({
  msg, isMe, onReply, onEdit, onDelete, onReact,
}: {
  msg: ChatMessage; isMe: boolean;
  onReply: () => void; onEdit: () => void; onDelete: () => void;
  onReact: (emoji: string) => void;
}) {
  const handleCopy = () => {
    navigator.clipboard.writeText(msg.text).then(() => toast.success('Скопировано'));
  };

  return (
    <ContextMenuContent className="min-w-[180px] z-50 bg-popover chat-context-menu">
      {/* Emoji quick-pick row */}
      <div className="flex items-center gap-1 px-2 py-1.5 chat-reaction-picker-row">
        {QUICK_EMOJIS.map(e => (
          <button
            key={e}
            onClick={() => onReact(e)}
            className="text-base leading-none hover:scale-125 transition-transform rounded p-0.5 hover:bg-muted"
            title={e}
          >
            {e}
          </button>
        ))}
      </div>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={onReply}>
        <Reply className="h-4 w-4 mr-2" /> Ответить
      </ContextMenuItem>
      <ContextMenuItem onClick={handleCopy}>
        <Copy className="h-4 w-4 mr-2" /> Копировать текст
      </ContextMenuItem>
      {isMe && (
        <>
          <ContextMenuItem onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-2" /> Изменить
          </ContextMenuItem>
          <ContextMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" /> Удалить
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  );
}

// ─── Reaction bubbles row ───
function ReactionBubbles({
  reactions, onToggle,
}: {
  reactions: { emoji: string; count: number; hasMe: boolean }[];
  onToggle: (emoji: string) => void;
}) {
  if (!reactions?.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1 chat-reaction-bubbles">
      {reactions.map(r => (
        <button
          key={r.emoji}
          onClick={() => onToggle(r.emoji)}
          className={cn(
            'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] leading-none border transition-all',
            r.hasMe
              ? 'active-reaction bg-primary/15 border-primary/40 text-primary font-medium'
              : 'bg-muted border-border/50 text-foreground/70 hover:border-primary/30 hover:bg-primary/5'
          )}
          title={r.hasMe ? 'Убрать реакцию' : 'Поставить реакцию'}
        >
          <span>{r.emoji}</span>
          <span className="min-w-[10px]">{r.count}</span>
        </button>
      ))}
    </div>
  );
}

interface InternalChatProps {
  compact?: boolean;
  externalSearch?: string;
  onRequestNewGroup?: () => void;
}

export function InternalChat({ compact = false, externalSearch, onRequestNewGroup }: InternalChatProps = {}) {
  const { user } = useAuth();
  const {
    rooms, roomsLoading, messages, messagesLoading,
    teamMembers, selectedRoomId, setSelectedRoomId,
    sendMessage, isSending, markRoomRead,
    findOrCreateDM, createGroupChat,
    typingUsers, sendTyping, totalUnread,
    isUserOnline, isMessageRead,
    editMessage, deleteMessage,
  } = useInternalChat();

  const { reactionsMap, toggleReaction } = useReactions(selectedRoomId);
  const isMobile = useIsMobile();
  const [internalSearch, setInternalSearch] = useState('');
  const search = compact ? (externalSearch ?? '') : internalSearch;
  const setSearch = compact ? (() => {}) : setInternalSearch;
  const [inputValue, setInputValue] = useState('');
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // ── Chat search ──
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const chatSearch = useChatSearch(selectedRoomId, teamMembers);
  const chatSearchInputRef = useRef<HTMLInputElement>(null);

  // Open search bar
  const openChatSearch = useCallback(() => {
    setChatSearchOpen(true);
    setTimeout(() => chatSearchInputRef.current?.focus(), 50);
  }, []);

  // Close + clear
  const closeChatSearch = useCallback(() => {
    setChatSearchOpen(false);
    chatSearch.clear();
  }, [chatSearch]);

  // Highlight a message (called when navigating results)
  const highlightMessage = useCallback((msgId: string, keepSearchOpen = true) => {
    const el = messageRefs.current.get(msgId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('chat-search-highlight');
      void el.offsetWidth; // reflow to restart animation
      el.classList.add('chat-search-highlight');
      setTimeout(() => el.classList.remove('chat-search-highlight'), 3300);
    }
  }, []);

  // Navigate and scroll when currentMessageId changes
  useEffect(() => {
    if (chatSearch.currentMessageId && chatSearchOpen) {
      highlightMessage(chatSearch.currentMessageId);
    }
  }, [chatSearch.currentMessageId, chatSearch.currentIndex, chatSearchOpen, highlightMessage]);



  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<{ file: File; previewUrl?: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  const handleFileSelected = useCallback((file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Файл слишком большой. Максимум 10 МБ');
      return;
    }
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    setPendingFile({ file, previewUrl });
  }, []);

  const clearPendingFile = () => {
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag-and-drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  };

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Auto-scroll when virtual keyboard opens (mobile)
  useEffect(() => {
    if (!isMobile || typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, [isMobile]);

  // Mark as read on room select
  useEffect(() => {
    if (selectedRoomId) markRoomRead(selectedRoomId);
  }, [selectedRoomId, markRoomRead]);


  const handleSend = useCallback(async () => {
    if ((!inputValue.trim() && !pendingFile) || !selectedRoomId) return;
    if (editingMessage) {
      editMessage({ messageId: editingMessage.id, newText: inputValue.trim() });
      setEditingMessage(null);
      setInputValue('');
      return;
    }

    // Upload file if pending
    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let fileType: string | null = null;
    let fileSize: number | null = null;

    if (pendingFile) {
      setIsUploading(true);
      setUploadProgress(10);
      try {
        const ext = pendingFile.file.name.split('.').pop() || 'bin';
        const filePath = `${user?.id}/${Date.now()}.${ext}`;
        setUploadProgress(30);
        const { error: upErr } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, pendingFile.file, { contentType: pendingFile.file.type, upsert: false });
        if (upErr) throw upErr;
        setUploadProgress(80);
        const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
        fileName = pendingFile.file.name;
        fileType = pendingFile.file.type;
        fileSize = pendingFile.file.size;
        setUploadProgress(100);
      } catch (err) {
        console.error('Upload error:', err);
        toast.error('Ошибка загрузки файла');
        setIsUploading(false);
        setUploadProgress(0);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    const text = inputValue.trim() || (fileName ? '' : '');
    sendMessage({
      roomId: selectedRoomId,
      text: text || (fileName ? `📎 ${fileName}` : ''),
      replyToId: replyingTo?.id || null,
      fileUrl,
      fileName,
      fileType,
      fileSize,
      mentionedUserIds: mentionedIds.length ? mentionedIds : null,
    });
    setReplyingTo(null);
    setInputValue('');
    setMentionedIds([]);
    clearPendingFile();
  }, [inputValue, selectedRoomId, sendMessage, editingMessage, editMessage, replyingTo, pendingFile, user, mentionedIds]);

  const handleStartEdit = (msg: ChatMessage) => {
    setEditingMessage(msg);
    setReplyingTo(null);
    setInputValue(msg.text);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setInputValue('');
  };

  const handleStartReply = (msg: ChatMessage) => {
    setReplyingTo(msg);
    setEditingMessage(null);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const handleDelete = async (msgId: string) => {
    try {
      await deleteMessage(msgId);
    } catch {
      toast.error('Не удалось удалить сообщение');
    }
  };

  const scrollToMessage = (msgId: string) => {
    const el = messageRefs.current.get(msgId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('chat-highlight-msg');
      setTimeout(() => el.classList.remove('chat-highlight-msg'), 1500);
    }
  };

  

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (val: string, ids?: string[]) => {
    setInputValue(val);
    if (ids !== undefined) setMentionedIds(ids);
    sendTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => sendTyping(false), 2000);
  };

  const handleDMClick = async (member: TeamMember) => {
    try {
      const roomId = await findOrCreateDM(member.user_id);
      setSelectedRoomId(roomId);
    } catch (err: any) {
      console.error('DM creation error:', err);
      toast.error(err?.message || 'Не удалось открыть чат');
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    try {
      const roomId = await createGroupChat(groupName.trim(), selectedMembers);
      setSelectedRoomId(roomId);
      setShowNewGroup(false);
      setGroupName('');
      setSelectedMembers([]);
      toast.success('Группа создана');
    } catch (err: any) {
      console.error('Group creation error:', err);
      toast.error(err?.message || 'Не удалось создать группу');
    }
  };

  // Get display name for a room
  const getRoomName = useCallback((room: ChatRoom): string => {
    if (room.is_group) return room.name || 'Группа';
    const otherParticipant = room.participants.find(p => p.user_id !== user?.id);
    if (!otherParticipant) return 'Чат';
    const member = teamMembers.find(m => m.user_id === otherParticipant.user_id);
    return member?.full_name || member?.email || 'Пользователь';
  }, [user, teamMembers]);

  const getOtherMember = useCallback((room: ChatRoom): TeamMember | undefined => {
    if (room.is_group) return undefined;
    const other = room.participants.find(p => p.user_id !== user?.id);
    return teamMembers.find(m => m.user_id === other?.user_id);
  }, [user, teamMembers]);

  const getSenderName = useCallback((senderId: string): string => {
    if (senderId === user?.id) return 'Вы';
    const m = teamMembers.find(t => t.user_id === senderId);
    return m?.full_name || m?.email?.split('@')[0] || 'Кто-то';
  }, [user, teamMembers]);

  const getReplyPreview = useCallback((replyToId: string) => {
    const msg = messages.find(m => m.id === replyToId);
    if (!msg) return null;
    return {
      text: (msg as any).is_deleted ? 'Сообщение удалено' : msg.text,
      senderName: getSenderName(msg.sender_id),
    };
  }, [messages, getSenderName]);

  const filteredMembers = useMemo(() => {
    if (!search) return teamMembers;
    const s = search.toLowerCase();
    return teamMembers.filter(m =>
      m.full_name?.toLowerCase().includes(s) || m.email?.toLowerCase().includes(s)
    );
  }, [teamMembers, search]);

  const filteredRooms = useMemo(() => {
    if (!search) return rooms;
    const s = search.toLowerCase();
    return rooms.filter(r => getRoomName(r).toLowerCase().includes(s));
  }, [rooms, search, getRoomName]);

  // Selected room info
  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const selectedRoomName = selectedRoom ? getRoomName(selectedRoom) : '';
  const selectedOther = selectedRoom ? getOtherMember(selectedRoom) : undefined;

  const typingLabel = useMemo(() => {
    if (!typingUsers.size) return null;
    const names = Array.from(typingUsers.values());
    return names.length === 1 ? `${names[0]}` : `${names.length} чел.`;
  }, [typingUsers]);

  // ─── Compact mode: single-column, no sidebar, no headers ───
  if (compact) {
    // If a room is selected, show full-width chat
    if (selectedRoom) {
      return (
        <div
          className="flex flex-col h-full bg-card relative"
          onDragOver={selectedRoomId ? handleDragOver : undefined}
          onDragLeave={selectedRoomId ? handleDragLeave : undefined}
          onDrop={selectedRoomId ? handleDrop : undefined}
        >
          {/* Drag-over overlay */}
          {isDragOver && (
            <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary flex items-center justify-center rounded-lg pointer-events-none">
              <div className="text-center">
                <Paperclip className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium text-primary">Сбросьте файл для отправки</p>
              </div>
            </div>
          )}
          {/* Slim back + name bar */}
          <button
            onClick={() => setSelectedRoomId(null as any)}
            className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 border-b border-border/30"
          >
            <span>←</span>
            <span className="font-medium text-foreground truncate">{selectedRoomName}</span>
            {typingLabel && <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">{typingLabel} <TypingDots /></span>}
          </button>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
            {messagesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-3/4" />)}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">Начните общение</p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMe = msg.sender_id === user?.id;
                const isDeleted = !!(msg as any).is_deleted;
                const isEdited = !!(msg as any).updated_at && (msg as any).updated_at !== msg.created_at && !isDeleted;
                const senderName = getSenderName(msg.sender_id);
                const senderMember = teamMembers.find(m => m.user_id === msg.sender_id);
                const showAvatar = !isMe && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id);
                const replyPreview = (msg as any).reply_to_id ? getReplyPreview((msg as any).reply_to_id) : null;
                return (
                  <div
                    key={msg.id}
                    ref={(el) => { if (el) messageRefs.current.set(msg.id, el); }}
                    className={cn('flex gap-2 group/msg relative chat-msg-row', isMe ? 'flex-row-reverse' : 'flex-row')}
                  >
                    {!isMe && (
                      <div className="w-7">
                        {showAvatar && <UserAvatar name={senderMember?.full_name || ''} avatarUrl={senderMember?.avatar_url} size="sm" />}
                      </div>
                    )}
                    <div className={cn('relative', isMobile ? 'max-w-[80%]' : 'max-w-[70%]')}>
                      {showAvatar && !isMe && selectedRoom.is_group && (
                        <p className="text-[10px] font-medium text-primary mb-0.5 pl-1">{senderName}</p>
                      )}
                      <ContextMenu>
                        <ContextMenuTrigger disabled={isDeleted} asChild>
                          <div
                            className={cn(
                              'px-3 py-1.5 rounded-2xl text-[13px] leading-relaxed cursor-default select-text chat-bubble-interactive',
                              isDeleted ? 'bg-muted/50 text-muted-foreground italic' :
                              isMe ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted text-foreground rounded-bl-md'
                            )}
                            onClick={(e) => {
                              if (isMobile && !isDeleted) {
                                e.preventDefault();
                                const trigger = e.currentTarget;
                                trigger.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: e.clientX, clientY: e.clientY }));
                              }
                            }}
                          >
                            {replyPreview && !isDeleted && (
                              <button
                                onClick={(e) => { e.stopPropagation(); scrollToMessage((msg as any).reply_to_id); }}
                                className={cn(
                                  'w-full text-left mb-1.5 pl-2 py-1 rounded-md text-[11px] leading-tight border-l-2 cursor-pointer chat-reply-quote',
                                  isMe
                                    ? 'border-primary-foreground/40 bg-primary-foreground/10 text-primary-foreground/80 hover:bg-primary-foreground/15'
                                    : 'border-primary bg-primary/5 text-foreground/70 hover:bg-primary/10'
                                )}
                              >
                                <span className="font-medium block text-[10px]">{replyPreview.senderName}</span>
                                <span className="line-clamp-1">{replyPreview.text}</span>
                              </button>
                            )}
                            {isDeleted ? 'Сообщение удалено' : (
                              <>
                                {msg.text && !msg.text.startsWith('📎') && <span>{renderMentionText(msg.text, teamMembers, isMe)}</span>}
                                {msg.file_url && (
                                  <ChatFileAttachment
                                    fileUrl={msg.file_url}
                                    fileName={msg.file_name}
                                    fileType={msg.file_type}
                                    fileSize={msg.file_size}
                                    isMe={isMe}
                                  />
                                )}
                              </>
                            )}
                            <span className={cn('flex items-center justify-end gap-0.5 text-[9px] mt-0.5', isMe && !isDeleted ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                              {isEdited && <span className="mr-0.5">ред.</span>}
                              {format(new Date(msg.created_at), 'HH:mm')}
                              {!isDeleted && <ReadReceipt isRead={isMessageRead(msg.created_at)} isMyMessage={isMe} />}
                            </span>
                          </div>
                        </ContextMenuTrigger>
                        {!isDeleted && (
                          <MessageContextMenuItems msg={msg} isMe={isMe}
                            onReply={() => handleStartReply(msg)}
                            onEdit={() => handleStartEdit(msg)}
                            onDelete={() => handleDelete(msg.id)}
                            onReact={(emoji) => toggleReaction(msg.id, emoji)}
                          />
                        )}
                      </ContextMenu>
                      <ReactionBubbles
                        reactions={reactionsMap[msg.id] || []}
                        onToggle={(emoji) => toggleReaction(msg.id, emoji)}
                      />
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Edit banner */}
          {editingMessage && (
            <div className="border-t border-border/30 px-2 pt-1.5 pb-0.5 flex items-center gap-2 bg-muted/30 w-full">
              <Pencil className="h-3 w-3 text-primary shrink-0" />
              <span className="text-[11px] text-muted-foreground truncate flex-1">Редактирование</span>
              <button onClick={handleCancelEdit} className="text-muted-foreground hover:text-foreground p-1">
                <X className={cn(isMobile ? 'h-5 w-5' : 'h-3.5 w-3.5')} />
              </button>
            </div>
          )}

          {/* Reply banner */}
          {replyingTo && !editingMessage && (
            <div className="border-t border-border/30 px-2 pt-1.5 pb-0.5 flex items-center gap-2 bg-muted/30 w-full chat-reply-banner">
              <Reply className="h-3 w-3 text-primary shrink-0" />
              <div className="flex-1 min-w-0 border-l-2 border-primary pl-1.5">
                <span className="text-[10px] font-medium text-primary block">{getSenderName(replyingTo.sender_id)}</span>
                <span className="text-[11px] text-muted-foreground truncate block">{replyingTo.text}</span>
              </div>
              <button onClick={handleCancelReply} className="text-muted-foreground hover:text-foreground shrink-0 p-1">
                <X className={cn(isMobile ? 'h-5 w-5' : 'h-3.5 w-3.5')} />
              </button>
            </div>
          )}

          {/* Upload progress */}
          {isUploading && (
            <div className="border-t border-border/30 px-2 pt-1.5 pb-0.5 space-y-1">
              <p className="text-[10px] text-muted-foreground">Загрузка файла...</p>
              <Progress value={uploadProgress} className="h-1" />
            </div>
          )}

          {/* Pending file preview */}
          {pendingFile && !isUploading && (
            <div className="border-t border-border/30 px-2 pt-1.5 pb-0.5 flex items-center gap-2 bg-muted/20">
              {pendingFile.previewUrl ? (
                <img src={pendingFile.previewUrl} alt="" className="h-10 w-10 object-cover rounded shrink-0" />
              ) : (
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium truncate">{pendingFile.file.name}</p>
                <p className="text-[10px] text-muted-foreground">{(pendingFile.file.size / 1024).toFixed(0)} КБ</p>
              </div>
              <button onClick={clearPendingFile} className="text-muted-foreground hover:text-foreground p-1">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border/30 p-2 flex items-center gap-1.5 shrink-0">
            <input ref={fileInputRef} type="file" className="hidden" accept="*/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); }} />
            <button
              className="h-8 w-8 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="Прикрепить файл"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <ChatMentionInput
              value={inputValue}
              onChange={(val, ids) => handleInputChange(val, ids)}
              onSend={handleSend}
              placeholder={editingMessage ? "Редактирование..." : replyingTo ? "Ответ..." : "Сообщение..."}
              disabled={isUploading}
              teamMembers={teamMembers}
              compact
            />
            <Button size="icon" className="h-8 w-8" onClick={handleSend} disabled={(!inputValue.trim() && !pendingFile) || isSending || isUploading}>
              {editingMessage ? <Check className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {/* New Group Dialog (compact) */}
          <Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Новая группа</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs">Название группы</Label>
                  <Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Например: Общий чат" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs mb-2 block">Участники</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {teamMembers.map(m => (
                      <label key={m.user_id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors">
                        <Checkbox checked={selectedMembers.includes(m.user_id)} onCheckedChange={(checked) => setSelectedMembers(prev => checked ? [...prev, m.user_id] : prev.filter(id => id !== m.user_id))} />
                        <UserAvatar name={m.full_name || ''} avatarUrl={m.avatar_url} size="sm" />
                        <span className="text-sm">{m.full_name || m.email}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewGroup(false)}>Отмена</Button>
                <Button onClick={handleCreateGroup} disabled={!groupName.trim() || selectedMembers.length === 0}>Создать</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    // No room selected — show rooms + colleagues list, full width
    return (
      <div className="flex flex-col h-full bg-card">
        <ScrollArea className="flex-1">
          {filteredRooms.length > 0 && (
            <div className="p-2">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Чаты</p>
              {filteredRooms.map(room => {
                const name = getRoomName(room);
                const other = getOtherMember(room);
                return (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-muted/60 transition-all duration-200"
                  >
                    {room.is_group ? (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    ) : (
                      <UserAvatar name={other?.full_name || name} avatarUrl={other?.avatar_url} online={other ? isUserOnline(other.user_id) : false} size="sm" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground truncate">{name}</span>
                        {room.lastMessage && (
                          <span className="text-[10px] text-muted-foreground shrink-0 ml-1">{formatMsgTime(room.lastMessage.created_at)}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-muted-foreground truncate">{room.lastMessage?.text || 'Нет сообщений'}</p>
                        {room.unreadCount > 0 && (
                          <Badge variant="destructive" className="h-4 min-w-[16px] px-1 text-[9px] shrink-0 ml-1">{room.unreadCount}</Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <div className="p-2">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Коллеги</p>
            {filteredMembers.map(member => (
              <button
                key={member.user_id}
                onClick={() => handleDMClick(member)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted/60 transition-all duration-200"
              >
                <UserAvatar name={member.full_name || member.email || ''} avatarUrl={member.avatar_url} online={isUserOnline(member.user_id)} size="sm" />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-medium text-foreground truncate">{member.full_name || member.email}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {member.custom_role_name === 'admin' ? 'Администратор' : member.custom_role_name || 'Оператор'}
                    {isUserOnline(member.user_id) ? ' • в сети' : ''}
                  </p>
                </div>
              </button>
            ))}
            {filteredMembers.length === 0 && !roomsLoading && (
              <p className="px-2 py-4 text-xs text-muted-foreground text-center">Нет коллег</p>
            )}
          </div>
        </ScrollArea>

        <Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Новая группа</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Название группы</Label>
                <Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Например: Общий чат" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs mb-2 block">Участники</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {teamMembers.map(m => (
                    <label key={m.user_id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors">
                      <Checkbox checked={selectedMembers.includes(m.user_id)} onCheckedChange={(checked) => setSelectedMembers(prev => checked ? [...prev, m.user_id] : prev.filter(id => id !== m.user_id))} />
                      <UserAvatar name={m.full_name || ''} avatarUrl={m.avatar_url} size="sm" />
                      <span className="text-sm">{m.full_name || m.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewGroup(false)}>Отмена</Button>
              <Button onClick={handleCreateGroup} disabled={!groupName.trim() || selectedMembers.length === 0}>Создать</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── Full (non-compact) mode ───
  return (
    <div
      className="flex h-[calc(100vh-180px)] rounded-xl border border-border overflow-hidden bg-card relative"
      onDragOver={selectedRoomId ? handleDragOver : undefined}
      onDragLeave={selectedRoomId ? handleDragLeave : undefined}
      onDrop={selectedRoomId ? handleDrop : undefined}
    >
      {/* Drag-over overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary flex items-center justify-center rounded-xl pointer-events-none">
          <div className="text-center">
            <Paperclip className="h-10 w-10 text-primary mx-auto mb-2" />
            <p className="text-base font-medium text-primary">Сбросьте файл для отправки</p>
          </div>
        </div>
      )}
      {/* Left panel — contacts & rooms */}
      <div className="w-72 border-r border-border flex flex-col bg-card">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Внутренний чат</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowNewGroup(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-8 text-xs" />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {filteredRooms.length > 0 && (
            <div className="p-2">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Чаты</p>
              {filteredRooms.map(room => {
                const name = getRoomName(room);
                const other = getOtherMember(room);
                const isActive = room.id === selectedRoomId;
                return (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-200',
                      isActive ? 'bg-primary/10' : 'hover:bg-muted/60'
                    )}
                  >
                    {room.is_group ? (
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ) : (
                      <UserAvatar name={other?.full_name || name} avatarUrl={other?.avatar_url} online={other ? isUserOnline(other.user_id) : false} size="sm" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium text-foreground truncate">{name}</span>
                        {room.lastMessage && (
                          <span className="text-[10px] text-muted-foreground shrink-0 ml-1">{formatMsgTime(room.lastMessage.created_at)}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-muted-foreground truncate">{room.lastMessage?.text || 'Нет сообщений'}</p>
                        {room.unreadCount > 0 && (
                          <Badge variant="destructive" className="h-4 min-w-[16px] px-1 text-[9px] shrink-0 ml-1">{room.unreadCount}</Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <div className="p-2">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Коллеги</p>
            {filteredMembers.map(member => (
              <button
                key={member.user_id}
                onClick={() => handleDMClick(member)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted/60 transition-all duration-200"
              >
                <UserAvatar name={member.full_name || member.email || ''} avatarUrl={member.avatar_url} online={isUserOnline(member.user_id)} size="sm" />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[13px] font-medium text-foreground truncate">{member.full_name || member.email}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {member.custom_role_name === 'admin' ? 'Администратор' : member.custom_role_name || 'Оператор'}
                    {isUserOnline(member.user_id) ? ' • в сети' : ''}
                  </p>
                </div>
              </button>
            ))}
            {filteredMembers.length === 0 && !roomsLoading && (
              <p className="px-2 py-4 text-xs text-muted-foreground text-center">Нет коллег</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {selectedRoom ? (
          <>
            {/* Header */}
            <div className="border-b border-border flex flex-col shrink-0">
              {!chatSearchOpen ? (
                /* Normal header row */
                <div className="h-14 flex items-center gap-3 px-4">
                  {selectedRoom.is_group ? (
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ) : selectedOther ? (
                    <UserAvatar name={selectedOther.full_name || ''} avatarUrl={selectedOther.avatar_url} online={isUserOnline(selectedOther.user_id)} />
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground truncate">{selectedRoomName}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {typingLabel ? (
                        <span className="text-[11px] text-primary flex items-center gap-1">{typingLabel} печатает <TypingDots /></span>
                      ) : (
                        selectedRoom.is_group
                          ? `${selectedRoom.participants.length} участников`
                          : selectedOther && isUserOnline(selectedOther.user_id) ? 'в сети' : 'не в сети'
                      )}
                    </p>
                  </div>
                  <button
                    onClick={openChatSearch}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
                    title="Поиск по истории чата"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                /* Telegram-style search bar row */
                <div className="h-14 flex items-center gap-2 px-3 chat-search-panel">
                  {/* Input */}
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      ref={chatSearchInputRef}
                      type="text"
                      value={chatSearch.query}
                      onChange={e => chatSearch.setQuery(e.target.value)}
                      placeholder="Поиск по сообщениям..."
                      className={cn(
                        'w-full h-8 pl-8 pr-2 text-xs rounded-lg border border-input bg-background',
                        'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary',
                        'placeholder:text-muted-foreground/60 transition-colors chat-search-input'
                      )}
                      onKeyDown={e => {
                        if (e.key === 'Escape') closeChatSearch();
                        if (e.key === 'Enter') chatSearch.goNext();
                        if (e.key === 'ArrowUp') { e.preventDefault(); chatSearch.goPrev(); }
                        if (e.key === 'ArrowDown') { e.preventDefault(); chatSearch.goNext(); }
                      }}
                    />
                  </div>

                  {/* Counter X/Y */}
                  <span className="text-[11px] text-muted-foreground shrink-0 min-w-[36px] text-center chat-search-counter">
                    {chatSearch.isSearching
                      ? '…'
                      : chatSearch.total > 0
                        ? `${chatSearch.displayCurrent}/${chatSearch.total}`
                        : chatSearch.hasQuery ? '0/0' : ''}
                  </span>

                  {/* Prev (↑ = newer) */}
                  <button
                    onClick={chatSearch.goPrev}
                    disabled={!chatSearch.total || chatSearch.currentIndex >= chatSearch.total - 1}
                    className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors chat-search-nav-btn"
                    title="Предыдущее (новее)"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>

                  {/* Next (↓ = older) */}
                  <button
                    onClick={chatSearch.goNext}
                    disabled={!chatSearch.total || chatSearch.currentIndex <= 0}
                    className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors chat-search-nav-btn"
                    title="Следующее (старее)"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  {/* Close */}
                  <button
                    onClick={closeChatSearch}
                    className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
                    title="Закрыть поиск"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
              {messagesLoading ? (
                <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-3/4" />)}</div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">Начните общение</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = msg.sender_id === user?.id;
                  const isDeleted = !!(msg as any).is_deleted;
                  const isEdited = !!(msg as any).updated_at && (msg as any).updated_at !== msg.created_at && !isDeleted;
                  const senderName = getSenderName(msg.sender_id);
                  const senderMember = teamMembers.find(m => m.user_id === msg.sender_id);
                  const showAvatar = !isMe && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id);
                  const replyPreview = (msg as any).reply_to_id ? getReplyPreview((msg as any).reply_to_id) : null;
                  return (
                    <div
                      key={msg.id}
                      ref={(el) => { if (el) messageRefs.current.set(msg.id, el); }}
                      className={cn('flex gap-2.5 group/msg relative chat-msg-row', isMe ? 'flex-row-reverse' : 'flex-row')}
                    >
                      {!isMe && (
                        <div className="w-8">
                          {showAvatar && <UserAvatar name={senderMember?.full_name || ''} avatarUrl={senderMember?.avatar_url} size="sm" />}
                        </div>
                      )}
                      <div className={cn('relative', isMobile ? 'max-w-[80%]' : 'max-w-[65%]')}>
                        {showAvatar && !isMe && selectedRoom.is_group && (
                          <p className="text-[10px] font-medium text-primary mb-0.5 pl-1">{senderName}</p>
                        )}
                        <ContextMenu>
                          <ContextMenuTrigger disabled={isDeleted} asChild>
                            <div
                              className={cn(
                                'px-3 py-2 rounded-2xl text-[13px] leading-relaxed cursor-default select-text chat-bubble-interactive',
                                isDeleted ? 'bg-muted/50 text-muted-foreground italic' :
                                isMe ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted text-foreground rounded-bl-md'
                              )}
                              onClick={(e) => {
                                if (isMobile && !isDeleted) {
                                  e.preventDefault();
                                  const trigger = e.currentTarget;
                                  trigger.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: e.clientX, clientY: e.clientY }));
                                }
                              }}
                            >
                              {replyPreview && !isDeleted && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); scrollToMessage((msg as any).reply_to_id); }}
                                  className={cn(
                                    'w-full text-left mb-1.5 pl-2 py-1 rounded-md text-[11px] leading-tight border-l-2 cursor-pointer chat-reply-quote',
                                    isMe
                                      ? 'border-primary-foreground/40 bg-primary-foreground/10 text-primary-foreground/80 hover:bg-primary-foreground/15'
                                      : 'border-primary bg-primary/5 text-foreground/70 hover:bg-primary/10'
                                  )}
                                >
                                  <span className="font-medium block text-[10px]">{replyPreview.senderName}</span>
                                  <span className="line-clamp-1">{replyPreview.text}</span>
                                </button>
                              )}
                              {isDeleted ? 'Сообщение удалено' : (
                                <>
                                  {msg.text && !msg.text.startsWith('📎') && <span>{renderMentionText(msg.text, teamMembers, isMe)}</span>}
                                  {msg.file_url && (
                                    <ChatFileAttachment
                                      fileUrl={msg.file_url}
                                      fileName={msg.file_name}
                                      fileType={msg.file_type}
                                      fileSize={msg.file_size}
                                      isMe={isMe}
                                    />
                                  )}
                                </>
                              )}
                              <span className={cn('flex items-center justify-end gap-0.5 text-[9px] mt-0.5', isMe && !isDeleted ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                                {isEdited && <span className="mr-0.5">ред.</span>}
                                {format(new Date(msg.created_at), 'HH:mm')}
                                {!isDeleted && <ReadReceipt isRead={isMessageRead(msg.created_at)} isMyMessage={isMe} />}
                              </span>
                          </div>
                          </ContextMenuTrigger>
                          {!isDeleted && (
                            <MessageContextMenuItems msg={msg} isMe={isMe}
                              onReply={() => handleStartReply(msg)}
                              onEdit={() => handleStartEdit(msg)}
                              onDelete={() => handleDelete(msg.id)}
                              onReact={(emoji) => toggleReaction(msg.id, emoji)}
                            />
                          )}
                        </ContextMenu>
                        <ReactionBubbles
                          reactions={reactionsMap[msg.id] || []}
                          onToggle={(emoji) => toggleReaction(msg.id, emoji)}
                        />
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            {typingLabel && (
              <div className="px-4 pb-1">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">{typingLabel} печатает <TypingDots /></p>
              </div>
            )}
            {/* Edit banner */}
            {editingMessage && (
              <div className="border-t border-border px-3 pt-2 pb-1 flex items-center gap-2 bg-muted/30 w-full">
                <Pencil className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground truncate flex-1">Редактирование сообщения</span>
                <button onClick={handleCancelEdit} className="text-muted-foreground hover:text-foreground p-1">
                  <X className={cn(isMobile ? 'h-5 w-5' : 'h-4 w-4')} />
                </button>
              </div>
            )}
            {/* Reply banner */}
            {replyingTo && !editingMessage && (
              <div className="border-t border-border px-3 pt-2 pb-1 flex items-center gap-2 bg-muted/30 w-full chat-reply-banner">
                <Reply className="h-3.5 w-3.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0 border-l-2 border-primary pl-2">
                  <span className="text-[10px] font-medium text-primary block">{getSenderName(replyingTo.sender_id)}</span>
                  <span className="text-xs text-muted-foreground truncate block">{replyingTo.text}</span>
                </div>
                <button onClick={handleCancelReply} className="text-muted-foreground hover:text-foreground shrink-0 p-1">
                  <X className={cn(isMobile ? 'h-5 w-5' : 'h-4 w-4')} />
                </button>
              </div>
            )}
            {/* Upload progress */}
            {isUploading && (
              <div className="border-t border-border px-3 pt-2 pb-1 space-y-1">
                <p className="text-xs text-muted-foreground">Загрузка файла...</p>
                <Progress value={uploadProgress} className="h-1.5" />
              </div>
            )}
            {/* Pending file preview */}
            {pendingFile && !isUploading && (
              <div className="border-t border-border px-3 pt-2 pb-1 flex items-center gap-2 bg-muted/20">
                {pendingFile.previewUrl ? (
                  <img src={pendingFile.previewUrl} alt="" className="h-12 w-12 object-cover rounded shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded bg-muted flex items-center justify-center shrink-0">
                    <Paperclip className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{pendingFile.file.name}</p>
                  <p className="text-[11px] text-muted-foreground">{(pendingFile.file.size / 1024).toFixed(0)} КБ</p>
                </div>
                <button onClick={clearPendingFile} className="text-muted-foreground hover:text-foreground p-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="border-t border-border p-3 flex items-center gap-2">
              <input ref={fileInputRef} type="file" className="hidden" accept="*/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); }} />
              <button
                className="h-9 w-9 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                title="Прикрепить файл"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <ChatMentionInput
                value={inputValue}
                onChange={(val, ids) => handleInputChange(val, ids)}
                onSend={handleSend}
                placeholder={editingMessage ? "Редактирование..." : replyingTo ? "Ответ..." : "Напишите сообщение..."}
                disabled={isUploading}
                teamMembers={teamMembers}
              />
              <Button size="icon" onClick={handleSend} disabled={(!inputValue.trim() && !pendingFile) || isSending || isUploading}>
                {editingMessage ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Выберите чат или коллегу</p>
            <p className="text-xs mt-1">Для начала общения</p>
          </div>
        )}
      </div>

      {/* New Group Dialog */}
      <Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Новая группа</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Название группы</Label>
              <Input
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="Например: Общий чат"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs mb-2 block">Участники</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {teamMembers.map(m => (
                  <label key={m.user_id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors">
                    <Checkbox
                      checked={selectedMembers.includes(m.user_id)}
                      onCheckedChange={(checked) => {
                        setSelectedMembers(prev =>
                          checked ? [...prev, m.user_id] : prev.filter(id => id !== m.user_id)
                        );
                      }}
                    />
                    <UserAvatar name={m.full_name || ''} avatarUrl={m.avatar_url} size="sm" />
                    <span className="text-sm">{m.full_name || m.email}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewGroup(false)}>Отмена</Button>
            <Button onClick={handleCreateGroup} disabled={!groupName.trim() || selectedMembers.length === 0}>
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
