import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface NotificationStats {
  total_prepared: number;
  sent: number;
  delivered: number;
  read: number;
  error: number;
  test_prepared: number;
}

/**
 * Fetch notification stats for a given time range.
 * If no range provided, defaults to today.
 */
export async function fetchNotificationStats(
  from?: string,
  to?: string,
): Promise<NotificationStats> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  let query = supabase
    .from('notification_logs')
    .select('status');

  if (from) {
    query = query.gte('sent_at', from);
  } else {
    query = query.gte('sent_at', startOfDay);
  }

  if (to) {
    query = query.lte('sent_at', to);
  }

  const { data, error } = await query;
  if (error) throw error;

  const logs = data || [];

  const stats: NotificationStats = {
    total_prepared: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    error: 0,
    test_prepared: 0,
  };

  logs.forEach((log: any) => {
    const status = log.status as string;
    stats.total_prepared += 1;

    switch (status) {
      case 'sent':
      case 'pending':
        stats.sent += 1;
        break;
      case 'delivered':
        stats.delivered += 1;
        break;
      case 'read':
        stats.read += 1;
        break;
      case 'error':
      case 'failed':
        stats.error += 1;
        break;
      case 'test_prepared':
        stats.test_prepared += 1;
        break;
    }
  });

  return stats;
}

/**
 * React hook for today's notification stats.
 */
export function useTodayNotificationStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['notification-stats', 'today'],
    queryFn: () => fetchNotificationStats(),
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

/**
 * React hook for shift notification stats.
 */
export function useShiftNotificationStats(shiftOpenedAt: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['notification-stats', 'shift', shiftOpenedAt],
    queryFn: () => fetchNotificationStats(shiftOpenedAt!),
    enabled: !!user && !!shiftOpenedAt,
    staleTime: 30_000,
  });
}
