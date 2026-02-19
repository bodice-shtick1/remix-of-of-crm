import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ChatSearchResult {
  id: string;
  text: string;
  sender_id: string;
  created_at: string;
  senderName: string;
  snippet: string; // fragment with match highlighted (plain text, use with dangerouslySetInnerHTML)
}

export function useChatSearch(roomId: string | null, teamMembers: { user_id: string; full_name: string | null; email: string | null }[]) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<ChatSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Debounce 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const getSenderName = useCallback((senderId: string) => {
    if (senderId === user?.id) return 'Вы';
    const m = teamMembers.find(t => t.user_id === senderId);
    return m?.full_name || m?.email?.split('@')[0] || 'Участник';
  }, [teamMembers, user]);

  const buildSnippet = (text: string, q: string): string => {
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text.slice(0, 80);
    const start = Math.max(0, idx - 25);
    const end = Math.min(text.length, idx + q.length + 40);
    const before = (start > 0 ? '…' : '') + text.slice(start, idx);
    const match = text.slice(idx, idx + q.length);
    const after = text.slice(idx + q.length, end) + (end < text.length ? '…' : '');
    // Use <mark> for highlighting
    return `${before}<mark>${match}</mark>${after}`;
  };

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2 || !roomId || !user) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    supabase
      .from('chat_messages')
      .select('id, text, sender_id, created_at')
      .eq('room_id', roomId)
      .eq('is_deleted', false)
      .ilike('text', `%${debouncedQuery}%`)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setIsSearching(false); return; }
        const mapped: ChatSearchResult[] = (data || []).map(msg => ({
          id: msg.id,
          text: msg.text,
          sender_id: msg.sender_id,
          created_at: msg.created_at,
          senderName: getSenderName(msg.sender_id),
          snippet: buildSnippet(msg.text, debouncedQuery),
        }));
        setResults(mapped);
        setIsSearching(false);
        setIsOpen(true);
      });

    return () => { cancelled = true; };
  }, [debouncedQuery, roomId, user, getSenderName]);

  const clear = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setResults([]);
    setIsOpen(false);
  }, []);

  return {
    query,
    setQuery,
    results,
    isSearching,
    isOpen,
    setIsOpen,
    clear,
    hasQuery: debouncedQuery.length >= 2,
  };
}
