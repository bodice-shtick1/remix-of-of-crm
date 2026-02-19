import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function useTestMode() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notification-test-mode'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_settings')
        .select('notification_test_mode')
        .maybeSingle();

      if (error) throw error;
      // Default to true (test mode on) if no settings
      return (data as any)?.notification_test_mode ?? true;
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (testMode: boolean) => {
      if (!user) throw new Error('Not authenticated');

      // Upsert: try update first, then insert
      const { data: existing } = await supabase
        .from('agent_settings')
        .select('id')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('agent_settings')
          .update({ notification_test_mode: testMode } as any)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('agent_settings')
          .insert([{ user_id: user.id, notification_test_mode: testMode }] as any);
        if (error) throw error;
      }
    },
    onSuccess: (_data, testMode) => {
      queryClient.invalidateQueries({ queryKey: ['notification-test-mode'] });
      toast.success(testMode ? 'Тестовый режим включён' : 'Тестовый режим выключен — рассылки будут отправляться реально');
    },
    onError: (err: Error) => {
      toast.error('Ошибка: ' + err.message);
    },
  });

  return {
    testMode: query.data ?? true,
    isLoading: query.isLoading,
    toggleTestMode: toggleMutation.mutate,
    isToggling: toggleMutation.isPending,
  };
}
