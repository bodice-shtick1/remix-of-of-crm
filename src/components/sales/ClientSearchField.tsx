import { useState, useMemo, useRef, KeyboardEvent, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Search, Plus, User, Phone, X, Check, MapPin, Calendar, AlertTriangle, History } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { getClientDisplayName } from '@/lib/mappers';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { MaskedPhone } from '@/components/common/MaskedPhone';
import { maskPhone } from '@/hooks/useContactMasking';


export interface ClientData {
  id: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  company_name?: string | null;
  is_company: boolean;
  phone: string;
  email?: string | null;
  birth_date?: string | null;
  address?: string | null;
}

export interface ClientVisit {
  id: string;
  date: string;
  totalAmount: number;
  items: {
    name: string;
    amount: number;
  }[];
}

export interface ExpiringPolicy {
  id: string;
  type: string;
  endDate: string;
  daysLeft: number;
  isExpired: boolean;
}

interface ClientSearchFieldProps {
  clients: ClientData[];
  selectedClient: ClientData | null;
  onSelectClient: (client: ClientData | null) => void;
  onCreateClient: (data: Partial<ClientData>) => Promise<void>;
  clientVisits?: ClientVisit[];
  expiringPolicies?: ExpiringPolicy[];
  isLoadingHistory?: boolean;
}

export interface ClientSearchFieldRef {
  focus: () => void;
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
  const rest = digits.startsWith('7') ? digits.slice(1) : digits.startsWith('8') ? digits.slice(1) : digits;
  if (rest.length > 0) formatted += ' (' + rest.slice(0, 3);
  if (rest.length >= 3) formatted += ')';
  if (rest.length > 3) formatted += ' ' + rest.slice(3, 6);
  if (rest.length > 6) formatted += '-' + rest.slice(6, 8);
  if (rest.length > 8) formatted += '-' + rest.slice(8, 10);
  return formatted;
};

