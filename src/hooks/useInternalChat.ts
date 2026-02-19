import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
  is_read: boolean;
  media_url?: string | null;
  media_type?: string | null;
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
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch team members
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

  // Fetch rooms user participates in
  const { data: rooms = [], isLoading: roomsLoading } = useQuery<ChatRoom[]>({
    queryKey: ['chat-rooms'],
    queryFn: async () => {
      // Get participations
      const { data: participations, error: pErr } = await supabase
        .from('chat_participants')
        .select('room_id')
        .eq('user_id', user!.id);
      if (pErr) throw pErr;
      if (!participations?.length) return [];

      const roomIds = participations.map(p => p.room_id);

      // Get rooms
      const { data: roomsData, error: rErr } = await supabase
        .from('chat_rooms')
        .select('*')
        .in('id', roomIds)
        .order('last_message_at', { ascending: false });
      if (rErr) throw rErr;

      // Get all participants for these rooms
      const { data: allParticipants } = await supabase
        .from('chat_participants')
        .select('*')
        .in('room_id', roomIds);

      // Get last message for each room
      const enriched: ChatRoom[] = [];
      for (const room of roomsData || []) {
        const roomParticipants = (allParticipants || []).filter(p => p.room_id === room.id);
        const myParticipation = roomParticipants.find(p => p.user_id === user!.id);

        // Get last message
        const { data: lastMsgs } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('room_id', room.id)
          .order('created_at', { ascending: false })
          .limit(1);

        // Count unread
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

  // Fetch messages for selected room
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

  // Realtime subscription for new messages
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
        // Update messages if in the same room
        queryClient.setQueryData<ChatMessage[]>(['chat-messages', newMsg.room_id], (old) => {
          if (!old) return [newMsg];
          if (old.some(m => m.id === newMsg.id)) return old;
          return [...old, newMsg];
        });
        // Refresh rooms list for unread counts
        queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  // Typing indicator via presence
  useEffect(() => {
    if (!selectedRoomId || !user) return;

    const channel = supabase.channel(`typing:${selectedRoomId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const typing = new Map<string, string>();
        Object.entries(state).forEach(([userId, presences]) => {
          const p = presences[0] as any;
          if (p?.typing && userId !== user.id) {
            typing.set(userId, p.name || 'Кто-то');
          }
        });
        setTypingUsers(typing);
      })
      .subscribe();

    typingChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [selectedRoomId, user]);

  // Send typing indicator
  const sendTyping = useCallback((isTyping: boolean) => {
    if (!typingChannelRef.current || !user) return;
    typingChannelRef.current.track({ typing: isTyping, name: user.email?.split('@')[0] || 'User' });
  }, [user]);

  // Send message
  const sendMessageMutation = useMutation({
    mutationFn: async ({ roomId, text }: { roomId: string; text: string }) => {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({ room_id: roomId, sender_id: user!.id, text })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      sendTyping(false);
    },
  });

  // Mark room as read
  const markRoomRead = useCallback(async (roomId: string) => {
    if (!user) return;
    await supabase
      .from('chat_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', user.id);
    queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
  }, [user, queryClient]);

  // Create or find 1-on-1 room
  const findOrCreateDM = useCallback(async (otherUserId: string): Promise<string> => {
    if (!user) throw new Error('Not authenticated');

    // Check existing rooms for 1-on-1 with this user
    for (const room of rooms) {
      if (!room.is_group && room.participants.length === 2) {
        const hasOther = room.participants.some(p => p.user_id === otherUserId);
        const hasMe = room.participants.some(p => p.user_id === user.id);
        if (hasOther && hasMe) return room.id;
      }
    }

    // Create room + participants atomically via RPC
    const { data: roomId, error: rpcErr } = await supabase.rpc('create_chat_room', {
      p_name: null,
      p_is_group: false,
      p_member_ids: [otherUserId],
    });
    if (rpcErr) throw new Error(`Ошибка создания комнаты: ${rpcErr.message}`);
    const newRoomId = roomId as string;

    queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
    return newRoomId;
  }, [user, rooms, queryClient]);

  // Create group chat
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

  // Update online status periodically
  useEffect(() => {
    if (!user) return;
    const update = () => supabase.rpc('update_last_seen');
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [user]);

  // Total unread count across all rooms
  const totalUnread = rooms.reduce((sum, r) => sum + r.unreadCount, 0);

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
    markRoomRead,
    findOrCreateDM,
    createGroupChat,
    typingUsers,
    sendTyping,
    totalUnread,
  };
}
