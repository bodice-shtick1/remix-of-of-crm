import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ChatSearchResult {
  id: string;
  text: string;
  sender_id: string;
  created_at: string;
}

export function useChatSearch(
  roomId: string | null,
  teamMembers: { user_id: string; full_name: string | null; email: string | null }[]
) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [allResults, setAllResults] = useState<ChatSearchResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0); // 0-based, points to allResults[i]
  const [isSearching, setIsSearching] = useState(false);

  // Debounce 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch matching messages when debounced query changes
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2 || !roomId || !user) {
      setAllResults([]);
      setCurrentIndex(0);
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
      .order('created_at', { ascending: true }) // oldest→newest; navigate newest first
      .limit(200)
      .then(({ data, error }) => {
        if (cancelled) return;
        setIsSearching(false);
        if (error || !data) { setAllResults([]); return; }
        setAllResults(data as ChatSearchResult[]);
        // Start at the newest result (last in ascending list)
        setCurrentIndex(data.length > 0 ? data.length - 1 : 0);
      });

    return () => { cancelled = true; };
  }, [debouncedQuery, roomId, user]);

  // Reset on room change
  useEffect(() => {
    setQuery('');
    setDebouncedQuery('');
    setAllResults([]);
    setCurrentIndex(0);
  }, [roomId]);

  const total = allResults.length;
  // Display number: we show "newest = 1", so displayCurrent = total - currentIndex
  const displayCurrent = total > 0 ? total - currentIndex : 0;

  const goNext = useCallback(() => {
    // Next = older message (lower index in ascending array)
    setCurrentIndex(i => Math.max(0, i - 1));
  }, []);

  const goPrev = useCallback(() => {
    // Prev = newer message (higher index in ascending array)
    setCurrentIndex(i => Math.min(allResults.length - 1, i + 1));
  }, [allResults.length]);

  const currentMessageId = total > 0 ? allResults[currentIndex]?.id : null;

  const clear = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setAllResults([]);
    setCurrentIndex(0);
  }, []);

  // Build snippet with <mark> for a given message text
  const buildSnippet = useCallback((text: string): string => {
    if (!debouncedQuery) return text.slice(0, 80);
    const idx = text.toLowerCase().indexOf(debouncedQuery.toLowerCase());
    if (idx < 0) return text.slice(0, 80);
    const start = Math.max(0, idx - 20);
    const end = Math.min(text.length, idx + debouncedQuery.length + 35);
    const before = (start > 0 ? '…' : '') + text.slice(start, idx);
    const match = text.slice(idx, idx + debouncedQuery.length);
    const after = text.slice(idx + debouncedQuery.length, end) + (end < text.length ? '…' : '');
    return `${before}<mark>${match}</mark>${after}`;
  }, [debouncedQuery]);

  return {
    query,
    setQuery,
    allResults,
    currentIndex,
    currentMessageId,
    total,
    displayCurrent,
    isSearching,
    hasQuery: debouncedQuery.length >= 2,
    goNext,
    goPrev,
    clear,
    buildSnippet,
  };
}
