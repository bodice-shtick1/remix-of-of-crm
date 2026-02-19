import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TriggerStat {
  templateId: string;
  totalSent: number;
  lastSentAt: string | null;
}

export function useTriggerStats(templateIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['trigger-stats', templateIds.sort().join(',')],
    queryFn: async (): Promise<Map<string, TriggerStat>> => {
      if (templateIds.length === 0) return new Map();

      const { data, error } = await supabase
        .from('notification_logs')
        .select('template_id, sent_at')
        .in('template_id', templateIds);

      if (error) throw error;

      const map = new Map<string, TriggerStat>();

      for (const row of data || []) {
        const tid = row.template_id;
        if (!tid) continue;

        const existing = map.get(tid);
        if (existing) {
          existing.totalSent++;
          if (!existing.lastSentAt || row.sent_at > existing.lastSentAt) {
            existing.lastSentAt = row.sent_at;
          }
        } else {
          map.set(tid, {
            templateId: tid,
            totalSent: 1,
            lastSentAt: row.sent_at,
          });
        }
      }

      return map;
    },
    enabled: !!user && templateIds.length > 0,
    staleTime: 30_000,
  });
}
