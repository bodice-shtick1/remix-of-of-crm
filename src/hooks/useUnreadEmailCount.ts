import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useUnreadEmailCount() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: ['unread-email-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('emails')
        .select('id', { count: 'exact', head: true })
        .eq('folder', 'inbox')
        .eq('direction', 'inbound')
        .eq('is_read', false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Realtime updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('unread-email-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emails' }, () => {
        qc.invalidateQueries({ queryKey: ['unread-email-count'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  return count;
}
