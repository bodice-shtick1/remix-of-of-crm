import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Mail, Loader2, ArrowRight, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface InboxEmail {
  id: string;
  from_email: string;
  subject: string | null;
  created_at: string | null;
  is_read: boolean | null;
  client_name: string | null;
}

export function EmailDashboardWidget({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-inbox'],
    queryFn: async () => {
      const { data: emails, error } = await supabase
        .from('emails')
        .select('id, from_email, subject, created_at, is_read, clients!emails_client_id_fkey(first_name, last_name)')
        .eq('folder', 'inbox')
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      const mapped = (emails ?? []).map((e: any) => ({
        id: e.id,
        from_email: e.from_email,
        subject: e.subject,
        created_at: e.created_at,
        is_read: e.is_read,
        client_name: e.clients ? `${e.clients.last_name} ${e.clients.first_name}` : null,
      }));

      // Count total unread
      const { count } = await supabase
        .from('emails')
        .select('id', { count: 'exact', head: true })
        .eq('folder', 'inbox')
        .eq('direction', 'inbound')
        .eq('is_read', false);

      return { emails: mapped as InboxEmail[], unreadCount: count ?? 0 };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Realtime subscription for instant updates
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-inbox-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'emails' },
        () => {
          qc.invalidateQueries({ queryKey: ['dashboard-inbox'] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const emails = data?.emails ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  if (isLoading) {
    return (
      <div className={cn("rounded-lg border border-border/50 bg-card p-4", className)}>
        <div className="flex items-center gap-2 text-sm font-semibold mb-3">
          <Mail className="h-4 w-4 text-primary" /> Входящая почта
        </div>
        <div className="flex items-center justify-center h-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className={cn("rounded-lg border border-border/50 bg-card p-4", className)}>
        <div className="flex items-center gap-2 text-sm font-semibold mb-3">
          <Mail className="h-4 w-4 text-primary" /> Входящая почта
        </div>
        <div className="text-center py-4">
          <Mail className="h-8 w-8 mx-auto text-muted-foreground/40 mb-1" />
          <p className="text-xs text-muted-foreground mb-2">У вас нет новых писем</p>
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => navigate('/communication')}>
            <ArrowRight className="h-3 w-3" /> Перейти в почту
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border/50 bg-card overflow-hidden flex flex-col", className)}>
      <div className="sticky top-0 z-10 bg-card px-3 py-2.5 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Mail className="h-4 w-4 text-primary" /> Входящая почта
        </div>
        <div className="flex items-center gap-1.5">
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-[10px] h-5 gap-0.5 px-1.5">
              {unreadCount}
            </Badge>
          )}
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground" onClick={() => navigate('/communication')}>
            Все <ArrowRight className="h-3 w-3 ml-0.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
        <div className="divide-y divide-border">
          {emails.map((email) => (
            <div
              key={email.id}
              onClick={() => navigate(`/communication?tab=email&id=${email.id}`)}
              className={cn(
                'px-3 py-2 cursor-pointer transition-colors hover:bg-muted/30 flex items-center gap-3',
                !email.is_read && 'bg-primary/5'
              )}
            >
              <div className={cn(
                'shrink-0 w-1 h-8 rounded-full',
                !email.is_read ? 'bg-primary' : 'bg-transparent'
              )} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-xs truncate', !email.is_read ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                    {email.from_email}
                  </span>
                  {email.client_name && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1 gap-0.5 shrink-0">
                      <User className="h-2.5 w-2.5" /> Клиент
                    </Badge>
                  )}
                </div>
                <p className={cn('text-[11px] truncate mt-0.5', !email.is_read ? 'text-foreground' : 'text-muted-foreground')}>
                  {email.subject || '(без темы)'}
                </p>
              </div>

              <span className="text-[10px] text-muted-foreground shrink-0">
                {email.created_at ? format(new Date(email.created_at), 'd MMM HH:mm', { locale: ru }) : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
