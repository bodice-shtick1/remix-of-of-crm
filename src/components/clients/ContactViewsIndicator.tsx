import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

export function ContactViewsIndicator() {
  const { userRole, user } = useAuth();
  const isAdmin = userRole === 'admin';

  const { data: config } = useQuery({
    queryKey: ['rate-limit-config'],
    queryFn: async () => {
      const { data } = await supabase
        .from('audit_log_config')
        .select('is_enabled, config_value')
        .eq('rule_type', 'rate_limit')
        .eq('action_type', 'contact_view_limit')
        .maybeSingle();
      return {
        enabled: data ? data.is_enabled : true,
        limit: (data as any)?.config_value ?? 30,
      };
    },
  });

  const { data: viewCount = 0 } = useQuery({
    queryKey: ['contact-views-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('access_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('action', ['view_contact_phone', 'view_contact_email'])
        .gte('created_at', oneHourAgo);
      return count ?? 0;
    },
    enabled: !!user?.id && !isAdmin,
    refetchInterval: 30000,
  });

  // Don't show for admin or if rate limit is disabled
  if (isAdmin || !config?.enabled) return null;

  const limit = config?.limit ?? 30;
  const remaining = Math.max(0, limit - viewCount);
  const isNearLimit = remaining <= 5;
  const isExhausted = remaining === 0;

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
        isExhausted
          ? 'bg-destructive/10 text-destructive border-destructive/20'
          : isNearLimit
          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
          : 'bg-secondary text-secondary-foreground border-border'
      }`}
    >
      <Eye className="h-3 w-3" />
      <span>
        {viewCount} из {limit}
      </span>
    </div>
  );
}
