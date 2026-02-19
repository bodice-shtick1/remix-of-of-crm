import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Email {
  id: string;
  from_email: string;
  to_email: string;
  subject: string | null;
  body_html: string | null;
  client_id: string | null;
  company_id: string | null;
  user_id: string | null;
  email_account_id: string | null;
  direction: string | null;
  folder: string;
  is_read: boolean | null;
  cc: string | null;
  bcc: string | null;
  external_uid: string | null;
  attachments: any[];
  reply_to_id: string | null;
  created_at: string | null;
  opened_at: string | null;
  open_count: number;
  // Joined
  client_name?: string;
  company_name?: string;
}

export function useEmails(folder: string = 'inbox', accountId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ['emails', folder, accountId],
    queryFn: async () => {
      let query = supabase
        .from('emails')
        .select('*, clients!emails_client_id_fkey(first_name, last_name), insurance_companies!emails_company_id_fkey(name)')
        .eq('folder', folder)
        .order('created_at', { ascending: false })
        .limit(200);

      if (accountId) {
        query = query.eq('email_account_id', accountId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((e: any) => ({
        ...e,
        client_name: e.clients ? `${e.clients.last_name} ${e.clients.first_name}` : null,
        company_name: e.insurance_companies?.name ?? null,
        attachments: e.attachments ?? [],
      })) as Email[];
    },
    enabled: !!user,
  });

  // Realtime: listen for tracking updates (opened_at, open_count)
  useEffect(() => {
    const channel = supabase
      .channel('email-tracking')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'emails' },
        () => {
          qc.invalidateQueries({ queryKey: ['emails'] });
          qc.invalidateQueries({ queryKey: ['client-emails'] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const markRead = useMutation({
    mutationFn: async (emailId: string) => {
      await supabase.from('emails').update({ is_read: true } as any).eq('id', emailId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emails'] }),
  });

  const deleteEmail = useMutation({
    mutationFn: async (emailId: string) => {
      await supabase.from('emails').update({ folder: 'trash' } as any).eq('id', emailId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emails'] });
      qc.invalidateQueries({ queryKey: ['client-emails'] });
      toast.success('Письмо удалено');
    },
    onError: (e: Error) => toast.error(`Ошибка: ${e.message}`),
  });

  const sendEmail = useMutation({
    mutationFn: async (body: {
      account_id: string;
      to: string;
      subject: string;
      html: string;
      cc?: string;
      bcc?: string;
      attachments?: { name: string; path: string }[];
    }) => {
      const { data, error } = await supabase.functions.invoke('send-email', { body });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Ошибка отправки');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emails'] });
      qc.invalidateQueries({ queryKey: ['client-emails'] });
      toast.success('Письмо отправлено');
    },
    onError: (e: Error) => toast.error(`Ошибка: ${e.message}`),
  });

  const syncEmails = useMutation({
    mutationFn: async (params: string | { accountId: string; silent?: boolean; full_sync?: boolean }) => {
      const accountId = typeof params === 'string' ? params : params.accountId;
      const silent = typeof params === 'string' ? false : params.silent ?? false;
      const fullSync = typeof params === 'string' ? false : params.full_sync ?? false;

      const { data, error } = await supabase.functions.invoke('email-sync', {
        body: { account_id: accountId, silent, full_sync: fullSync },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Ошибка синхронизации');
      return { ...data, _silent: silent };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['emails'] });
      qc.invalidateQueries({ queryKey: ['client-emails'] });
      qc.invalidateQueries({ queryKey: ['email-accounts'] });

      // Only show toast for manual sync (not silent background)
      if (!data._silent) {
        const folders = data.synced_folders?.join(', ') || '';
        toast.success(`Синхронизация завершена: ${data.fetched ?? 0} новых писем${folders ? ` (папки: ${folders})` : ''}`);
      }

      if (data.fetched === 0 && data.folders) {
        console.log('IMAP folders:', JSON.stringify(data.folders));
        console.log('Synced folders:', data.synced_folders);
      }
    },
    onError: (e: Error) => {
      // Only show toast for non-silent errors
      toast.error(`Ошибка синхронизации: ${e.message}`);
    },
  });

  return { emails, isLoading, markRead, sendEmail, syncEmails, deleteEmail };
}

export function useClientEmails(clientId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['client-emails', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('emails')
        .select('*')
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Email[];
    },
    enabled: !!user && !!clientId,
  });
}
