import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useState, useMemo } from 'react';

interface MessageSearchResult {
  client_id: string;
  content: string;
  created_at: string;
}

export function useMessageSearch(searchQuery: string) {
  const { user } = useAuth();
  const trimmed = searchQuery.trim();
  const enabled = !!user && trimmed.length >= 3;

  const { data: matchedMessages, isLoading } = useQuery({
    queryKey: ['message-search', trimmed],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('messages' as any)
        .select('client_id, content, created_at')
        .ilike('content', `%${trimmed}%`)
        .order('created_at', { ascending: false })
        .limit(100) as any);
      if (error) throw error;
      return (data || []) as MessageSearchResult[];
    },
    enabled,
    staleTime: 30_000,
  });

  // Map: client_id → matched snippet
  const snippetMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!matchedMessages) return map;
    for (const msg of matchedMessages) {
      if (!map.has(msg.client_id)) {
        // Extract snippet around the match
        const idx = msg.content.toLowerCase().indexOf(trimmed.toLowerCase());
        if (idx >= 0) {
          const start = Math.max(0, idx - 20);
          const end = Math.min(msg.content.length, idx + trimmed.length + 30);
          const snippet = (start > 0 ? '...' : '') + msg.content.slice(start, end) + (end < msg.content.length ? '...' : '');
          map.set(msg.client_id, snippet);
        } else {
          map.set(msg.client_id, msg.content.slice(0, 60));
        }
      }
    }
    return map;
  }, [matchedMessages, trimmed]);

  // Set of client IDs that have matching messages
  const matchedClientIds = useMemo(() => new Set(snippetMap.keys()), [snippetMap]);

  return { matchedClientIds, snippetMap, isSearching: isLoading && enabled, isActive: enabled };
}
