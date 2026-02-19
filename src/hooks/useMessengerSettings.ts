import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { logEventDirect } from '@/hooks/useEventLog';

export type ChannelType = 'whatsapp' | 'whatsapp_web' | 'telegram' | 'max' | 'max_web';
export type ConnectionStatus = 'connected' | 'error' | 'not_configured';

export interface WhatsAppConfig {
  phone: string;
  mode: 'web' | 'business_api';
  api_key?: string;
  [key: string]: unknown;
}

export interface TelegramConfig {
  bot_token: string;
  [key: string]: unknown;
}

export interface MaxConfig {
  api_key: string;
  [key: string]: unknown;
}

export interface MessengerSetting {
  id: string;
  user_id: string;
  channel: ChannelType;
  is_active: boolean;
  status: ConnectionStatus;
  config: WhatsAppConfig | TelegramConfig | MaxConfig | Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function useMessengerSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['messenger-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messenger_settings')
        .select('*')
        .order('channel');

      if (error) throw error;
      return (data ?? []) as unknown as MessengerSetting[];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const upsertMutation = useMutation({
    mutationFn: async (params: {
      channel: ChannelType;
      is_active: boolean;
      status: ConnectionStatus;
      config: Record<string, unknown>;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Check if exists
      const existing = query.data?.find(s => s.channel === params.channel);

      const configJson = params.config as unknown as import('@/integrations/supabase/types').Json;

      if (existing) {
        const { error } = await supabase
          .from('messenger_settings')
          .update({
            is_active: params.is_active,
            status: params.status,
            config: configJson,
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('messenger_settings')
          .insert([{
            user_id: user.id,
            channel: params.channel,
            is_active: params.is_active,
            status: params.status,
            config: configJson,
          }]);
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messenger-settings'] });
      toast.success('Настройки канала сохранены');
      logEventDirect({ action: 'settings_change', category: 'service', entityType: 'messenger', fieldAccessed: `Канал: ${variables.channel}`, newValue: variables.is_active ? 'активен' : 'отключён' });
    },
    onError: (err: Error) => {
      toast.error('Ошибка сохранения: ' + err.message);
    },
  });

  const getChannelSetting = (channel: ChannelType): MessengerSetting | undefined => {
    return query.data?.find(s => s.channel === channel);
  };

  return {
    settings: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    upsertChannel: upsertMutation.mutate,
    isSaving: upsertMutation.isPending,
    getChannelSetting,
  };
}
