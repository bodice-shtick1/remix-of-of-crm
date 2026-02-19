import { useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  FileText, Upload, FolderOpen, Trash2, Eye, 
  Loader2, File, FileImage, FileSpreadsheet, Printer, Receipt, Banknote, CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Badge } from '@/components/ui/badge';
import { useClientDocuments, ClientDocument } from '@/hooks/useClientDocuments';
import { printDebtReceipt, DebtReceiptData } from '@/lib/printDebtReceipt';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DocumentArchivesList } from './DocumentArchivesList';
import { usePermissions } from '@/hooks/usePermissions';
import { DocumentArchive } from '@/hooks/useDocumentArchives';

interface ClientDocumentsTabProps {
  clientId: string;
  onOpenArchive?: (archive: DocumentArchive) => void;
}

function getFileIcon(doc: ClientDocument) {
  // For receipts, show a special icon
  if (doc.document_type === 'debt_receipt') {
    return <Receipt className="h-5 w-5 text-success" />;
  }
  
  const mimeType = doc.mime_type;
  if (!mimeType) return <File className="h-5 w-5" />;
  
  if (mimeType.startsWith('image/')) {
    return <FileImage className="h-5 w-5 text-primary" />;
  }
  if (mimeType === 'application/pdf') {
    return <FileText className="h-5 w-5 text-destructive" />;
  }
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return <FileSpreadsheet className="h-5 w-5 text-success" />;
  }
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ClientDocumentsTab({ clientId, onOpenArchive }: ClientDocumentsTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, userRole } = useAuth();
  const { can } = usePermissions();
  const isAdmin = userRole === 'admin';
  const { 
    documents, 
    isLoading, 
    isUploading, 
    uploadDocument, 
    deleteDocument, 
    getDocumentUrl 
  } = useClientDocuments(clientId);
  const [viewingDoc, setViewingDoc] = useState<string | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
  const [reprintingDoc, setReprintingDoc] = useState<string | null>(null);

  // Get client data for receipts
  const { data: client } = useQuery({
    queryKey: ['client-for-receipts', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('first_name, last_name, middle_name, company_name, is_company, phone')
        .eq('id', clientId)
        .single();
      return data;
    },
    enabled: !!clientId,
  });

  // Get user profile for manager name
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile-docs', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const getClientName = () => {
    if (!client) return '—';
    if (client.is_company) return client.company_name || '—';
    return [client.last_name, client.first_name, client.middle_name].filter(Boolean).join(' ');
  };

  const getManagerName = () => {
    if (userProfile?.full_name) return userProfile.full_name;
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    return 'Менеджер';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadDocument(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleView = async (doc: ClientDocument) => {
    // For receipts, just reprint
    if (doc.document_type === 'debt_receipt') {
      handleReprintReceipt(doc);
      return;
    }
    
    setViewingDoc(doc.id);
    try {
      const url = await getDocumentUrl(doc.file_path);
      if (url) {
        window.open(url, '_blank');
      }
    } finally {
      setViewingDoc(null);
    }
  };

  const handleReprintReceipt = (doc: ClientDocument) => {
    setReprintingDoc(doc.id);
    try {
      const metadata = doc.metadata as any || {};
      const receiptData: DebtReceiptData = {
        clientName: getClientName(),
        clientPhone: client?.phone || undefined,
        saleUid: metadata.saleUid || '—',
        productName: 'Погашение задолженности',
        amount: metadata.amount || 0,
        paymentMethod: metadata.paymentMethod || 'cash',
        paidAt: new Date(doc.created_at),
        managerName: getManagerName(),
        remainingDebt: metadata.remainingDebt || 0,
        originalDebt: metadata.originalDebt || 0,
      };
      printDebtReceipt(receiptData);
    } finally {
      setReprintingDoc(null);
    }
  };

  const handleDelete = async (doc: ClientDocument) => {
    // Don't allow deleting receipts
    if (doc.document_type === 'debt_receipt') {
      return;
    }
    
    if (!confirm(`Удалить документ "${doc.file_name}"?`)) return;
    
    setDeletingDoc(doc.id);
    try {
      await deleteDocument(doc);
    } finally {
      setDeletingDoc(null);
    }
  };

  // Separate documents by type
  const regularDocs = documents.filter(d => d.document_type === 'file');
  const receiptDocs = documents.filter(d => d.document_type === 'debt_receipt');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Document Archives Section */}
      <DocumentArchivesList clientId={clientId} onOpenArchive={onOpenArchive} />

      {/* Receipts Section */}
      {receiptDocs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-success" />
              Квитанции о погашении ({receiptDocs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[250px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              <div className="space-y-2">
                {receiptDocs.map((doc) => {
                  const metadata = doc.metadata as any || {};
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-success/5"
                    >
                      <div className="p-2 rounded-lg bg-success/10">
                        {metadata.paymentMethod === 'cash' ? (
                          <Banknote className="h-5 w-5 text-success" />
                        ) : (
                          <CreditCard className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-foreground truncate">
                            {doc.file_name}
                          </p>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {metadata.paymentMethod === 'cash' ? 'Нал' : 'Безнал'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>
                            {format(parseISO(doc.created_at), 'd MMM yyyy, HH:mm', { locale: ru })}
                          </span>
                          {metadata.remainingDebt > 0 ? (
                            <span className="text-warning">
                              Остаток: {metadata.remainingDebt.toLocaleString('ru-RU')} ₽
                            </span>
                          ) : (
                            <span className="text-success">Долг погашен</span>
                          )}
                        </div>
                      </div>
                      
                      {can('docs_archive_print') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 shrink-0"
                          onClick={() => handleReprintReceipt(doc)}
                          disabled={reprintingDoc === doc.id}
                        >
                          {reprintingDoc === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Printer className="h-4 w-4" />
                          )}
                          Печать
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Regular Documents Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Документы ({regularDocs.length})
            </CardTitle>
            {can('docs_upload') && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Загрузить
              </Button>
            </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {regularDocs.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-medium text-foreground mb-1">Нет документов</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Загрузите документы клиента для хранения
              </p>
              {can('docs_upload') && (
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Загрузить первый документ
              </Button>
              )}
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              <div className="space-y-2">
                {regularDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors bg-card"
                  >
                    <div className="p-2 rounded-lg bg-muted">
                      {getFileIcon(doc)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {doc.file_name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatFileSize(doc.file_size)}</span>
                        <span>•</span>
                        <span>
                          {format(parseISO(doc.created_at), 'd MMM yyyy, HH:mm', { locale: ru })}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleView(doc)}
                        disabled={viewingDoc === doc.id}
                      >
                        {viewingDoc === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      {can('docs_archive_delete') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(doc)}
                          disabled={deletingDoc === doc.id}
                        >
                          {deletingDoc === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
