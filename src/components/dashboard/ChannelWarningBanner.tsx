import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChannelValidation } from '@/hooks/useChannelValidation';
import { AlertTriangle, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/**
 * Shows a warning banner on the dashboard when there are active triggers
 * but no communication channels configured.
 */
export function ChannelWarningBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hasAnyActiveChannel, isLoading: channelsLoading } = useChannelValidation();

  // Check if there are active triggers
  const { data: hasActiveTriggers, isLoading: triggersLoading } = useQuery({
    queryKey: ['active-triggers-exist'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notification_triggers')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  if (channelsLoading || triggersLoading) return null;
  if (!hasActiveTriggers) return null;
  if (hasAnyActiveChannel()) return null;

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 mb-6">
      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          Внимание! Автопилот не может отправлять сообщения, так как каналы связи не настроены.
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
          Настройте хотя бы один канал (WhatsApp, Telegram или Макс) для работы автоматических уведомлений.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/50"
        onClick={() => navigate('/notifications')}
      >
        <Settings className="h-3.5 w-3.5" />
        Настроить
      </Button>
    </div>
  );
}
