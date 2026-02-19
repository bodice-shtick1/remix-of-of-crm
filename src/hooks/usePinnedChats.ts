import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function usePinnedChats() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: pinnedIds = [], isLoading } = useQuery({
    queryKey: ['pinned-conversations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await (supabase
        .from('pinned_conversations' as any)
        .select('client_id')
        .eq('user_id', user.id)
        .order('pinned_at', { ascending: true }) as any);
      if (error) throw error;
      return (data || []).map((r: any) => r.client_id as string);
    },
    enabled: !!user,
  });

  const pinMutation = useMutation({
    mutationFn: async (clientId: string) => {
      if (!user) throw new Error('Not authenticated');
      await (supabase
        .from('pinned_conversations' as any)
        .insert([{ user_id: user.id, client_id: clientId }]) as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinned-conversations'] });
    },
    onError: () => toast.error('Не удалось закрепить чат'),
  });

  const unpinMutation = useMutation({
    mutationFn: async (clientId: string) => {
      if (!user) throw new Error('Not authenticated');
      await (supabase
        .from('pinned_conversations' as any)
        .delete()
        .eq('user_id', user.id)
        .eq('client_id', clientId) as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinned-conversations'] });
    },
    onError: () => toast.error('Не удалось открепить чат'),
  });

  const isPinned = (clientId: string) => pinnedIds.includes(clientId);
  const togglePin = (clientId: string) => {
    if (isPinned(clientId)) {
      unpinMutation.mutate(clientId);
    } else {
      pinMutation.mutate(clientId);
    }
  };

  return { pinnedIds, isPinned, togglePin, isLoading };
}
