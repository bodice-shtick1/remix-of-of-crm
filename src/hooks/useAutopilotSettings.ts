import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { logEventDirect } from '@/hooks/useEventLog';

const DEFAULT_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri

interface AutopilotSettings {
  autoProcessTime: string;
  autoProcessDays: number[];
  lastAutoRunDate: string | null;
}

interface SaveParams {
  time: string;
  days: number[];
}

export function useAutopilotSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['autopilot-settings'],
    queryFn: async (): Promise<AutopilotSettings> => {
      const { data, error } = await supabase
        .from('agent_settings')
        .select('auto_process_time, auto_process_days, last_auto_run_date')
        .maybeSingle();

      if (error) throw error;

      return {
        autoProcessTime: (data as any)?.auto_process_time ?? '09:00',
        autoProcessDays: (data as any)?.auto_process_days ?? DEFAULT_DAYS,
        lastAutoRunDate: (data as any)?.last_auto_run_date ?? null,
      };
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ time, days }: SaveParams) => {
      if (!user) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('agent_settings')
        .select('id')
        .maybeSingle();

      const payload = {
        auto_process_time: time,
        auto_process_days: days,
      } as any;

      if (existing) {
        const { error } = await supabase
          .from('agent_settings')
          .update(payload)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('agent_settings')
          .insert([{ user_id: user.id, ...payload }]);
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['autopilot-settings'] });
      toast.success('Настройки автопилота сохранены');
      logEventDirect({ action: 'settings_change', category: 'service', entityType: 'autopilot', fieldAccessed: 'Настройки автопилота', newValue: `Время: ${variables.time}, Дни: ${variables.days.join(',')}` });
    },
    onError: (err: Error) => {
      toast.error('Ошибка сохранения: ' + err.message);
    },
  });

  return {
    autoProcessTime: query.data?.autoProcessTime ?? '09:00',
    autoProcessDays: query.data?.autoProcessDays ?? DEFAULT_DAYS,
    lastAutoRunDate: query.data?.lastAutoRunDate ?? null,
    isLoading: query.isLoading,
    saveSettings: saveMutation.mutate,
    isSaving: saveMutation.isPending,
  };
}
