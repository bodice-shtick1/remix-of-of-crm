import { useState, useMemo } from 'react';
import { Search, Plus, User, Phone, MapPin, AlertTriangle, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Client, Policy, ClientVisit } from '@/types/crm';
import { format, differenceInDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { MaskedPhone } from '@/components/common/MaskedPhone';
import { maskPhone } from '@/hooks/useContactMasking';

interface ClientSearchBlockProps {
  clients: Client[];
  policies: Policy[];
  clientVisits: Record<string, ClientVisit[]>;
  selectedClient: Client | null;
  onSelectClient: (client: Client | null) => void;
  onCreateClient: (data: Partial<Client>) => void;
}

export function ClientSearchBlock({
  clients,
  policies,
  clientVisits,
  selectedClient,
  onSelectClient,
  onCreateClient,
}: ClientSearchBlockProps) {
  const [search, setSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newClient, setNewClient] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    phone: '',
    birthDate: '',
    address: '',
  });

  const filteredClients = useMemo(() => {
    if (search.length < 3) return [];
    const searchLower = search.toLowerCase();
    const searchPhone = search.replace(/\D/g, '');
    
    return clients.filter(client => {
      const fullName = `${client.lastName} ${client.firstName} ${client.middleName || ''}`.toLowerCase();
      const phone = client.phone.replace(/\D/g, '');
      return fullName.includes(searchLower) || phone.includes(searchPhone);
    }).slice(0, 5);
  }, [search, clients]);

  const clientPolicies = useMemo(() => {
    if (!selectedClient) return [];
    return policies.filter(p => p.clientId === selectedClient.id);
  }, [selectedClient, policies]);

  const expiringPolicies = useMemo(() => {
    const today = new Date();
    return clientPolicies.filter(p => {
      const endDate = new Date(p.endDate);
      const days = differenceInDays(endDate, today);
      return days <= 30 && days >= -30;
    }).map(p => {
      const days = differenceInDays(new Date(p.endDate), today);
      return { ...p, daysLeft: days };
    });
  }, [clientPolicies]);

  const lastVisit = useMemo(() => {
    if (!selectedClient) return null;
    const visits = clientVisits[selectedClient.id];
    return visits?.[0] || null;
  }, [selectedClient, clientVisits]);

  const getClientDisplayName = (client: Client) => {
    if (client.isCompany) return client.companyName || '';
    return `${client.lastName} ${client.firstName} ${client.middleName || ''}`.trim();
  };

  const handleSelectClient = (client: Client) => {
    onSelectClient(client);
    setSearch('');
    setIsDropdownOpen(false);
    setIsCreatingNew(false);
  };

  const handleCreateNew = () => {
    if (!newClient.phone || !newClient.lastName) return;
    onCreateClient({
      ...newClient,
      isCompany: false,
    });
    setIsCreatingNew(false);
    setNewClient({ firstName: '', lastName: '', middleName: '', phone: '', birthDate: '', address: '' });
  };

  return (
    <div className="card-elevated p-4">
      <div className="flex items-center gap-2 mb-4">
        <User className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Клиент</h3>
      </div>

      {!selectedClient ? (
        <div className="space-y-4">
          {/* Поиск клиента */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Введите ФИО или номер телефона (мин. 3 символа)..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setIsDropdownOpen(e.target.value.length >= 3);
              }}
              className="pl-10"
            />
            
            {/* Выпадающий список */}
            {isDropdownOpen && filteredClients.length > 0 && (
              <div className="absolute z-[60] w-full mt-1 bg-popover border rounded-lg shadow-xl max-h-72 overflow-y-auto">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => handleSelectClient(client)}
                    className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b last:border-b-0"
                  >
                    <p className="font-medium">{getClientDisplayName(client)}</p>
                    <p className="text-sm text-muted-foreground">{maskPhone(client.phone)}</p>
                  </button>
                ))}
              </div>
            )}
            
            {isDropdownOpen && filteredClients.length === 0 && search.length >= 3 && (
              <div className="absolute z-[60] w-full mt-1 bg-popover border rounded-lg shadow-xl p-4 text-center">
                <p className="text-muted-foreground mb-2">Клиент не найден</p>
                <Button size="sm" onClick={() => setIsCreatingNew(true)} className="gap-1">
                  <Plus className="h-4 w-4" />
                  Создать нового
                </Button>
              </div>
            )}
          </div>

          {/* Форма создания нового клиента */}
          {isCreatingNew && (
            <div className="p-4 bg-muted/30 rounded-lg border space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Новый клиент</h4>
                <Button variant="ghost" size="sm" onClick={() => setIsCreatingNew(false)}>
                  Отмена
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Фамилия *</Label>
                  <Input
                    value={newClient.lastName}
                    onChange={(e) => setNewClient({ ...newClient, lastName: e.target.value })}
                    placeholder="Иванов"
                  />
                </div>
                <div>
                  <Label className="text-xs">Имя</Label>
                  <Input
                    value={newClient.firstName}
                    onChange={(e) => setNewClient({ ...newClient, firstName: e.target.value })}
                    placeholder="Иван"
                  />
                </div>
                <div>
                  <Label className="text-xs">Отчество</Label>
                  <Input
                    value={newClient.middleName}
                    onChange={(e) => setNewClient({ ...newClient, middleName: e.target.value })}
                    placeholder="Иванович"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Телефон *</Label>
                  <Input
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    placeholder="+7 (999) 123-45-67"
                  />
                </div>
                <div>
                  <Label className="text-xs">Дата рождения</Label>
                  <Input
                    type="date"
                    value={newClient.birthDate}
                    onChange={(e) => setNewClient({ ...newClient, birthDate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Прописка</Label>
                <Input
                  value={newClient.address}
                  onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                  placeholder="г. Москва, ул. Ленина, д. 1"
                />
              </div>
              <Button onClick={handleCreateNew} className="w-full">
                Создать клиента
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Инфо-панель выбранного клиента */
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              {/* Основные данные */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{getClientDisplayName(selectedClient)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <MaskedPhone 
                    phone={selectedClient.phone} 
                    clientId={selectedClient.id} 
                    clientName={getClientDisplayName(selectedClient)}
                    context="Новая продажа"
                  />
                </div>
                {selectedClient.address && (
                  <div className="flex items-center gap-2 text-sm col-span-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{selectedClient.address}</span>
                  </div>
                )}
              </div>

              {/* Последний визит */}
              {lastVisit && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Последний визит: {format(new Date(lastVisit.date), 'dd.MM.yyyy')}
                    </span>
                  </div>
                  <p className="text-sm">{lastVisit.services.join(', ')}</p>
                  <p className="text-lg font-bold text-primary mt-1 tabular-nums">
                    {lastVisit.amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}&nbsp;₽
                  </p>
                </div>
              )}

              {/* Предупреждения о полисах */}
              {expiringPolicies.length > 0 && (
                <div className="space-y-2">
                  {expiringPolicies.map((policy) => (
                    <div
                      key={policy.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg text-sm animate-pulse",
                        policy.daysLeft < 0
                          ? "bg-destructive/10 text-destructive"
                          : "bg-warning/10 text-warning-foreground"
                      )}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <span>
                        {policy.daysLeft < 0
                          ? `Просрочено ${policy.type} на ${Math.abs(policy.daysLeft)} дн.`
                          : `Истекает ${policy.type} через ${policy.daysLeft} дн.`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onSelectClient(null)}
              className="text-muted-foreground"
            >
              Изменить
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