export const ClientSearchField = forwardRef<ClientSearchFieldRef, ClientSearchFieldProps>(({
  clients,
  selectedClient,
  onSelectClient,
  onCreateClient,
  clientVisits = [],
  expiringPolicies = [],
  isLoadingHistory = false,
}, ref) => {
  const [search, setSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newClient, setNewClient] = useState({
    last_name: '',
    first_name: '',
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
  const wrapperRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => searchInputRef.current?.focus()
  }));

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredClients = useMemo(() => {
    if (search.length < 2) return [];
    const searchLower = search.toLowerCase().trim();
    const searchDigits = search.replace(/\D/g, '');
    
    return clients.filter(client => {
      const fullName = `${client.last_name} ${client.first_name} ${client.middle_name || ''}`.toLowerCase();
      const phoneDigits = client.phone.replace(/\D/g, '');
      
      // Search by name parts
      const nameMatch = fullName.includes(searchLower) ||
        client.last_name.toLowerCase().startsWith(searchLower) ||
        client.first_name.toLowerCase().startsWith(searchLower);
      
      // Search by phone (at least 3 digits)
      const phoneMatch = searchDigits.length >= 3 && phoneDigits.includes(searchDigits);
      
      return nameMatch || phoneMatch;
    }).slice(0, 8);
  }, [search, clients]);

  // getClientDisplayName is imported from @/lib/mappers

  const handleSelectClient = (client: ClientData) => {
    onSelectClient(client);
    setSearch('');
    setIsDropdownOpen(false);
    setIsCreatingNew(false);
  };

  const handleCreateNew = async () => {
    const lastName = normalizeSpaces(newClient.last_name);
    const firstName = normalizeSpaces(newClient.first_name);
    const middleName = normalizeSpaces(newClient.middle_name);
    const phoneDigits = newClient.phone.replace(/\D/g, '');

    // Validation
    if (!lastName) {
      lastNameRef.current?.focus();
      return;
    }
    if (!firstName) {
      firstNameRef.current?.focus();
      return;
    }
    if (phoneDigits.length < 10) {
      phoneRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateClient({
        first_name: firstName,
        last_name: lastName,
        middle_name: middleName || undefined,
        phone: newClient.phone,
        birth_date: newClient.birth_date || undefined,
        address: normalizeSpaces(newClient.address) || undefined,
        is_company: false,
      });
      setIsCreatingNew(false);
      setNewClient({ last_name: '', first_name: '', middle_name: '', phone: '', birth_date: '', address: '' });
      setSearch('');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Smart parsing function - extract FIO, date, phone, address from a single string
  const parseClientString = (input: string): {
    lastName?: string;
    firstName?: string;
    middleName?: string;
    birthDate?: string;
    phone?: string;
    address?: string;
  } => {
    const result: ReturnType<typeof parseClientString> = {};
    let remaining = input.trim();
    
    // 1. Extract phone number (10-11 digits, possibly with prefix)
    const phonePatterns = [
      /(?:\+7|8)?[\s-]?\(?(\d{3})\)?[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})/,
      /(\d{10,11})/,
    ];
    
    for (const pattern of phonePatterns) {
      const match = remaining.match(pattern);
      if (match) {
        let digits = match[0].replace(/\D/g, '');
        // Normalize to 10 digits (remove leading 7 or 8)
        if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
          digits = digits.slice(1);
        }
        if (digits.length === 10) {
          result.phone = formatPhoneNumber(digits);
          remaining = remaining.replace(match[0], ' ');
          break;
        }
      }
    }
    
    // 2. Extract birth date (DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY or DDMMYYYY)
    const datePatternWithSeparator = /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/;
    const datePatternCompact = /(?<!\d)(\d{2})(\d{2})(\d{4})(?!\d)/; // 8 consecutive digits: DDMMYYYY
    
    let dateMatch = remaining.match(datePatternWithSeparator);
    if (dateMatch) {
      const [, day, month, year] = dateMatch;
      const d = day.padStart(2, '0');
      const m = month.padStart(2, '0');
      const y = parseInt(year);
      if (y >= 1920 && y <= new Date().getFullYear() && parseInt(d) <= 31 && parseInt(m) <= 12) {
        result.birthDate = `${year}-${m}-${d}`;
        remaining = remaining.replace(dateMatch[0], ' ');
      }
    } else {
      // Try compact format: DDMMYYYY (e.g., 12012000)
      dateMatch = remaining.match(datePatternCompact);
      if (dateMatch) {
        const [, day, month, year] = dateMatch;
        const y = parseInt(year);
        const d = parseInt(day);
        const m = parseInt(month);
        if (y >= 1920 && y <= new Date().getFullYear() && d >= 1 && d <= 31 && m >= 1 && m <= 12) {
          result.birthDate = `${year}-${month}-${day}`;
          remaining = remaining.replace(dateMatch[0], ' ');
        }
      }
    }
    
    // 3. Clean remaining text
    remaining = remaining.replace(/\s+/g, ' ').trim();
    
    // 4. Extract FIO (first 3 capitalized words) with proper case normalization
    const words = remaining.split(/\s+/);
    const nameWords: string[] = [];
    const addressWords: string[] = [];
    
    let foundNameEnd = false;
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      // Check if word looks like a name (contains only letters)
      const isNameWord = /^[А-ЯЁа-яёA-Za-z-]+$/.test(word) && nameWords.length < 3;
      
      if (isNameWord && !foundNameEnd) {
        // Normalize case: First letter uppercase, rest lowercase
        const normalized = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        nameWords.push(normalized);
      } else {
        foundNameEnd = true;
        addressWords.push(word);
      }
    }
    
    // Assign name parts
    if (nameWords.length >= 1) result.lastName = nameWords[0];
    if (nameWords.length >= 2) result.firstName = nameWords[1];
    if (nameWords.length >= 3) result.middleName = nameWords[2];
    
    // 5. Remaining text is address
    if (addressWords.length > 0) {
      result.address = addressWords.join(' ');
    }
    
    return result;
  };

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      return;
    }

    if (!isDropdownOpen || filteredClients.length === 0) {
      if (e.key === 'Enter' && search.length >= 2 && filteredClients.length === 0) {
        e.preventDefault();
        // Smart parse the input and pre-fill form
        const parsed = parseClientString(search);
        openCreateForm(parsed);
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
    }
  };

  const openCreateForm = (parsedData?: ReturnType<typeof parseClientString>) => {
    setIsCreatingNew(true);
    setIsDropdownOpen(false);
    
    // If parsed data provided (from smart parsing), use it
    if (parsedData && (parsedData.lastName || parsedData.firstName)) {
      setNewClient({
        last_name: parsedData.lastName || '',
        first_name: parsedData.firstName || '',
        middle_name: parsedData.middleName || '',
        phone: parsedData.phone || '',
        birth_date: parsedData.birthDate || '',
        address: parsedData.address || '',
      });
      setTimeout(() => phoneRef.current?.focus(), 50);
      return;
    }
    
    // Fallback: Pre-fill from search with case normalization
    const searchTrimmed = search.trim();
    if (searchTrimmed && !/^\d+$/.test(searchTrimmed)) {
      const parts = searchTrimmed.split(/\s+/);
      // Normalize case: First letter uppercase, rest lowercase
      const normalizeName = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      setNewClient(prev => ({
        ...prev,
        last_name: parts[0] ? normalizeName(parts[0]) : '',
        first_name: parts[1] ? normalizeName(parts[1]) : '',
        middle_name: parts[2] ? normalizeName(parts[2]) : '',
      }));
    } else if (/^\d+$/.test(searchTrimmed)) {
      setNewClient(prev => ({
        ...prev,
        phone: formatPhoneNumber(searchTrimmed),
      }));
    }
    setTimeout(() => {
      if (newClient.last_name || searchTrimmed.split(/\s+/)[0]) {
        phoneRef.current?.focus();
      } else {
        lastNameRef.current?.focus();
      }
    }, 50);
  };

  const handleFieldKeyDown = (
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
    const cleaned = value.replace(/[^a-zA-Zа-яА-ЯёЁ\s-]/g, '');
    setNewClient(prev => ({ ...prev, [field]: cleaned }));
  };

  const handlePhoneChange = (value: string) => {
    setNewClient(prev => ({ ...prev, phone: formatPhoneNumber(value) }));
  };

  const handleClearClient = () => {
    onSelectClient(null);
    setSearch('');
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  // If client is selected, show compact info panel with history
  if (selectedClient) {
    return (
      <div className="flex flex-col gap-1.5">
        {/* Client header with info - ULTRA COMPACT */}
        <div className="p-2 bg-primary/5 border border-primary/20 rounded-lg">
          {/* Row 1: FIO | Birthday | Phone | Address */}
          <div className="flex items-center gap-2 text-sm">
            <User className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="font-semibold">{getClientDisplayName(selectedClient)}</span>
            <span className="text-muted-foreground">|</span>
            {selectedClient.birth_date && (
              <>
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <Calendar className="h-3 w-3" />
                  {format(parseISO(selectedClient.birth_date), 'dd.MM.yyyy')}
                </span>
                <span className="text-muted-foreground">|</span>
              </>
            )}
            <MaskedPhone
                  phone={selectedClient.phone}
                  clientId={selectedClient.id}
                  clientName={getClientDisplayName(selectedClient)}
                  className="text-xs"
                  context="Новая продажа"
                />
            {selectedClient.address && (
              <>
                <span className="text-muted-foreground">|</span>
                <span className="text-xs text-muted-foreground flex items-center gap-0.5 truncate max-w-[150px]" title={selectedClient.address}>
                  <MapPin className="h-3 w-3 shrink-0" />
                  {selectedClient.address}
                </span>
              </>
            )}
            <div className="flex-1" />
            <Button variant="ghost" size="icon" onClick={handleClearClient} className="shrink-0 h-6 w-6">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Expiring policies alerts - inline chips */}
          {expiringPolicies.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {expiringPolicies.map(policy => (
                <span
                  key={policy.id}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-medium inline-flex items-center gap-0.5",
                    policy.isExpired
                      ? "bg-destructive/10 text-destructive"
                      : policy.daysLeft <= 7
                        ? "bg-warning/10 text-warning"
                        : "bg-accent text-accent-foreground"
                  )}
                >
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {policy.isExpired ? `Просрочено ${policy.type}` : `${policy.type} — ${policy.daysLeft} дн.`}
                </span>
              ))}
            </div>
          )}
          
          {/* Row 2: Compact history - tabular layout */}
          {isLoadingHistory ? (
            <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-muted-foreground">
              <div className="h-2.5 w-2.5 border border-primary border-t-transparent rounded-full animate-spin" />
              Загрузка истории...
            </div>
          ) : clientVisits.length > 0 ? (
            <div className="mt-1.5 max-w-[600px]">
              <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                <History className="h-2.5 w-2.5" />
                Последние услуги:
              </div>
              <div className="flex flex-col">
                {clientVisits.slice(0, 5).map((visit) => (
                  <div
                    key={visit.id}
                    className="grid text-[10px] py-0.5 border-b border-border/30 last:border-b-0"
                    style={{ gridTemplateColumns: '70px 1fr 90px' }}
                  >
                    <span className="font-medium text-foreground">
                      {format(parseISO(visit.date), 'dd.MM.yy', { locale: ru })}
                    </span>
                    <span className="text-muted-foreground truncate pr-4">
                      {visit.items.map(i => i.name).join(', ')}
                    </span>
                    <span className="font-semibold text-foreground text-left tabular-nums">
                      {visit.totalAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}&nbsp;₽
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="space-y-3" style={{ overflow: 'visible' }}>
      {/* Search field */}
      {!isCreatingNew && (
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Поиск клиента по ФИО или телефону..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setIsDropdownOpen(e.target.value.length >= 2);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => search.length >= 2 && setIsDropdownOpen(true)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => openCreateForm()} title="Создать нового клиента">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Dropdown */}
          {isDropdownOpen && (
            <div className="absolute z-[60] w-full mt-1 bg-popover border rounded-lg shadow-xl max-h-72 overflow-y-auto">
              {filteredClients.length > 0 ? (
                filteredClients.map((client, index) => (
                  <button
                    key={client.id}
                    onClick={() => handleSelectClient(client)}
                    className={cn(
                      "w-full px-4 py-2.5 text-left transition-colors border-b last:border-b-0 flex items-center gap-3",
                      index === highlightedIndex ? "bg-primary/10" : "hover:bg-muted/50"
                    )}
                  >
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{getClientDisplayName(client)}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {maskPhone(client.phone)}
                      </p>
                    </div>
                  </button>
                ))
              ) : search.length >= 2 ? (
                <div className="p-4 text-center">
                  <p className="text-muted-foreground mb-2">Клиент не найден</p>
                  <Button size="sm" onClick={() => openCreateForm()} className="gap-1">
                    <Plus className="h-4 w-4" />
                    Создать нового
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Create new client form */}
      {isCreatingNew && (
        <div className="p-4 bg-muted/30 rounded-lg border space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Новый клиент
            </h4>
            <Button variant="ghost" size="sm" onClick={() => setIsCreatingNew(false)}>
              Отмена
            </Button>
          </div>

          {/* Name fields */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Фамилия *</Label>
              <Input
                ref={lastNameRef}
                value={newClient.last_name}
                onChange={(e) => handleNameChange('last_name', e.target.value)}
                onBlur={(e) => setNewClient(prev => ({ ...prev, last_name: normalizeSpaces(e.target.value) }))}
                onKeyDown={(e) => handleFieldKeyDown(e, firstNameRef)}
                placeholder="Иванов"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Имя *</Label>
              <Input
                ref={firstNameRef}
                value={newClient.first_name}
                onChange={(e) => handleNameChange('first_name', e.target.value)}
                onBlur={(e) => setNewClient(prev => ({ ...prev, first_name: normalizeSpaces(e.target.value) }))}
                onKeyDown={(e) => handleFieldKeyDown(e, middleNameRef)}
                placeholder="Иван"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Отчество</Label>
              <Input
                ref={middleNameRef}
                value={newClient.middle_name}
                onChange={(e) => handleNameChange('middle_name', e.target.value)}
                onBlur={(e) => setNewClient(prev => ({ ...prev, middle_name: normalizeSpaces(e.target.value) }))}
                onKeyDown={(e) => handleFieldKeyDown(e, phoneRef)}
                placeholder="Иванович"
                className="mt-1"
              />
            </div>
          </div>

          {/* Phone and birth date */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Телефон *</Label>
              <Input
                ref={phoneRef}
                value={newClient.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                onKeyDown={(e) => handleFieldKeyDown(e, birthDateRef)}
                placeholder="+7 (999) 123-45-67"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Дата рождения</Label>
              <Input
                ref={birthDateRef}
                type="date"
                value={newClient.birth_date}
                onChange={(e) => setNewClient(prev => ({ ...prev, birth_date: e.target.value }))}
                onKeyDown={(e) => handleFieldKeyDown(e, addressRef)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <Label className="text-xs text-muted-foreground">Прописка</Label>
            <Input
              ref={addressRef}
              value={newClient.address}
              onChange={(e) => setNewClient(prev => ({ ...prev, address: e.target.value }))}
              onBlur={(e) => setNewClient(prev => ({ ...prev, address: normalizeSpaces(e.target.value) }))}
              onKeyDown={(e) => handleFieldKeyDown(e, null)}
              placeholder="г. Москва, ул. Ленина, д. 1"
              className="mt-1"
            />
          </div>

          <Button onClick={handleCreateNew} disabled={isSubmitting} className="w-full gap-2">
            {isSubmitting ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <Check className="h-4 w-4" />
            )}
            Создать клиента
          </Button>
        </div>
      )}
    </div>
  );
});

ClientSearchField.displayName = 'ClientSearchField';
