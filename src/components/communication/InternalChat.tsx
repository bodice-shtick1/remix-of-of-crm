import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useInternalChat, type ChatRoom, type TeamMember } from '@/hooks/useInternalChat';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, Send, Users, Plus, Hash, User, MessageSquare, Check, CheckCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

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
      'inline-block h-3 w-3 ml-0.5 shrink-0 transition-colors',
      isRead ? 'text-primary' : (isMyMessage ? 'text-primary-foreground/50' : 'text-muted-foreground')
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
  } = useInternalChat();

  const [internalSearch, setInternalSearch] = useState('');
  const search = compact ? (externalSearch ?? '') : internalSearch;
  const setSearch = compact ? (() => {}) : setInternalSearch;
  const [inputValue, setInputValue] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Mark as read on room select
  useEffect(() => {
    if (selectedRoomId) markRoomRead(selectedRoomId);
  }, [selectedRoomId, markRoomRead]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || !selectedRoomId) return;
    sendMessage({ roomId: selectedRoomId, text: inputValue.trim() });
    setInputValue('');
  }, [inputValue, selectedRoomId, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (val: string) => {
    setInputValue(val);
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

  // Filter contacts + rooms
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
        <div className="flex flex-col h-full bg-card">
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
                const senderName = getSenderName(msg.sender_id);
                const senderMember = teamMembers.find(m => m.user_id === msg.sender_id);
                const showAvatar = !isMe && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id);
                return (
                  <div key={msg.id} className={cn('flex gap-2', isMe ? 'flex-row-reverse' : 'flex-row')}>
                    {!isMe && (
                      <div className="w-7">
                        {showAvatar && <UserAvatar name={senderMember?.full_name || ''} avatarUrl={senderMember?.avatar_url} size="sm" />}
                      </div>
                    )}
                    <div className="max-w-[70%]">
                      {showAvatar && !isMe && selectedRoom.is_group && (
                        <p className="text-[10px] font-medium text-primary mb-0.5 pl-1">{senderName}</p>
                      )}
                      <div className={cn(
                        'px-3 py-1.5 rounded-2xl text-[13px] leading-relaxed',
                        isMe ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted text-foreground rounded-bl-md'
                      )}>
                        {msg.text}
                        <span className={cn('flex items-center justify-end gap-0.5 text-[9px] mt-0.5', isMe ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                          {format(new Date(msg.created_at), 'HH:mm')}
                          <ReadReceipt isRead={isMessageRead(msg.created_at)} isMyMessage={isMe} />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border/30 p-2 flex items-center gap-2 shrink-0">
            <Input
              placeholder="Сообщение..."
              value={inputValue}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 h-8 text-xs"
            />
            <Button size="icon" className="h-8 w-8" onClick={handleSend} disabled={!inputValue.trim() || isSending}>
              <Send className="h-3.5 w-3.5" />
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
    <div className="flex h-[calc(100vh-180px)] rounded-xl border border-border overflow-hidden bg-card">
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
            <div className="h-14 border-b border-border flex items-center gap-3 px-4">
              {selectedRoom.is_group ? (
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
              ) : selectedOther ? (
                <UserAvatar name={selectedOther.full_name || ''} avatarUrl={selectedOther.avatar_url} online={isUserOnline(selectedOther.user_id)} />
              ) : null}
              <div>
                <h3 className="text-sm font-semibold text-foreground">{selectedRoomName}</h3>
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
                  const senderName = getSenderName(msg.sender_id);
                  const senderMember = teamMembers.find(m => m.user_id === msg.sender_id);
                  const showAvatar = !isMe && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id);
                  return (
                    <div key={msg.id} className={cn('flex gap-2.5', isMe ? 'flex-row-reverse' : 'flex-row')}>
                      {!isMe && (
                        <div className="w-8">
                          {showAvatar && <UserAvatar name={senderMember?.full_name || ''} avatarUrl={senderMember?.avatar_url} size="sm" />}
                        </div>
                      )}
                      <div className="max-w-[65%]">
                        {showAvatar && !isMe && selectedRoom.is_group && (
                          <p className="text-[10px] font-medium text-primary mb-0.5 pl-1">{senderName}</p>
                        )}
                        <div className={cn(
                          'px-3 py-2 rounded-2xl text-[13px] leading-relaxed',
                          isMe ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted text-foreground rounded-bl-md'
                        )}>
                          {msg.text}
                          <span className={cn('flex items-center justify-end gap-0.5 text-[9px] mt-0.5', isMe ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                            {format(new Date(msg.created_at), 'HH:mm')}
                            <ReadReceipt isRead={isMessageRead(msg.created_at)} isMyMessage={isMe} />
                          </span>
                        </div>
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
            <div className="border-t border-border p-3 flex items-center gap-2">
              <Input placeholder="Напишите сообщение..." value={inputValue} onChange={e => handleInputChange(e.target.value)} onKeyDown={handleKeyDown} className="flex-1 text-[13px]" />
              <Button size="icon" onClick={handleSend} disabled={!inputValue.trim() || isSending}><Send className="h-4 w-4" /></Button>
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
