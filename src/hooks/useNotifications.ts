import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface NotificationTemplate {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string | null;
  message_template: string;
  channel: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationLog {
  id: string;
  user_id: string;
  client_id: string;
  template_id: string | null;
  channel: string;
  message: string;
  template_title: string | null;
  status: string;
  read_at: string | null;
  error_message: string | null;
  broadcast_id: string | null;
  source: string | null;
  sent_at: string;
  created_at: string;
  client?: {
    first_name: string;
    last_name: string;
    middle_name: string | null;
    phone?: string;
  } | null;
}

export function useNotificationTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notification-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_templates')
        .select('*')
        .order('created_at');

      if (error) throw error;
      return (data ?? []) as unknown as NotificationTemplate[];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  /** Upsert: INSERT if no id, UPDATE if id provided */
  const saveMutation = useMutation({
    mutationFn: async (params: {
      id?: string;
      title: string;
      slug: string;
      message_template: string;
      channel: string;
      description: string;
      is_active: boolean;
    }) => {
      if (!user) throw new Error('Not authenticated');

      if (params.id) {
        // UPDATE existing
        const { id, slug, ...updates } = params;
        const { error } = await supabase
          .from('notification_templates')
          .update(updates)
          .eq('id', id);
        if (error) throw error;
      } else {
        // INSERT new
        const { id, ...insertData } = params;
        const { error } = await supabase
          .from('notification_templates')
          .insert([{ ...insertData, user_id: user.id }] as any);
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
      toast.success(variables.id ? 'Шаблон сохранён' : 'Шаблон создан');
    },
    onError: (err: Error) => {
      toast.error('Ошибка сохранения: ' + err.message);
    },
  });

  /** Copy a template with "(копия)" suffix */
  const copyMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (!user) throw new Error('Not authenticated');
      const original = query.data?.find(t => t.id === templateId);
      if (!original) throw new Error('Template not found');

      const { error } = await supabase
        .from('notification_templates')
        .insert([{
          user_id: user.id,
          slug: `copy_${Date.now()}`,
          title: `${original.title} (копия)`,
          description: original.description,
          message_template: original.message_template,
          channel: original.channel,
          is_active: false,
        }] as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
      toast.success('Шаблон скопирован');
    },
    onError: (err: Error) => {
      toast.error('Ошибка копирования: ' + err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notification_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
      toast.success('Шаблон удалён');
    },
    onError: (err: Error) => {
      toast.error('Ошибка удаления: ' + err.message);
    },
  });

  return {
    templates: query.data ?? [],
    isLoading: query.isLoading,
    saveTemplate: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    copyTemplate: copyMutation.mutate,
    isCopying: copyMutation.isPending,
    deleteTemplate: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}

export function useNotificationLogs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notification-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_logs')
        .select('*, client:clients(first_name, last_name, middle_name, phone)')
        .order('sent_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      return (data ?? []) as unknown as NotificationLog[];
    },
    enabled: !!user,
    staleTime: 30 * 1000,
  });

  const createLog = useMutation({
    mutationFn: async (params: {
      client_id: string;
      template_id?: string;
      channel: string;
      message: string;
      template_title?: string;
      status?: string;
      broadcast_id?: string;
      source?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('notification_logs')
        .insert([{
          user_id: user.id,
          client_id: params.client_id,
          template_id: params.template_id || null,
          channel: params.channel,
          message: params.message,
          template_title: params.template_title || null,
          status: params.status || 'sent',
          broadcast_id: params.broadcast_id || null,
          source: params.source || 'manual',
        }] as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-logs'] });
    },
  });

  const checkReadStatus = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('check-read-status');
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['notification-logs'] });
      if (data?.updated > 0) {
        toast.success(`Обновлено статусов: ${data.updated}`);
      } else {
        toast.info('Новых прочтений не найдено');
      }
    },
    onError: (err: Error) => {
      toast.error('Ошибка проверки: ' + err.message);
    },
  });

  return {
    logs: query.data ?? [],
    isLoading: query.isLoading,
    createLog: createLog.mutateAsync,
    checkReadStatus: checkReadStatus.mutate,
    isCheckingReadStatus: checkReadStatus.isPending,
  };
}
