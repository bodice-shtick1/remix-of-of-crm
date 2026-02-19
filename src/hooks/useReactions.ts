import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface MessageReaction {
  emoji: string;
  count: number;
  userIds: string[];
  hasMe: boolean;
}

// emoji → Record<messageId, reactions>
export type ReactionsMap = Record<string, MessageReaction[]>;

function groupReactions(rows: any[], myUserId: string): MessageReaction[] {
  const map: Record<string, { count: number; userIds: string[] }> = {};
  for (const r of rows) {
    if (!map[r.emoji]) map[r.emoji] = { count: 0, userIds: [] };
    map[r.emoji].count++;
    map[r.emoji].userIds.push(r.user_id);
  }
  return Object.entries(map).map(([emoji, { count, userIds }]) => ({
    emoji,
    count,
    userIds,
    hasMe: userIds.includes(myUserId),
  }));
}

export function useReactions(roomId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all reactions for messages in this room
  const { data: reactionsMap = {} } = useQuery<ReactionsMap>({
    queryKey: ['chat-reactions', roomId],
    queryFn: async () => {
      // Get all message ids for this room then fetch reactions
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('room_id', roomId!);
      if (!msgs?.length) return {};

      const msgIds = msgs.map(m => m.id);
      const { data: rows } = await supabase
        .from('chat_message_reactions' as any)
        .select('*')
        .in('message_id', msgIds);

      const result: ReactionsMap = {};
      for (const msgId of msgIds) {
        const msgRows = (rows || []).filter((r: any) => r.message_id === msgId);
        if (msgRows.length) result[msgId] = groupReactions(msgRows, user!.id);
      }
      return result;
    },
    enabled: !!roomId && !!user,
    staleTime: 5000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!roomId || !user) return;

    const channel = supabase
      .channel(`reactions:${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_message_reactions',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat-reactions', roomId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, user, queryClient]);

  // Toggle reaction
  const toggleReactionMutation = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const existing = reactionsMap[messageId]?.find(r => r.emoji === emoji && r.hasMe);
      if (existing) {
        // Remove
        await supabase
          .from('chat_message_reactions' as any)
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user!.id)
          .eq('emoji', emoji);
      } else {
        // Add
        await supabase
          .from('chat_message_reactions' as any)
          .insert({ message_id: messageId, user_id: user!.id, emoji });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-reactions', roomId] });
    },
  });

  const toggleReaction = useCallback(
    (messageId: string, emoji: string) => toggleReactionMutation.mutate({ messageId, emoji }),
    [toggleReactionMutation]
  );

  return { reactionsMap, toggleReaction };
}
