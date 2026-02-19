import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Polling fallback for incoming messages.
 * Periodically checks DB for new messages to supplement realtime.
 */
export function useMessagePolling(activeClientId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const lastCheckRef = useRef<string>(new Date().toISOString());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkNewMessages = useCallback(async () => {
    if (!user) return;

    try {
      const since = lastCheckRef.current;
      const now = new Date().toISOString();

      // Check for any new messages since last check
      const { data, error } = await (supabase
        .from('messages' as any)
        .select('id, client_id, direction, created_at')
        .gt('created_at', since)
        .order('created_at', { ascending: false })
        .limit(20) as any);

      if (error || !data || data.length === 0) {
        lastCheckRef.current = now;
        return;
      }

      lastCheckRef.current = now;

      // Invalidate affected queries
      const affectedClients = new Set<string>();
      for (const msg of data) {
        affectedClients.add(msg.client_id);
      }

      if (affectedClients.size > 0) {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        for (const clientId of affectedClients) {
          queryClient.invalidateQueries({ queryKey: ['messages', clientId] });
        }
      }
    } catch (err) {
      console.error('Message polling error:', err);
    }
  }, [user, queryClient]);

  useEffect(() => {
    if (!user) return;

    // Poll every 10 seconds as fallback
    intervalRef.current = setInterval(checkNewMessages, 10_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, checkNewMessages]);

  return { checkNewMessages };
}
