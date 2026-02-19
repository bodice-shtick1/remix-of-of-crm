import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SearchInput } from '@/components/ui/search-input';
import { ClientsTable } from '@/components/clients/ClientsTable';
import { ClientTabView } from '@/components/clients/ClientTabView';
import { AddClientDialog } from '@/components/clients/AddClientDialog';
import { ImportClientsDialog } from '@/components/clients/ImportClientsDialog';
import { ContactViewsIndicator } from '@/components/clients/ContactViewsIndicator';
import { ServerPagination } from '@/components/common/ServerPagination';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Building2, Download, Loader2, ShieldAlert } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Client, Policy } from '@/types/crm';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { mapDbClientToClient, mapDbPolicyToPolicy } from '@/lib/mappers';
import { usePermissions } from '@/hooks/usePermissions';

export default function Clients() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'individual' | 'company' | 'pnd_unsigned'>(() => {
    return (searchParams.get('filter') as any) || 'all';
  });
  const tableRef = useRef<HTMLDivElement>(null);

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const selectedClientId = searchParams.get('id');

  // Reset page on filter/search change
  useEffect(() => { setPage(0); }, [search, filter]);

  const handleClientCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    queryClient.invalidateQueries({ queryKey: ['clients-raw'] });
  };

  const handleClientSelect = (client: Client) => { setSearchParams({ id: client.id }); };
  const handleBackToList = () => { setSearchParams({}); };
  const handleNewSale = (client: Client) => { navigate(`/sales?clientId=${client.id}`); };
  const handleOpenChat = (client: Client) => { navigate(`/communication?clientId=${client.id}`); };

  // Fetch clients from Supabase
  const { data: clientsRaw = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const clients = useMemo(() => clientsRaw.map(mapDbClientToClient), [clientsRaw]);

  // Fetch policies from Supabase
  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ['policies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('policies').select('*');
      if (error) throw error;
      return data.map(mapDbPolicyToPolicy);
    },
  });

  const isLoading = clientsLoading || policiesLoading;

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      if (filter === 'individual' && client.isCompany) return false;
      if (filter === 'company' && !client.isCompany) return false;
      if (filter === 'pnd_unsigned') {
        const raw = clientsRaw.find(r => r.id === client.id);
        if (!raw || raw.is_pnd_signed) return false;
      }
      if (!search || search.length < 3) return true;
      
      const searchLower = search.toLowerCase().trim();
      const fullName = `${client.lastName} ${client.firstName} ${client.middleName || ''}`.toLowerCase().trim();
      const companyName = client.companyName?.toLowerCase() || '';
      const clientPhone = client.phone.replace(/\D/g, '');
      const searchPhone = search.replace(/\D/g, '');
      const clientPolicies = policies.filter(p => p.clientId === client.id);
      const vehicleMatch = clientPolicies.some(p => p.vehicleNumber?.toLowerCase().includes(searchLower));
      const nameMatch = fullName.includes(searchLower);
      const companyMatch = companyName.includes(searchLower);
      const phoneMatch = searchPhone.length >= 3 && clientPhone.includes(searchPhone);
      const emailMatch = client.email?.toLowerCase().includes(searchLower);

      return nameMatch || companyMatch || phoneMatch || emailMatch || vehicleMatch;
    });
  }, [search, filter, clients, clientsRaw, policies]);

  // Client-side pagination of filtered results
  const totalCount = filteredClients.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const paginatedClients = useMemo(() => {
    const from = page * pageSize;
    return filteredClients.slice(from, from + pageSize);
  }, [filteredClients, page, pageSize]);

  const stats = useMemo(() => {
    const pndUnsigned = clientsRaw.filter(c => !c.is_pnd_signed && !c.is_archived).length;
    return {
      total: clients.length,
      individual: clients.filter(c => !c.isCompany).length,
      company: clients.filter(c => c.isCompany).length,
      pndUnsigned,
    };
  }, [clients, clientsRaw]);

  const handleExport = () => {
    if (filteredClients.length === 0) return;
    const rows = filteredClients.map(c => ({
      'Фамилия': c.lastName, 'Имя': c.firstName, 'Отчество': c.middleName || '',
      'Компания': c.companyName || '', 'Тип': c.isCompany ? 'Юр. лицо' : 'Физ. лицо',
      'Телефон': c.phone, 'Email': c.email || '', 'Дата рождения': c.birthDate || '',
      'ИНН': c.inn || '', 'Адрес': c.address || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Клиенты');
    XLSX.writeFile(wb, 'clients_export.xlsx');
  };

  const handlePageChange = useCallback((p: number) => {
    setPage(p);
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(0);
  }, []);

  if (selectedClientId) {
    const selectedClient = clients.find(c => c.id === selectedClientId);
    return (
      <ClientTabView 
        clientId={selectedClientId} clientData={selectedClient} onBack={handleBackToList}
      />
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]" ref={tableRef}>
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b bg-background">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Клиенты</h1>
            <p className="text-sm text-muted-foreground mt-1">База клиентов и договоров</p>
          </div>
          {(can('clients_import') || can('clients_export') || can('clients_create')) && (
            <div className="flex items-center gap-2">
              {can('clients_import') && <ImportClientsDialog onImportComplete={handleClientCreated} />}
              {can('clients_export') && (
                <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={handleExport} disabled={filteredClients.length === 0}>
                  <Download className="h-3.5 w-3.5" />Экспорт
                </Button>
              )}
              {can('clients_create') && <AddClientDialog onClientCreated={handleClientCreated} />}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-3">
          <SearchInput 
            value={search} onChange={setSearch} 
            placeholder="Поиск по ФИО, телефону, номеру авто... (мин. 3 символа)"
            className="flex-1 max-w-lg h-8"
          />
          <ContactViewsIndicator />
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >Все ({stats.total})</button>
            <button
              onClick={() => setFilter('individual')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                filter === 'individual' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            ><Users className="h-3.5 w-3.5" />Физ. лица ({stats.individual})</button>
            <button
              onClick={() => setFilter('company')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                filter === 'company' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            ><Building2 className="h-3.5 w-3.5" />Юр. лица ({stats.company})</button>
            {stats.pndUnsigned > 0 && (
              <button
                onClick={() => setFilter('pnd_unsigned')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  filter === 'pnd_unsigned' ? 'bg-destructive text-destructive-foreground' : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                }`}
              ><ShieldAlert className="h-3.5 w-3.5" />Без ПДН ({stats.pndUnsigned})</button>
            )}
          </div>
        </div>
      </div>

      {/* Table area */}
      <div className="flex-1 overflow-auto px-2 py-2">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : paginatedClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-medium text-foreground mb-1">
              {clients.length === 0 ? 'Нет клиентов' : 'Клиенты не найдены'}
            </h3>
            <p className="text-muted-foreground text-sm">
              {clients.length === 0 ? 'Добавьте первого клиента для начала работы' : 'Попробуйте изменить параметры поиска'}
            </p>
          </div>
        ) : (
          <ClientsTable 
            clients={paginatedClients}
            policies={policies}
            onClientClick={handleClientSelect}
            onNewSale={handleNewSale}
            onOpenChat={handleOpenChat}
          />
        )}
      </div>

      {/* Pagination */}
      {!isLoading && totalCount > 0 && (
        <div className="shrink-0 border-t px-4 py-2 bg-background">
          <ServerPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            label="клиентов"
          />
        </div>
      )}
    </div>
  );
}
