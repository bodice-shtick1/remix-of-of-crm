import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { logEventDirect } from '@/hooks/useEventLog';

export interface NotificationTrigger {
  id: string;
  user_id: string;
  event_type: string;
  template_id: string | null;
  days_before: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useNotificationTriggers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notification-triggers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_triggers')
        .select('*')
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as unknown as NotificationTrigger[];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  /** Unified save: INSERT if no id, UPDATE if id provided */
  const saveMutation = useMutation({
    mutationFn: async (params: {
      id?: string;
      event_type: string;
      template_id: string;
      days_before: number;
      is_active: boolean;
    }) => {
      if (!user) throw new Error('Not authenticated');

      if (params.id) {
        const { id, ...updates } = params;
        const { error } = await supabase
          .from('notification_triggers')
          .update(updates)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { id, ...insertData } = params;
        const { error } = await supabase
          .from('notification_triggers')
          .insert([{ ...insertData, user_id: user.id }]);
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notification-triggers'] });
      toast.success(variables.id ? 'Триггер обновлён' : 'Авто-рассылка создана');
      logEventDirect({ action: variables.id ? 'update' : 'create', category: 'service', entityType: 'trigger', entityId: variables.id, fieldAccessed: `Триггер: ${variables.event_type}`, newValue: variables.is_active ? 'активен' : 'отключён' });
    },
    onError: (err: Error) => {
      toast.error('Ошибка сохранения: ' + err.message);
    },
  });

  /** Quick toggle active state */
  const toggleMutation = useMutation({
    mutationFn: async (params: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('notification_triggers')
        .update({ is_active: params.is_active })
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notification-triggers'] });
      logEventDirect({ action: 'update', category: 'service', entityType: 'trigger', entityId: variables.id, fieldAccessed: 'Переключение триггера', newValue: variables.is_active ? 'активен' : 'отключён' });
    },
    onError: (err: Error) => {
      toast.error('Ошибка: ' + err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notification_triggers')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notification-triggers'] });
      toast.success('Триггер удалён');
      logEventDirect({ action: 'delete', category: 'service', entityType: 'trigger', entityId: variables, fieldAccessed: 'Удаление триггера' });
    },
    onError: (err: Error) => {
      toast.error('Ошибка удаления: ' + err.message);
    },
  });

  return {
    triggers: query.data ?? [],
    isLoading: query.isLoading,
    saveTrigger: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    toggleTrigger: toggleMutation.mutate,
    deleteTrigger: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
