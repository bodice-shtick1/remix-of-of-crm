import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface EmailAccount {
  id: string;
  user_id: string | null;
  email_address: string;
  display_name: string | null;
  smtp_host: string;
  smtp_port: number;
  imap_host: string;
  imap_port: number;
  username: string;
  password_encrypted: string;
  is_org_account: boolean;
  is_active: boolean;
  use_ssl: boolean;
  last_sync_at: string | null;
  signature: string | null;
  created_at: string;
  updated_at: string;
}

export type EmailAccountInput = Omit<EmailAccount, 'id' | 'created_at' | 'updated_at' | 'last_sync_at'>;

export function useEmailAccounts() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['email-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_accounts')
        .select('*')
        .order('is_org_account', { ascending: false })
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as EmailAccount[];
    },
    enabled: !!user,
  });

  const createAccount = useMutation({
    mutationFn: async (input: EmailAccountInput) => {
      const { error } = await supabase.from('email_accounts').insert(input as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-accounts'] });
      toast.success('Почтовый аккаунт добавлен');
    },
    onError: (e: Error) => toast.error(`Ошибка: ${e.message}`),
  });

  const updateAccount = useMutation({
    mutationFn: async ({ id, ...input }: Partial<EmailAccount> & { id: string }) => {
      const { error } = await supabase.from('email_accounts').update(input as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-accounts'] });
      toast.success('Аккаунт обновлён');
    },
    onError: (e: Error) => toast.error(`Ошибка: ${e.message}`),
  });

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('email_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-accounts'] });
      toast.success('Аккаунт удалён');
    },
    onError: (e: Error) => toast.error(`Ошибка: ${e.message}`),
  });

  return { accounts, isLoading, createAccount, updateAccount, deleteAccount };
}
