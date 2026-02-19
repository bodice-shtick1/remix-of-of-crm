import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePresence } from '@/hooks/usePresence';

export interface ChatRoom {
  id: string;
  name: string | null;
  is_group: boolean;
  created_at: string;
  created_by: string | null;
  last_message_at: string | null;
  participants: ChatParticipant[];
  lastMessage?: ChatMessage;
  unreadCount: number;
}

export interface ChatParticipant {
  id: string;
  user_id: string;
  room_id: string;
  joined_at: string;
  last_read_at: string | null;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  text: string;
  created_at: string;
  updated_at?: string | null;
  is_read: boolean;
  is_deleted?: boolean;
  reply_to_id?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  // File attachment fields
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
}

export interface TeamMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  custom_role_name: string | null;
  last_seen_at: string | null;
  is_blocked: boolean;
}

export function useInternalChat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { onlineUsers, isUserOnline } = usePresence();

  // ──── Fetch team members ────
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['chat-team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, avatar_url, custom_role_name, last_seen_at, is_blocked')
        .eq('is_blocked', false);
      if (error) throw error;
      return (data || []).filter(p => p.user_id !== user?.id) as TeamMember[];
    },
    enabled: !!user,
  });

  // ──── Fetch rooms ────
  const { data: rooms = [], isLoading: roomsLoading } = useQuery<ChatRoom[]>({
    queryKey: ['chat-rooms'],
    queryFn: async () => {
      const { data: participations, error: pErr } = await supabase
        .from('chat_participants')
        .select('room_id')
        .eq('user_id', user!.id);
      if (pErr) throw pErr;
      if (!participations?.length) return [];

      const roomIds = participations.map(p => p.room_id);

      const { data: roomsData, error: rErr } = await supabase
        .from('chat_rooms')
        .select('*')
        .in('id', roomIds)
        .order('last_message_at', { ascending: false });
      if (rErr) throw rErr;

      const { data: allParticipants } = await supabase
        .from('chat_participants')
        .select('*')
        .in('room_id', roomIds);

      const enriched: ChatRoom[] = [];
      for (const room of roomsData || []) {
        const roomParticipants = (allParticipants || []).filter(p => p.room_id === room.id);
        const myParticipation = roomParticipants.find(p => p.user_id === user!.id);

        const { data: lastMsgs } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('room_id', room.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastReadAt = myParticipation?.last_read_at || '1970-01-01T00:00:00Z';
        const { count } = await supabase
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('room_id', room.id)
          .gt('created_at', lastReadAt)
          .neq('sender_id', user!.id);

        enriched.push({
          ...room,
          participants: roomParticipants as ChatParticipant[],
          lastMessage: lastMsgs?.[0] as ChatMessage | undefined,
          unreadCount: count || 0,
        });
      }
      return enriched;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // ──── Fetch messages for selected room ────
  const { data: messages = [], isLoading: messagesLoading } = useQuery<ChatMessage[]>({
    queryKey: ['chat-messages', selectedRoomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', selectedRoomId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as ChatMessage[];
    },
    enabled: !!selectedRoomId,
  });

  // ──── Presence is now handled globally by PresenceProvider ────

  // ──── Mark room as read (defined early so realtime effects can reference it) ────
  const markRoomRead = useCallback(async (roomId: string) => {
    if (!user) return;
    await supabase
      .from('chat_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', user.id);
    queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
  }, [user, queryClient]);

  // ──── Track other participants' last_read_at for read receipts ────
  // Load as a query (not effect) so data persists in cache and doesn't flash
  const { data: othersReadAt = new Map<string, string>() } = useQuery<Map<string, string>>({
    queryKey: ['chat-others-read', selectedRoomId],
    queryFn: async () => {
      const { data } = await supabase
        .from('chat_participants')
        .select('user_id, last_read_at')
        .eq('room_id', selectedRoomId!)
        .neq('user_id', user!.id);
      const m = new Map<string, string>();
      if (data) {
        data.forEach(p => { if (p.last_read_at) m.set(p.user_id, p.last_read_at); });
      }
      return m;
    },
    enabled: !!selectedRoomId && !!user,
    staleTime: 5000,
  });

  // ──── 2. Realtime subscription for new messages (postgres_changes) ────
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('chat-messages-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        queryClient.setQueryData<ChatMessage[]>(['chat-messages', newMsg.room_id], (old) => {
          if (!old) return [newMsg];
          if (old.some(m => m.id === newMsg.id)) return old;
          return [...old, newMsg];
        });
        queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
        if (newMsg.room_id === selectedRoomId && newMsg.sender_id !== user.id) {
          markRoomRead(newMsg.room_id);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages',
      }, (payload) => {
        const updated = payload.new as ChatMessage;
        queryClient.setQueryData<ChatMessage[]>(['chat-messages', updated.room_id], (old) => {
          if (!old) return old;
          return old.map(m => m.id === updated.id ? { ...m, ...updated } : m);
        });
        queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient, selectedRoomId, markRoomRead]);

  // ──── Realtime subscription for chat_participants read status updates ────
  useEffect(() => {
    if (!selectedRoomId || !user) return;

    const channel = supabase
      .channel(`chat-participants-read:${selectedRoomId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_participants',
        filter: `room_id=eq.${selectedRoomId}`,
      }, (payload) => {
        const updated = payload.new as any;
        if (updated.user_id !== user.id && updated.last_read_at) {
          // Update the cached read-at map directly
          queryClient.setQueryData<Map<string, string>>(['chat-others-read', selectedRoomId], (prev) => {
            const next = new Map(prev || new Map());
            next.set(updated.user_id, updated.last_read_at);
            return next;
          });
          queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedRoomId, user, queryClient]);

  // ──── 3. Typing indicator via broadcast (per-room channel) ────
  useEffect(() => {
    if (!selectedRoomId || !user) return;

    const channel = supabase.channel(`room-typing:${selectedRoomId}`);

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!payload || payload.user_id === user.id) return;

        const { user_id, name, is_typing } = payload;

        if (is_typing) {
          setTypingUsers(prev => {
            const next = new Map(prev);
            next.set(user_id, name || 'Кто-то');
            return next;
          });

          // Clear existing timeout for this user
          const existing = typingTimeoutsRef.current.get(user_id);
          if (existing) clearTimeout(existing);

          // Auto-remove after 3s if no new event
          const timeout = setTimeout(() => {
            setTypingUsers(prev => {
              const next = new Map(prev);
              next.delete(user_id);
              return next;
            });
            typingTimeoutsRef.current.delete(user_id);
          }, 3000);
          typingTimeoutsRef.current.set(user_id, timeout);
        } else {
          setTypingUsers(prev => {
            const next = new Map(prev);
            next.delete(user_id);
            return next;
          });
          const existing = typingTimeoutsRef.current.get(user_id);
          if (existing) {
            clearTimeout(existing);
            typingTimeoutsRef.current.delete(user_id);
          }
        }
      })
      .subscribe();

    typingChannelRef.current = channel;

    return () => {
      // Clear all typing timeouts
      typingTimeoutsRef.current.forEach(t => clearTimeout(t));
      typingTimeoutsRef.current.clear();
      setTypingUsers(new Map());
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [selectedRoomId, user]);

  // Send typing broadcast
  const sendTyping = useCallback((isTyping: boolean) => {
    if (!typingChannelRef.current || !user) return;
    const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        user_id: user.id,
        name,
        is_typing: isTyping,
      },
    });
  }, [user]);

  // ──── Send message ────
  const sendMessageMutation = useMutation({
    mutationFn: async ({
      roomId, text, replyToId, fileUrl, fileName, fileType, fileSize,
    }: {
      roomId: string;
      text: string;
      replyToId?: string | null;
      fileUrl?: string | null;
      fileName?: string | null;
      fileType?: string | null;
      fileSize?: number | null;
    }) => {
      const insertData: any = { room_id: roomId, sender_id: user!.id, text };
      if (replyToId) insertData.reply_to_id = replyToId;
      if (fileUrl) insertData.file_url = fileUrl;
      if (fileName) insertData.file_name = fileName;
      if (fileType) insertData.file_type = fileType;
      if (fileSize) insertData.file_size = fileSize;
      const { data, error } = await supabase
        .from('chat_messages')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      sendTyping(false);
    },
  });

  // ──── Edit message ────
  const editMessageMutation = useMutation({
    mutationFn: async ({ messageId, newText }: { messageId: string; newText: string }) => {
      const { error } = await supabase
        .from('chat_messages')
        .update({ text: newText, updated_at: new Date().toISOString() })
        .eq('id', messageId)
        .eq('sender_id', user!.id);
      if (error) throw error;
    },
  });

  // ──── Delete message (soft) ────
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('chat_messages')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', messageId)
        .eq('sender_id', user!.id);
      if (error) throw error;
    },
  });

  const findOrCreateDM = useCallback(async (otherUserId: string): Promise<string> => {
    if (!user) throw new Error('Not authenticated');

    for (const room of rooms) {
      if (!room.is_group && room.participants.length === 2) {
        const hasOther = room.participants.some(p => p.user_id === otherUserId);
        const hasMe = room.participants.some(p => p.user_id === user.id);
        if (hasOther && hasMe) return room.id;
      }
    }

    const { data: roomId, error: rpcErr } = await supabase.rpc('create_chat_room', {
      p_name: null,
      p_is_group: false,
      p_member_ids: [otherUserId],
    });
    if (rpcErr) throw new Error(`Ошибка создания комнаты: ${rpcErr.message}`);

    queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
    return roomId as string;
  }, [user, rooms, queryClient]);

  // ──── Create group chat ────
  const createGroupChat = useCallback(async (name: string, memberIds: string[]): Promise<string> => {
    if (!user) throw new Error('Not authenticated');

    const { data: roomId, error: rpcErr } = await supabase.rpc('create_chat_room', {
      p_name: name,
      p_is_group: true,
      p_member_ids: memberIds,
    });
    if (rpcErr) throw new Error(`Ошибка создания группы: ${rpcErr.message}`);

    queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
    return roomId as string;
  }, [user, queryClient]);

  const totalUnread = rooms.reduce((sum, r) => sum + r.unreadCount, 0);

  // Helper: check if a message has been read by other participants
  const isMessageRead = useCallback((msgCreatedAt: string): boolean => {
    if (othersReadAt.size === 0) return false;
    const msgTime = new Date(msgCreatedAt).getTime();
    for (const [, readAt] of othersReadAt) {
      if (readAt && msgTime <= new Date(readAt).getTime()) return true;
    }
    return false;
  }, [othersReadAt]);

  return {
    rooms,
    roomsLoading,
    messages,
    messagesLoading,
    teamMembers,
    selectedRoomId,
    setSelectedRoomId,
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isPending,
    editMessage: editMessageMutation.mutateAsync,
    deleteMessage: deleteMessageMutation.mutateAsync,
    markRoomRead,
    findOrCreateDM,
    createGroupChat,
    typingUsers,
    sendTyping,
    totalUnread,
    onlineUsers,
    isUserOnline,
    isMessageRead,
  };
}
