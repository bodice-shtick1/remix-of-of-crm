import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface TelegramConfig {
  api_id: string;
  api_hash: string;
  session_string: string;
}

export interface OnlineStatus {
  is_online: boolean;
  last_seen: string | null;
}

export function useTelegramSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [onlineStatuses, setOnlineStatuses] = useState<Record<string, OnlineStatus>>({});
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get telegram config
  const { data: telegramConfig } = useQuery({
    queryKey: ['telegram-config-sync'],
    queryFn: async () => {
      const { data } = await supabase
        .from('messenger_settings')
        .select('config')
        .eq('channel', 'telegram')
        .maybeSingle();

      if (!data?.config) return null;
      const cfg = data.config as Record<string, unknown>;
      if (cfg.connection_type === 'user_api' && cfg.session_string) {
        return {
          api_id: cfg.api_id as string,
          api_hash: cfg.api_hash as string,
          session_string: cfg.session_string as string,
        } as TelegramConfig;
      }
      return null;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const isConfigured = !!telegramConfig;

  // Backfill chat history for a specific client
  const backfillChat = useCallback(async (clientId: string, clientPhone: string) => {
    if (!telegramConfig || !user) return null;

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-sync', {
        body: {
          action: 'backfill',
          ...telegramConfig,
          user_id: user.id,
          client_id: clientId,
          client_phone: clientPhone,
          limit: 50,
        },
      });

      if (error) throw error;

      // Refresh messages
      queryClient.invalidateQueries({ queryKey: ['messages', clientId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });

      if (data?.synced > 0) {
        toast.success(`Загружено ${data.synced} сообщений из Telegram`);
      }

      return data;
    } catch (err) {
      console.error('Backfill error:', err);
      toast.error('Ошибка загрузки истории Telegram');
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [telegramConfig, user, queryClient]);

  // Poll for new messages + check read statuses
  const pollMessages = useCallback(async () => {
    if (!telegramConfig || !user) return null;

    try {
      const { data, error } = await supabase.functions.invoke('telegram-sync', {
        body: {
          action: 'poll',
          ...telegramConfig,
          user_id: user.id,
        },
      });

      if (error) throw error;

      if (data?.synced > 0) {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['messages'] });
      }

      if (data?.read_updated > 0) {
        queryClient.invalidateQueries({ queryKey: ['messages'] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['notification-logs'] });
        queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
      }

      // Update online statuses
      if (data?.online_statuses) {
        setOnlineStatuses(data.online_statuses);
      }

      return data;
    } catch (err) {
      console.error('Poll error:', err);
      return null;
    }
  }, [telegramConfig, user, queryClient]);

  // Start/stop polling every 30 seconds
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current || !isConfigured) return;

    setIsPolling(true);
    // Initial poll
    pollMessages();

    pollIntervalRef.current = setInterval(() => {
      pollMessages();
    }, 30_000);
  }, [isConfigured, pollMessages]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Auto-start polling when configured
  useEffect(() => {
    if (isConfigured && user) {
      startPolling();
    }
    return () => stopPolling();
  }, [isConfigured, user, startPolling, stopPolling]);

  return {
    isConfigured,
    isSyncing,
    isPolling,
    telegramConfig,
    onlineStatuses,
    backfillChat,
    pollMessages,
    startPolling,
    stopPolling,
  };
}
