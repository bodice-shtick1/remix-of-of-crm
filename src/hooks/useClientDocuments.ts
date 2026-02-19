import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { logEventDirect } from '@/hooks/useEventLog';

export interface ClientDocument {
  id: string;
  client_id: string;
  sale_id: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  document_type: 'file' | 'debt_receipt' | 'sale_receipt';
  metadata: Record<string, any> | null;
  debt_payment_id: string | null;
}

export function useClientDocuments(clientId: string) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const loadDocuments = useCallback(async () => {
    if (!clientId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_documents')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading documents:', error.message);
        throw error;
      }

      setDocuments((data || []) as ClientDocument[]);
    } catch (error: any) {
      console.error('Error loading documents:', error);
      toast({
        title: 'Ошибка загрузки',
        description: error?.message || 'Не удалось загрузить документы',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [clientId, toast]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const uploadDocument = async (file: File, saleId?: string): Promise<ClientDocument | null> => {
    if (!user) {
      toast({
        title: 'Ошибка',
        description: 'Необходимо авторизоваться',
        variant: 'destructive',
      });
      return null;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Ошибка',
        description: 'Размер файла не должен превышать 10МБ',
        variant: 'destructive',
      });
      return null;
    }

    setIsUploading(true);
    try {
      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${clientId}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('client-documents')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Ошибка загрузки файла: ${uploadError.message}`);
      }

      // Save document metadata
      const { data, error: insertError } = await supabase
        .from('client_documents')
        .insert({
          client_id: clientId,
          sale_id: saleId || null,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: user.id,
          document_type: 'file',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Database insert error:', insertError);
        // Try to clean up uploaded file
        await supabase.storage.from('client-documents').remove([filePath]);
        throw new Error(`Ошибка сохранения записи: ${insertError.message}`);
      }

      toast({ title: 'Документ загружен' });
      logEventDirect({ action: 'create', category: 'clients', entityType: 'document', entityId: (data as any).id, clientId: clientId, fieldAccessed: `Загрузка документа: ${file.name}` });
      loadDocuments();
      return data as ClientDocument;
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast({
        title: 'Ошибка загрузки',
        description: error?.message || 'Не удалось загрузить документ',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const deleteDocument = async (document: ClientDocument): Promise<boolean> => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('client-documents')
        .remove([document.file_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Continue to delete metadata even if storage fails
      }

      // Delete metadata
      const { error: dbError } = await supabase
        .from('client_documents')
        .delete()
        .eq('id', document.id);

      if (dbError) {
        console.error('Database delete error:', dbError);
        throw new Error(`Ошибка удаления записи: ${dbError.message}`);
      }

      toast({ title: 'Документ удалён' });
      logEventDirect({ action: 'delete', category: 'clients', entityType: 'document', entityId: document.id, clientId: clientId, fieldAccessed: `Удаление документа: ${document.file_name}` });
      loadDocuments();
      return true;
    } catch (error: any) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Ошибка удаления',
        description: error?.message || 'Не удалось удалить документ',
        variant: 'destructive',
      });
      return false;
    }
  };

  const getDocumentUrl = async (filePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('client-documents')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) {
        console.error('Error creating signed URL:', error);
        throw error;
      }

      return data.signedUrl;
    } catch (error: any) {
      console.error('Error getting document URL:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось получить ссылку на документ',
        variant: 'destructive',
      });
      return null;
    }
  };

  const getDocumentsForSale = (saleId: string) => {
    return documents.filter(doc => doc.sale_id === saleId);
  };

  return {
    documents,
    isLoading,
    isUploading,
    uploadDocument,
    deleteDocument,
    getDocumentUrl,
    getDocumentsForSale,
    refresh: loadDocuments,
  };
}
