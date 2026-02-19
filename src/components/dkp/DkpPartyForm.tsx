import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Eye, EyeOff, Wand2, Search, UserCheck } from 'lucide-react';
import { parseClientData } from '@/lib/clientDataParser';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { DkpParty } from './DkpPreview';

interface ClientSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  phone: string;
  address: string | null;
  passport_series: string | null;
  passport_number: string | null;
  passport_issued_by: string | null;
  passport_issue_date: string | null;
  passport_unit_code: string | null;
}

interface DkpPartyFormProps {
  title: string;
  party: DkpParty;
  onChange: (party: DkpParty) => void;
  showSmartParser?: boolean;
  showClientSearch?: boolean;
  readOnlyName?: boolean;
  /** Set of field names that were pre-filled from the database */
  preFilledFields?: Set<string>;
}

export function DkpPartyForm({ title, party, onChange, showSmartParser, showClientSearch, readOnlyName, preFilledFields }: DkpPartyFormProps) {
  const [passportVisible, setPassportVisible] = useState(false);
  const [smartText, setSmartText] = useState('');

  // Client search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ClientSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchListRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const update = (field: keyof DkpParty, value: string) => {
    onChange({ ...party, [field]: value });
  };

  const isPreFilled = (field: string) => preFilledFields?.has(field) ?? false;
  const isEmpty = (field: keyof DkpParty) => !party[field];
  const fieldHighlight = (field: keyof DkpParty) => {
    if (!preFilledFields) return '';
    if (isPreFilled(field)) return 'ring-1 ring-primary/30 bg-primary/5';
    if (isEmpty(field)) return 'ring-1 ring-destructive/30 bg-destructive/5';
    return '';
  };
  const isFieldReadOnly = (field: string) => isPreFilled(field);

  const handleSmartParse = () => {
    if (!smartText.trim()) return;
    const parsed = parseClientData(smartText);
    const fullName = `${parsed.lastName} ${parsed.firstName} ${parsed.middleName}`.trim();
    onChange({
      fullName: fullName || party.fullName,
      passportSeries: parsed.passportSeries || party.passportSeries,
      passportNumber: parsed.passportNumber || party.passportNumber,
      passportIssuedBy: parsed.passportIssuedBy || party.passportIssuedBy,
      passportIssueDate: parsed.passportIssueDate || party.passportIssueDate,
      passportUnitCode: parsed.passportUnitCode || party.passportUnitCode,
      address: parsed.address || party.address,
      phone: parsed.phone || party.phone,
    });
    setSmartText('');
  };

  const maskValue = (val: string) => {
    if (!val || passportVisible) return val;
    if (val.length <= 2) return '*'.repeat(val.length);
    return val.slice(0, 2) + '*'.repeat(val.length - 2);
  };

  // ── Client search logic ──
  const searchClients = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const trimmed = q.trim();
      const isDigits = /^\d+$/.test(trimmed.replace(/[\s\-\+\(\)]/g, ''));

      let query = supabase
        .from('clients')
        .select('id, first_name, last_name, middle_name, phone, address, passport_series, passport_number, passport_issued_by, passport_issue_date, passport_unit_code')
        .limit(15);

      if (isDigits) {
        const digits = trimmed.replace(/\D/g, '');
        query = query.ilike('phone', `%${digits}%`);
      } else {
        // Search by name parts
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          query = query.ilike('last_name', `%${parts[0]}%`).ilike('first_name', `%${parts[1]}%`);
        } else {
          query = query.or(`last_name.ilike.%${parts[0]}%,first_name.ilike.%${parts[0]}%`);
        }
      }

      const { data } = await query;
      setSearchResults((data || []) as ClientSearchResult[]);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchOpen) return;
    const timer = setTimeout(() => searchClients(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery, searchOpen, searchClients]);

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        searchContainerRef.current && !searchContainerRef.current.contains(target) &&
        searchListRef.current && !searchListRef.current.contains(target)
      ) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Position dropdown
  const updatePosition = useCallback(() => {
    if (!searchContainerRef.current) return;
    const rect = searchContainerRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + window.scrollY + 2,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (searchOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [searchOpen, updatePosition]);

  const handleSelectClient = (client: ClientSearchResult) => {
    const fullName = `${client.last_name} ${client.first_name} ${client.middle_name || ''}`.trim();
    onChange({
      fullName,
      passportSeries: client.passport_series || '',
      passportNumber: client.passport_number || '',
      passportIssuedBy: client.passport_issued_by || '',
      passportIssueDate: client.passport_issue_date || '',
      passportUnitCode: client.passport_unit_code || '',
      address: client.address || '',
      phone: client.phone || '',
    });
    setSearchOpen(false);
    setSearchQuery('');
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!searchOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setSearchOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => Math.min(prev + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightIdx >= 0 && highlightIdx < searchResults.length) {
      e.preventDefault();
      handleSelectClient(searchResults[highlightIdx]);
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setPassportVisible(!passportVisible)}
          title={passportVisible ? 'Скрыть паспорт' : 'Показать паспорт'}
        >
          {passportVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Client search ComboBox */}
      {showClientSearch && (
        <div ref={searchContainerRef} className="relative">
          <Label className="text-xs text-muted-foreground">Поиск клиента по ФИО / телефону</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setHighlightIdx(-1);
                if (!searchOpen) setSearchOpen(true);
              }}
              onFocus={() => {
                if (searchQuery.length >= 2) setSearchOpen(true);
              }}
              onKeyDown={handleSearchKeyDown}
              className="h-7 text-xs pl-7"
              placeholder="Иванов или +7 900..."
            />
          </div>

          {searchOpen && dropdownPos && createPortal(
            <div
              ref={searchListRef}
              style={{
                position: 'absolute',
                left: dropdownPos.left,
                top: dropdownPos.top,
                width: dropdownPos.width,
              }}
              className="z-[200] max-h-[200px] overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg"
            >
              {searchLoading && (
                <div className="px-3 py-2 text-xs text-muted-foreground">Поиск...</div>
              )}
              {!searchLoading && searchResults.length === 0 && searchQuery.length >= 2 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">Не найдено — заполните вручную</div>
              )}
              {searchResults.map((c, i) => (
                <div
                  key={c.id}
                  className={cn(
                    'px-3 py-1.5 text-xs cursor-pointer flex items-center gap-2 hover:bg-accent',
                    highlightIdx === i && 'bg-accent'
                  )}
                  onMouseEnter={() => setHighlightIdx(i)}
                  onClick={() => handleSelectClient(c)}
                >
                  <UserCheck className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{c.last_name} {c.first_name} {c.middle_name || ''}</span>
                  <span className="text-muted-foreground ml-auto truncate">{c.phone}</span>
                </div>
              ))}
            </div>,
            document.body
          )}
        </div>
      )}

      {showSmartParser && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Умный парсер — вставьте данные</Label>
          <div className="flex gap-2">
            <Textarea
              value={smartText}
              onChange={e => setSmartText(e.target.value)}
              placeholder="Вставьте ФИО, паспорт, адрес из мессенджера..."
              className="min-h-[60px] text-xs"
            />
            <Button type="button" variant="outline" size="icon" className="shrink-0 h-[60px] w-10" onClick={handleSmartParse}>
              <Wand2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div>
        <Label className="text-xs">ФИО {isPreFilled('fullName') ? <span className="text-[10px] text-primary ml-1">из базы</span> : isEmpty('fullName') ? <span className="text-[10px] text-destructive ml-1">заполните</span> : null}</Label>
        <Input value={party.fullName} onChange={e => update('fullName', e.target.value)} readOnly={readOnlyName || isFieldReadOnly('fullName')} className={cn("text-sm", fieldHighlight('fullName'))} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Серия паспорта {isPreFilled('passportSeries') ? <span className="text-[10px] text-primary ml-1">из базы</span> : isEmpty('passportSeries') ? <span className="text-[10px] text-destructive ml-1">заполните</span> : null}</Label>
          <Input
            value={passportVisible ? party.passportSeries : maskValue(party.passportSeries)}
            onChange={e => update('passportSeries', e.target.value)}
            readOnly={isFieldReadOnly('passportSeries') || (!passportVisible && isPreFilled('passportSeries'))}
            className={cn("text-sm font-mono", fieldHighlight('passportSeries'))}
          />
        </div>
        <div>
          <Label className="text-xs">Номер паспорта {isPreFilled('passportNumber') ? <span className="text-[10px] text-primary ml-1">из базы</span> : isEmpty('passportNumber') ? <span className="text-[10px] text-destructive ml-1">заполните</span> : null}</Label>
          <Input
            value={passportVisible ? party.passportNumber : maskValue(party.passportNumber)}
            onChange={e => update('passportNumber', e.target.value)}
            readOnly={isFieldReadOnly('passportNumber') || (!passportVisible && isPreFilled('passportNumber'))}
            className={cn("text-sm font-mono", fieldHighlight('passportNumber'))}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Кем выдан {isPreFilled('passportIssuedBy') ? <span className="text-[10px] text-primary ml-1">из базы</span> : isEmpty('passportIssuedBy') ? <span className="text-[10px] text-destructive ml-1">заполните</span> : null}</Label>
        <Input
          value={passportVisible ? party.passportIssuedBy : (party.passportIssuedBy ? '***' : '')}
          onChange={e => update('passportIssuedBy', e.target.value)}
          readOnly={isFieldReadOnly('passportIssuedBy') || (!passportVisible && isPreFilled('passportIssuedBy'))}
          className={cn("text-sm", fieldHighlight('passportIssuedBy'))}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Дата выдачи {isPreFilled('passportIssueDate') ? <span className="text-[10px] text-primary ml-1">из базы</span> : isEmpty('passportIssueDate') ? <span className="text-[10px] text-destructive ml-1">заполните</span> : null}</Label>
          <Input type="date" value={party.passportIssueDate} onChange={e => update('passportIssueDate', e.target.value)} readOnly={isFieldReadOnly('passportIssueDate')} className={cn("text-sm", fieldHighlight('passportIssueDate'))} />
        </div>
        <div>
          <Label className="text-xs">Код подразделения {isPreFilled('passportUnitCode') ? <span className="text-[10px] text-primary ml-1">из базы</span> : isEmpty('passportUnitCode') ? <span className="text-[10px] text-destructive ml-1">заполните</span> : null}</Label>
          <Input
            value={passportVisible ? party.passportUnitCode : maskValue(party.passportUnitCode)}
            onChange={e => update('passportUnitCode', e.target.value)}
            readOnly={isFieldReadOnly('passportUnitCode') || (!passportVisible && isPreFilled('passportUnitCode'))}
            className={cn("text-sm font-mono", fieldHighlight('passportUnitCode'))}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Адрес регистрации {isPreFilled('address') ? <span className="text-[10px] text-primary ml-1">из базы</span> : isEmpty('address') ? <span className="text-[10px] text-destructive ml-1">заполните</span> : null}</Label>
        <Input value={party.address} onChange={e => update('address', e.target.value)} readOnly={isFieldReadOnly('address')} className={cn("text-sm", fieldHighlight('address'))} />
      </div>

      <div>
        <Label className="text-xs">Телефон {isPreFilled('phone') ? <span className="text-[10px] text-primary ml-1">из базы</span> : isEmpty('phone') ? <span className="text-[10px] text-destructive ml-1">заполните</span> : null}</Label>
        <Input value={party.phone} onChange={e => update('phone', e.target.value)} readOnly={isFieldReadOnly('phone')} className={cn("text-sm", fieldHighlight('phone'))} />
      </div>
    </div>
  );
}