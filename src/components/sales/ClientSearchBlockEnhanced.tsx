import { useState, useMemo, useRef, KeyboardEvent, forwardRef, useImperativeHandle } from 'react';
import { Search, Plus, User, Phone, MapPin, AlertTriangle, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { MaskedPhone } from '@/components/common/MaskedPhone';
import { maskPhone } from '@/hooks/useContactMasking';


export interface ClientData {
  id: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  company_name?: string;
  is_company: boolean;
  phone: string;
  email?: string;
  birth_date?: string;
  address?: string;
}

export interface PolicyData {
  id: string;
  client_id: string;
  policy_type: string;
  end_date: string;
}

export interface ClientVisitData {
  date: string;
  services: string[];
  amount: number;
}

interface ClientSearchBlockEnhancedProps {
  clients: ClientData[];
  policies: PolicyData[];
  clientVisits: Record<string, ClientVisitData[]>;
  selectedClient: ClientData | null;
  onSelectClient: (client: ClientData | null) => void;
  onCreateClient: (data: Partial<ClientData>) => void;
  onClientSelected?: () => void;
}

export interface ClientSearchBlockEnhancedRef {
  focusSearch: () => void;
}

// Trim multiple spaces and trim edges
const normalizeSpaces = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

// Format phone number
const formatPhoneNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return '';
  
  let formatted = '+7';
  if (digits.length > 1) {
    const rest = digits.startsWith('7') ? digits.slice(1) : digits.startsWith('8') ? digits.slice(1) : digits;
    if (rest.length > 0) formatted += ' (' + rest.slice(0, 3);
    if (rest.length >= 3) formatted += ')';
    if (rest.length > 3) formatted += ' ' + rest.slice(3, 6);
    if (rest.length > 6) formatted += '-' + rest.slice(6, 8);
    if (rest.length > 8) formatted += '-' + rest.slice(8, 10);
  }
  return formatted;
};

