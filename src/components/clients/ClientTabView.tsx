import { useEffect, useCallback } from 'react';
import { Client, Policy } from '@/types/crm';
import { User, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientInfoCard } from './ClientInfoCard';
import { ClientActivityFeed } from './ClientActivityFeed';
import { ClientNotesTab } from './ClientNotesTab';
import { ClientDocumentsTab } from './ClientDocumentsTab';
import { ClientInstallmentsTab } from './ClientInstallmentsTab';
import { ClientEmailsTab } from './ClientEmailsTab';
import { mapDbClientToClient, mapDbPolicyToPolicy, getClientDisplayName } from '@/lib/mappers';
import { logEventDirect } from '@/hooks/useEventLog';
import { DocumentArchive } from '@/hooks/useDocumentArchives';
import { printPndConsent } from '@/lib/pndConsentGenerator';
import { useOrganization } from '@/hooks/useOrganization';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';

interface ClientTabViewProps {
  clientId: string;
  clientData?: Client;
  onBack?: () => void;
  onOpenDkpArchive?: (archive: DocumentArchive) => void;
}

export function ClientTabView({ clientId, clientData, onBack, onOpenDkpArchive }: ClientTabViewProps) {
  const { org } = useOrganization();
  const { toast } = useToast();
  const { can } = usePermissions();
  // Fetch fresh client data
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();
      
      if (error) throw error;
      return mapDbClientToClient(data);
    },
    initialData: clientData,
  });

  // Fetch client policies
  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ['client-policies', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('policies')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data.map(mapDbPolicyToPolicy);
    },
  });

  const isLoading = clientLoading || policiesLoading;

  // Log client card open
  useEffect(() => {
    if (client) {
      const clientName = getClientDisplayName(client);
      logEventDirect({
        action: 'open_card',
        category: 'clients',
        entityType: 'client',
        entityId: clientId,
        clientId,
        fieldAccessed: 'card',
        newValue: `Открыта карточка клиента ${clientName}`,
        details: { section: 'Клиенты', client_name: clientName },
      });
    }
    // Only log once per card open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const handleOpenArchive = useCallback((archive: DocumentArchive) => {
    if (archive.type === 'dkp') {
      onOpenDkpArchive?.(archive);
    } else if (archive.type === 'pnd') {
      const data = archive.document_data;
      printPndConsent({
        clientName: data.clientName || '',
        passportSeries: data.passportSeries,
        passportNumber: data.passportNumber,
        passportIssuedBy: data.passportIssuedBy,
        passportIssueDate: data.passportIssueDate,
        address: data.address,
        phone: data.phone,
        organizationName: data.organizationName || org?.name || 'Организация',
        organizationInn: data.organizationInn || org?.inn,
        organizationAddress: data.organizationAddress || org?.address,
        date: data.date || new Date().toISOString().slice(0, 10),
      });
      toast({ title: 'Согласие ПДН открыто для печати' });
    }
  }, [onOpenDkpArchive, org, toast]);

  if (isLoading && !client) {
    return <ClientTabViewSkeleton />;
  }

  if (!client) {
    return (
      <div className="p-6">
        <div className="card-elevated p-12 text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="text-lg font-medium text-foreground mb-1">Клиент не найден</h3>
          <p className="text-muted-foreground">Возможно, клиент был удалён</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header with back button */}
      {onBack && (
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            К списку клиентов
          </Button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Left Column - Client Info Card */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <ClientInfoCard client={client} policies={policies} />
        </div>

        {/* Right Column - Tabs */}
        <div>
          <Tabs defaultValue={can('client_history_view') ? 'activity' : can('client_installments_view') ? 'installments' : can('notes_view') ? 'notes' : can('docs_view') ? 'documents' : 'installments'} className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-4">
              {can('client_history_view') && <TabsTrigger value="activity">История</TabsTrigger>}
              {can('client_installments_view') && <TabsTrigger value="installments">Рассрочки</TabsTrigger>}
              {can('notes_view') && <TabsTrigger value="notes">Заметки</TabsTrigger>}
              {can('docs_view') && <TabsTrigger value="documents">Документы</TabsTrigger>}
              {can('email_view_own') && <TabsTrigger value="emails">Почта</TabsTrigger>}
            </TabsList>
            
            {can('client_history_view') && (
              <TabsContent value="activity" className="mt-0">
                <ClientActivityFeed clientId={clientId} />
              </TabsContent>
            )}

            {can('client_installments_view') && (
              <TabsContent value="installments" className="mt-0">
                <ClientInstallmentsTab clientId={clientId} />
              </TabsContent>
            )}
            
            {can('notes_view') && (
              <TabsContent value="notes" className="mt-0">
                <ClientNotesTab clientId={clientId} />
              </TabsContent>
            )}
            
            {can('docs_view') && (
              <TabsContent value="documents" className="mt-0">
                <ClientDocumentsTab clientId={clientId} onOpenArchive={handleOpenArchive} />
              </TabsContent>
            )}

            {can('email_view_own') && (
              <TabsContent value="emails" className="mt-0">
                <ClientEmailsTab clientId={clientId} clientEmail={client.email} clientName={`${client.lastName} ${client.firstName}`} />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function ClientTabViewSkeleton() {
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Left Column Skeleton */}
        <div className="space-y-4">
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-4 mb-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
          <div className="bg-card rounded-lg border p-4 space-y-3">
            <Skeleton className="h-4 w-20" />
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
