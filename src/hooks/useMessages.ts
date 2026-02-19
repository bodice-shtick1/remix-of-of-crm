import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useCallback, useRef, useState } from 'react';

export type MessageDirection = 'in' | 'out';
export type MessageChannel = 'whatsapp' | 'telegram' | 'sms' | 'max' | 'max_web';

export interface Message {
  id: string;
  client_id: string;
  user_id: string;
  manager_id: string | null;
  content: string;
  direction: MessageDirection;
  channel: MessageChannel;
  is_internal: boolean;
  is_read: boolean;
  is_automated: boolean;
  template_id: string | null;
  created_at: string;
  updated_at: string;
  external_message_id: string | null;
  media_url: string | null;
  media_type: string | null;
  message_type: string;
  delivery_status: 'pending' | 'sent' | 'read' | 'error';
  client?: {
    id: string;
    first_name: string;
    last_name: string;
    middle_name: string | null;
    phone: string;
  };
  // Optimistic-only fields (not in DB)
  _optimistic?: boolean;
  _error?: string;
}

export interface ConversationSummary {
  client_id: string;
  client_first_name: string;
  client_last_name: string;
  client_phone: string;
  last_message: string;
  last_message_at: string;
  last_channel: MessageChannel;
  unread_count: number;
  manager_id: string | null;
  last_is_automated: boolean;
}