export const ClientSearchBlockEnhanced = forwardRef<ClientSearchBlockEnhancedRef, ClientSearchBlockEnhancedProps>(({
  clients,
  policies,
  clientVisits,
  selectedClient,
  onSelectClient,
  onCreateClient,
  onClientSelected,
}, ref) => {
  const [search, setSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newClient, setNewClient] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    phone: '',
    birth_date: '',
    address: '',
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const middleNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const birthDateRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);

  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      searchInputRef.current?.focus();
    }
  }));

  const filteredClients = useMemo(() => {
    if (search.length < 3) return [];
    const searchLower = search.toLowerCase();
    const searchPhone = search.replace(/\D/g, '');
    
    return clients.filter(client => {
      const fullName = `${client.last_name} ${client.first_name} ${client.middle_name || ''}`.toLowerCase();
      const phone = client.phone.replace(/\D/g, '');
      return fullName.includes(searchLower) || phone.includes(searchPhone);
    }).slice(0, 5);
  }, [search, clients]);

  const clientPolicies = useMemo(() => {
    if (!selectedClient) return [];
    return policies.filter(p => p.client_id === selectedClient.id);
  }, [selectedClient, policies]);

  const expiringPolicies = useMemo(() => {
    const today = new Date();
    return clientPolicies.filter(p => {
      const endDate = new Date(p.end_date);
      const days = differenceInDays(endDate, today);
      return days <= 30 && days >= -30;
    }).map(p => {
      const days = differenceInDays(new Date(p.end_date), today);
      return { ...p, daysLeft: days };
    });
  }, [clientPolicies]);

  const lastVisit = useMemo(() => {
    if (!selectedClient) return null;
    const visits = clientVisits[selectedClient.id];
    return visits?.[0] || null;
  }, [selectedClient, clientVisits]);

  const getClientDisplayName = (client: ClientData) => {
    if (client.is_company) return client.company_name || '';
    return `${client.last_name} ${client.first_name} ${client.middle_name || ''}`.trim();
  };

  const handleSelectClient = (client: ClientData) => {
    onSelectClient(client);
    setSearch('');
    setIsDropdownOpen(false);
    setIsCreatingNew(false);
    // Call the callback that triggers adding first product
    setTimeout(() => {
      onClientSelected?.();
    }, 100);
  };

  const handleCreateNew = () => {
    const lastName = normalizeSpaces(newClient.last_name);
    const firstName = normalizeSpaces(newClient.first_name);
    const middleName = normalizeSpaces(newClient.middle_name);
    const phone = newClient.phone.replace(/\D/g, '');

    // Validation
    if (!lastName) {
      lastNameRef.current?.focus();
      return;
    }
    if (!phone || phone.length < 10) {
      phoneRef.current?.focus();
      return;
    }

    onCreateClient({
      first_name: firstName,
      last_name: lastName,
      middle_name: middleName || undefined,
      phone: newClient.phone,
      birth_date: newClient.birth_date || undefined,
      address: normalizeSpaces(newClient.address) || undefined,
      is_company: false,
    });
    setIsCreatingNew(false);
    setNewClient({ first_name: '', last_name: '', middle_name: '', phone: '', birth_date: '', address: '' });
  };

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || filteredClients.length === 0) {
      if (e.key === 'Enter' && filteredClients.length === 0 && search.length >= 3) {
        e.preventDefault();
        setIsCreatingNew(true);
        setTimeout(() => lastNameRef.current?.focus(), 50);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, filteredClients.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredClients[highlightedIndex]) {
          handleSelectClient(filteredClients[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsDropdownOpen(false);
        break;
    }
  };

  const handleNewClientFieldKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    nextRef: React.RefObject<HTMLInputElement | HTMLButtonElement> | null
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextRef?.current) {
        nextRef.current.focus();
      } else {
        handleCreateNew();
      }
    }
  };

  const handleNameChange = (field: 'first_name' | 'last_name' | 'middle_name', value: string) => {
    // Allow only letters, spaces, and hyphens
    const cleaned = value.replace(/[^a-zA-Zа-яА-ЯёЁ\s-]/g, '');
    setNewClient({ ...newClient, [field]: cleaned });
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setNewClient({ ...newClient, phone: formatted });
  };

  return (
    <div className="card-elevated p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Клиент</h3>
        </div>
        {!selectedClient && !isCreatingNew && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setIsCreatingNew(true);
              setTimeout(() => lastNameRef.current?.focus(), 50);
            }}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Новый
          </Button>
        )}
      </div>

      {!selectedClient ? (
        <div className="space-y-4">
          {/* Client search */}
          {!isCreatingNew && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Введите ФИО или номер телефона (мин. 3 символа)..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setIsDropdownOpen(e.target.value.length >= 3);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                className="pl-10"
              />
              
              {/* Dropdown list - only show when there are matches */}
              {isDropdownOpen && filteredClients.length > 0 && (
                <div className="absolute z-[60] w-full mt-1 bg-popover border rounded-lg shadow-xl max-h-64 overflow-y-auto">
                  {filteredClients.map((client, index) => (
                    <button
                      key={client.id}
                      onClick={() => handleSelectClient(client)}
                      className={cn(
                        "w-full px-4 py-3 text-left transition-colors border-b last:border-b-0",
                        index === highlightedIndex ? "bg-primary/10" : "hover:bg-muted/50"
                      )}
                    >
                      <p className="font-medium">{getClientDisplayName(client)}</p>
                      <p className="text-sm text-muted-foreground">{maskPhone(client.phone)}</p>
                    </button>
                  ))}
                </div>
              )}
              
              {/* Not found message */}
              {isDropdownOpen && filteredClients.length === 0 && search.length >= 3 && (
                <div className="absolute z-[60] w-full mt-1 bg-popover border rounded-lg shadow-xl p-4 text-center">
                  <p className="text-muted-foreground mb-2">Клиент не найден</p>
                  <Button size="sm" onClick={() => {
                    setIsCreatingNew(true);
                    setIsDropdownOpen(false);
                    // Pre-fill last name from search if it looks like a name
                    const searchTrimmed = search.trim();
                    if (searchTrimmed && !/^\d+$/.test(searchTrimmed)) {
                      const parts = searchTrimmed.split(/\s+/);
                      setNewClient(prev => ({
                        ...prev,
                        last_name: parts[0] || '',
                        first_name: parts[1] || '',
                        middle_name: parts[2] || '',
                      }));
                    }
                    setTimeout(() => lastNameRef.current?.focus(), 50);
                  }} className="gap-1">
                    <Plus className="h-4 w-4" />
                    Создать нового
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* New client form */}
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
                    ref={lastNameRef}
                    value={newClient.last_name}
                    onChange={(e) => handleNameChange('last_name', e.target.value)}
                    onBlur={(e) => setNewClient({ ...newClient, last_name: normalizeSpaces(e.target.value) })}
                    onKeyDown={(e) => handleNewClientFieldKeyDown(e, firstNameRef)}
                    placeholder="Иванов"
                  />
                </div>
                <div>
                  <Label className="text-xs">Имя</Label>
                  <Input
                    ref={firstNameRef}
                    value={newClient.first_name}
                    onChange={(e) => handleNameChange('first_name', e.target.value)}
                    onBlur={(e) => setNewClient({ ...newClient, first_name: normalizeSpaces(e.target.value) })}
                    onKeyDown={(e) => handleNewClientFieldKeyDown(e, middleNameRef)}
                    placeholder="Иван"
                  />
                </div>
                <div>
                  <Label className="text-xs">Отчество</Label>
                  <Input
                    ref={middleNameRef}
                    value={newClient.middle_name}
                    onChange={(e) => handleNameChange('middle_name', e.target.value)}
                    onBlur={(e) => setNewClient({ ...newClient, middle_name: normalizeSpaces(e.target.value) })}
                    onKeyDown={(e) => handleNewClientFieldKeyDown(e, phoneRef)}
                    placeholder="Иванович"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Телефон *</Label>
                  <Input
                    ref={phoneRef}
                    value={newClient.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    onKeyDown={(e) => handleNewClientFieldKeyDown(e, birthDateRef)}
                    placeholder="+7 (999) 123-45-67"
                  />
                </div>
                <div>
                  <Label className="text-xs">Дата рождения</Label>
                  <Input
                    ref={birthDateRef}
                    type="date"
                    value={newClient.birth_date}
                    onChange={(e) => setNewClient({ ...newClient, birth_date: e.target.value })}
                    onKeyDown={(e) => handleNewClientFieldKeyDown(e, addressRef)}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Прописка</Label>
                <Input
                  ref={addressRef}
                  value={newClient.address}
                  onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                  onBlur={(e) => setNewClient({ ...newClient, address: normalizeSpaces(e.target.value) })}
                  onKeyDown={(e) => handleNewClientFieldKeyDown(e, createButtonRef)}
                  placeholder="г. Москва, ул. Ленина, д. 1"
                />
              </div>
              <Button ref={createButtonRef} onClick={handleCreateNew} className="w-full">
                Создать клиента
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Selected client info panel */
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              {/* Main data */}
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

              {/* Last visit */}
              {lastVisit && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Последний визит: {format(new Date(lastVisit.date), 'dd.MM.yyyy')}
                    </span>
                  </div>
                  <p className="text-sm">{lastVisit.services.join(', ')}</p>
                  <p className="text-lg font-bold text-primary mt-1">
                    {lastVisit.amount.toLocaleString('ru-RU')} ₽
                  </p>
                </div>
              )}

              {/* Policy warnings */}
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
                          ? `Просрочено ${policy.policy_type} на ${Math.abs(policy.daysLeft)} дн.`
                          : `Истекает ${policy.policy_type} через ${policy.daysLeft} дн.`}
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
});

ClientSearchBlockEnhanced.displayName = 'ClientSearchBlockEnhanced';
