import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';

const SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Global background email sync provider.
 * - Polls email-sync every 2 minutes silently
 * - Subscribes to realtime inserts on emails table
 */
export function useEmailSync() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { accounts } = useEmailAccounts();
  const queryClient = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasPermission = user && can('email_view_own');

  const silentSync = useCallback(async () => {
    if (!accounts || accounts.length === 0) return;

    for (const account of accounts) {
      try {
        await supabase.functions.invoke('email-sync', {
          body: { account_id: account.id, silent: true },
        });
      } catch (err) {
        console.error('Background email sync error:', err);
      }
    }
  }, [accounts]);

  // Background polling
  useEffect(() => {
    if (!hasPermission || accounts.length === 0) return;

    // Initial sync after 5 seconds
    const initTimeout = setTimeout(silentSync, 5000);

    intervalRef.current = setInterval(silentSync, SYNC_INTERVAL_MS);

    return () => {
      clearTimeout(initTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasPermission, accounts.length, silentSync]);

  // Realtime subscription on emails table
  useEffect(() => {
    if (!hasPermission) return;

    const channel = supabase
      .channel('emails-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'emails' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['emails'] });
          queryClient.invalidateQueries({ queryKey: ['client-emails'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'emails' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['emails'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasPermission, queryClient]);
}