export function useMessages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('inbox-muted') === 'true');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      localStorage.setItem('inbox-muted', String(next));
      return next;
    });
  }, []);

  // Conversations list
  const conversationsQuery = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      // Get all messages with client info, ordered by latest
      const { data, error } = await (supabase
        .from('messages' as any)
        .select('*, client:clients(id, first_name, last_name, middle_name, phone)')
        .order('created_at', { ascending: false })
        .limit(500) as any);

      if (error) throw error;

      // Group by client_id to build conversations
      const convMap = new Map<string, ConversationSummary>();
      for (const msg of (data || [])) {
        const existing = convMap.get(msg.client_id);
        if (!existing) {
          convMap.set(msg.client_id, {
            client_id: msg.client_id,
            client_first_name: msg.client?.first_name || '',
            client_last_name: msg.client?.last_name || '',
            client_phone: msg.client?.phone || '',
            last_message: msg.content,
            last_message_at: msg.created_at,
            last_channel: msg.channel as MessageChannel,
            unread_count: msg.direction === 'in' && !msg.is_read ? 1 : 0,
            manager_id: msg.manager_id,
            last_is_automated: !!msg.is_automated,
          });
        } else {
          if (msg.direction === 'in' && !msg.is_read) {
            existing.unread_count += 1;
          }
        }
      }

      return Array.from(convMap.values()).sort(
        (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Messages for a specific client
  const useClientMessages = (clientId: string | null) => {
    return useQuery({
      queryKey: ['messages', clientId],
      queryFn: async () => {
        if (!clientId) return [];
        const { data, error } = await (supabase
          .from('messages' as any)
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: true })
          .limit(200) as any);

        if (error) throw error;
        return (data || []) as Message[];
      },
      enabled: !!user && !!clientId,
      staleTime: 10_000,
    });
  };

  // Send message with optimistic update
  const sendMutation = useMutation({
    mutationFn: async (params: {
      client_id: string;
      content: string;
      channel: MessageChannel;
      is_internal: boolean;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await (supabase
        .from('messages' as any)
        .insert([{
          client_id: params.client_id,
          user_id: user.id,
          manager_id: user.id,
          content: params.content,
          direction: 'out',
          channel: params.channel,
          is_internal: params.is_internal,
          is_read: true,
        }]) as any);
      if (error) throw error;
    },
    onMutate: async (vars) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['messages', vars.client_id] });
      await queryClient.cancelQueries({ queryKey: ['conversations'] });

      const previousMessages = queryClient.getQueryData(['messages', vars.client_id]);
      const previousConversations = queryClient.getQueryData(['conversations']);

      // Optimistic message
      const optimisticMsg: Message = {
        id: `optimistic-${Date.now()}`,
        client_id: vars.client_id,
        user_id: user!.id,
        manager_id: user!.id,
        content: vars.content,
        direction: 'out',
        channel: vars.channel,
        is_internal: vars.is_internal,
        is_read: true,
        is_automated: false,
        template_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        external_message_id: null,
        media_url: null,
        media_type: null,
        message_type: 'text',
        delivery_status: 'pending',
        _optimistic: true,
      };

      // Add to messages cache
      queryClient.setQueryData(['messages', vars.client_id], (old: Message[] | undefined) =>
        [...(old || []), optimisticMsg]
      );

      // Update conversations cache
      queryClient.setQueryData(['conversations'], (old: ConversationSummary[] | undefined) => {
        if (!old) return old;
        const updated = old.map(c =>
          c.client_id === vars.client_id
            ? { ...c, last_message: vars.content, last_message_at: optimisticMsg.created_at, last_channel: vars.channel }
            : c
        );
        return updated.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
      });

      return { previousMessages, previousConversations };
    },
    onError: (_err, vars, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', vars.client_id], context.previousMessages);
      }
      if (context?.previousConversations) {
        queryClient.setQueryData(['conversations'], context.previousConversations);
      }
    },
    onSettled: (_, __, vars) => {
      queryClient.invalidateQueries({ queryKey: ['messages', vars.client_id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Mark as read
  const markReadMutation = useMutation({
    mutationFn: async (clientId: string) => {
      if (!user) return;
      await (supabase
        .from('messages' as any)
        .update({ is_read: true })
        .eq('client_id', clientId)
        .eq('direction', 'in')
        .eq('is_read', false) as any);
    },
    onSuccess: (_, clientId) => {
      queryClient.invalidateQueries({ queryKey: ['messages', clientId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Transfer chat
  const transferMutation = useMutation({
    mutationFn: async (params: { clientId: string; toManagerId: string; fromName: string; toName: string }) => {
      if (!user) throw new Error('Not authenticated');
      // Update manager_id on all messages for this client
      await (supabase
        .from('messages' as any)
        .update({ manager_id: params.toManagerId })
        .eq('client_id', params.clientId) as any);

      // Add system note
      await (supabase
        .from('messages' as any)
        .insert([{
          client_id: params.clientId,
          user_id: user.id,
          manager_id: params.toManagerId,
          content: `Чат передан от ${params.fromName} к ${params.toName}`,
          direction: 'out',
          channel: 'whatsapp',
          is_internal: true,
          is_read: true,
        }]) as any);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['messages', vars.clientId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Unread count
  const totalUnread = conversationsQuery.data?.reduce((sum, c) => sum + c.unread_count, 0) ?? 0;

  // Realtime subscription — strip optimistic messages on INSERT to prevent dupes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          const clientId = (payload.new as any)?.client_id;

          if (payload.eventType === 'INSERT') {
            // If it's an outgoing message from us, remove any optimistic duplicates
            if ((payload.new as any).direction === 'out' && (payload.new as any).user_id === user.id && clientId) {
              queryClient.setQueryData<Message[]>(['messages', clientId], (old) => {
                if (!old) return old;
                // Remove optimistic messages that match this content
                const withoutOptimistic = old.filter(m => !m._optimistic);
                return withoutOptimistic;
              });
            }
            // Play sound for incoming
            if ((payload.new as any).direction === 'in' && !isMuted) {
              playDing();
            }
          }

          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          if ((payload.new as any)?.direction === 'in') {
            queryClient.invalidateQueries({ queryKey: ['archived-clients'] });
          }
          if (clientId) {
            queryClient.invalidateQueries({ queryKey: ['messages', clientId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, isMuted]);

  const playDing = useCallback(() => {
    try {
      if (!audioRef.current) {
        // Create a simple ding sound using AudioContext
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch {
      // Audio might not be available
    }
  }, []);

  return {
    conversations: conversationsQuery.data ?? [],
    isLoading: conversationsQuery.isLoading,
    totalUnread,
    useClientMessages,
    sendMessage: sendMutation.mutate,
    isSending: sendMutation.isPending,
    markAsRead: markReadMutation.mutate,
    transferChat: transferMutation.mutate,
    isMuted,
    toggleMute,
  };
}
