import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { logEventDirect } from '@/hooks/useEventLog';

export interface MassBroadcast {
  id: string;
  user_id: string;
  template_id: string | null;
  audience_filter: string;
  audience_params: Record<string, unknown>;
  channel: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useMassBroadcasts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['mass-broadcasts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mass_broadcasts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as MassBroadcast[];
    },
    enabled: !!user,
    staleTime: 10 * 1000,
  });

  const createBroadcast = useMutation({
    mutationFn: async (params: {
      template_id: string;
      audience_filter: string;
      audience_params?: Record<string, unknown>;
      channel: string;
      total_recipients: number;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('mass_broadcasts')
        .insert([{
          user_id: user.id,
          template_id: params.template_id,
          audience_filter: params.audience_filter,
          audience_params: params.audience_params || {},
          channel: params.channel,
          total_recipients: params.total_recipients,
          status: 'in_progress',
          started_at: new Date().toISOString(),
        }] as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as MassBroadcast;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mass-broadcasts'] });
      logEventDirect({ action: 'create', category: 'service', entityType: 'broadcast', entityId: (data as any)?.id, fieldAccessed: 'Массовая рассылка' });
    },
  });

  const updateBroadcast = useMutation({
    mutationFn: async (params: {
      id: string;
      sent_count?: number;
      failed_count?: number;
      status?: string;
      completed_at?: string;
    }) => {
      const { id, ...updates } = params;
      const { error } = await supabase
        .from('mass_broadcasts')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mass-broadcasts'] });
    },
  });

  return {
    broadcasts: query.data ?? [],
    isLoading: query.isLoading,
    createBroadcast: createBroadcast.mutateAsync,
    updateBroadcast: updateBroadcast.mutateAsync,
    refetch: query.refetch,
  };
}
