import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { logEventDirect } from '@/hooks/useEventLog';

export interface DocumentArchive {
  id: string;
  client_id: string;
  type: 'dkp' | 'pnd' | 'receipt' | 'europrotocol' | 'cash_receipt' | 'sales_receipt';
  document_data: Record<string, any>;
  created_at: string;
  created_by: string | null;
  creator_name?: string;
}

export function useDocumentArchives(clientId: string) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [archives, setArchives] = useState<DocumentArchive[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadArchives = useCallback(async () => {
    if (!clientId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_archives')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch creator names
      const creatorIds = [...new Set((data || []).map(d => d.created_by).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', creatorIds);
        if (profiles) {
          profiles.forEach(p => { profilesMap[p.user_id] = p.full_name || 'Менеджер'; });
        }
      }

      setArchives((data || []).map(d => ({
        ...d,
        type: d.type as DocumentArchive['type'],
        document_data: (d.document_data || {}) as Record<string, any>,
        creator_name: d.created_by ? (profilesMap[d.created_by] || 'Менеджер') : undefined,
      })));
    } catch (error: any) {
      console.error('Error loading archives:', error);
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => { loadArchives(); }, [loadArchives]);

  const deleteArchive = async (archiveId: string) => {
    try {
      const { error } = await supabase
        .from('document_archives')
        .delete()
        .eq('id', archiveId);
      if (error) throw error;
      toast({ title: 'Документ удалён из архива' });
      logEventDirect({
        action: 'delete', category: 'clients', entityType: 'document_archive',
        entityId: archiveId, clientId,
      });
      loadArchives();
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error?.message, variant: 'destructive' });
    }
  };

  return { archives, isLoading, deleteArchive, refresh: loadArchives };
}

/**
 * Save a document snapshot to archives
 */
export async function saveDocumentArchive(params: {
  clientId: string;
  type: DocumentArchive['type'];
  documentData: Record<string, any>;
  userId?: string;
}): Promise<void> {
  try {
    const { error } = await supabase.from('document_archives').insert({
      client_id: params.clientId,
      type: params.type,
      document_data: params.documentData,
      created_by: params.userId || null,
    } as any);
    if (error) throw error;
  } catch (err) {
    console.error('Error saving document archive:', err);
  }
}
