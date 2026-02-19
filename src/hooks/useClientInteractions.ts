import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { logEventDirect } from '@/hooks/useEventLog';

export interface ClientInteraction {
  id: string;
  client_id: string;
  content: string;
  reminder_date: string | null;
  is_completed: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  creator_email?: string;
  creator_name?: string;
}

export interface ClientInteractionWithClient extends ClientInteraction {
  client?: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    is_company: boolean;
    company_name: string | null;
  };
}

export function useClientInteractions(clientId?: string) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [interactions, setInteractions] = useState<ClientInteraction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadInteractions = useCallback(async () => {
    if (!clientId) {
      setInteractions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Simple query without join to avoid foreign key issues
      const { data, error } = await supabase
        .from('client_interactions')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase Error fetching notes:', error.message, error);
        throw error;
      }

      const mappedData: ClientInteraction[] = (data || []).map((item: any) => ({
        id: item.id,
        client_id: item.client_id,
        content: item.content,
        reminder_date: item.reminder_date,
        is_completed: item.is_completed,
        created_by: item.created_by,
        created_at: item.created_at,
        updated_at: item.updated_at,
        creator_name: null, // Will be fetched separately if needed
      }));

      setInteractions(mappedData);
    } catch (error: any) {
      console.error('Error loading interactions:', error);
      toast({
        title: 'Ошибка загрузки',
        description: error?.message || 'Не удалось загрузить заметки',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [clientId, toast]);

  useEffect(() => {
    loadInteractions();
  }, [loadInteractions]);

  const createInteraction = async (data: {
    content: string;
    reminder_date?: string | null;
  }) => {
    if (!clientId || !user) return null;

    try {
      const { data: newInteraction, error } = await supabase
        .from('client_interactions')
        .insert({
          client_id: clientId,
          content: data.content,
          reminder_date: data.reminder_date || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase Error creating note:', error.message, error);
        throw error;
      }

      toast({ title: 'Заметка добавлена' });
      logEventDirect({ action: 'create', category: 'clients', entityType: 'note', entityId: newInteraction.id, clientId: clientId, fieldAccessed: 'Новая заметка' });
      loadInteractions();
      return newInteraction;
    } catch (error: any) {
      console.error('Error creating interaction:', error);
      toast({
        title: 'Ошибка',
        description: error?.message || 'Не удалось добавить заметку',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateInteraction = async (id: string, updates: Partial<ClientInteraction>) => {
    try {
      const { error } = await supabase
        .from('client_interactions')
        .update(updates)
        .eq('id', id);

      if (error) {
        console.error('Supabase Error updating note:', error.message, error);
        throw error;
      }

      toast({ title: 'Заметка обновлена' });
      logEventDirect({ action: 'update', category: 'clients', entityType: 'note', entityId: id, clientId: clientId, fieldAccessed: 'Редактирование заметки' });
      loadInteractions();
      return true;
    } catch (error: any) {
      console.error('Error updating interaction:', error);
      toast({
        title: 'Ошибка',
        description: error?.message || 'Не удалось обновить заметку',
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteInteraction = async (id: string) => {
    try {
      const { error } = await supabase
        .from('client_interactions')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase Error deleting note:', error.message, error);
        throw error;
      }

      toast({ title: 'Заметка удалена' });
      logEventDirect({ action: 'delete', category: 'clients', entityType: 'note', entityId: id, clientId: clientId, fieldAccessed: 'Удаление заметки' });
      loadInteractions();
      return true;
    } catch (error: any) {
      console.error('Error deleting interaction:', error);
      toast({
        title: 'Ошибка',
        description: error?.message || 'Не удалось удалить заметку',
        variant: 'destructive',
      });
      return false;
    }
  };

  const markAsCompleted = async (id: string) => {
    return updateInteraction(id, { is_completed: true });
  };

  return {
    interactions,
    isLoading,
    createInteraction,
    updateInteraction,
    deleteInteraction,
    markAsCompleted,
    refresh: loadInteractions,
  };
}

// Hook for fetching upcoming reminders across all clients (for Dashboard)
export function useUpcomingReminders() {
  const { toast } = useToast();
  const [reminders, setReminders] = useState<ClientInteractionWithClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadReminders = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString();

      const { data, error } = await supabase
        .from('client_interactions')
        .select(`
          *,
          clients (
            id,
            first_name,
            last_name,
            phone,
            is_company,
            company_name
          )
        `)
        .eq('is_completed', false)
        .not('reminder_date', 'is', null)
        .lte('reminder_date', today)
        .order('reminder_date', { ascending: true })
        .limit(20);

      if (error) {
        console.error('Supabase Error fetching reminders:', error.message, error);
        throw error;
      }

      const mappedData: ClientInteractionWithClient[] = (data || []).map((item: any) => ({
        id: item.id,
        client_id: item.client_id,
        content: item.content,
        reminder_date: item.reminder_date,
        is_completed: item.is_completed,
        created_by: item.created_by,
        created_at: item.created_at,
        updated_at: item.updated_at,
        client: item.clients,
      }));

      setReminders(mappedData);
    } catch (error: any) {
      console.error('Error loading reminders:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const markAsCompleted = async (id: string) => {
    try {
      const { error } = await supabase
        .from('client_interactions')
        .update({ is_completed: true })
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Задача выполнена' });
      loadReminders();
      return true;
    } catch (error: any) {
      console.error('Error completing reminder:', error);
      toast({
        title: 'Ошибка',
        description: error?.message || 'Не удалось отметить задачу',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    reminders,
    isLoading,
    markAsCompleted,
    refresh: loadReminders,
  };
}
