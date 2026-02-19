import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Wand2, UserCheck } from 'lucide-react';
import { parseClientData } from '@/lib/clientDataParser';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { EuroParticipant, CIRCUMSTANCES_LIST } from '@/types/europrotocol';

interface ClientSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  phone: string;
  address: string | null;
  passport_series: string | null;
  passport_number: string | null;
}

interface VehicleSearchResult {
  id: string;
  plate_number: string | null;
  vin_code: string | null;
  brand_name: string;
  model_name: string | null;
  year: number | null;
  color: string | null;
}

interface EuroParticipantFormProps {
  title: string;
  participant: EuroParticipant;
  onChange: (p: EuroParticipant) => void;
}

export function EuroParticipantForm({ title, participant, onChange }: EuroParticipantFormProps) {
  const [smartText, setSmartText] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([]);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleResults, setVehicleResults] = useState<VehicleSearchResult[]>([]);
  const [vehicleSearchOpen, setVehicleSearchOpen] = useState(false);
  const clientRef = useRef<HTMLDivElement>(null);
  const vehicleRef = useRef<HTMLDivElement>(null);

  const update = (field: keyof EuroParticipant, value: any) => {
    onChange({ ...participant, [field]: value });
  };

  // Smart parser
  const handleSmartParse = () => {
    if (!smartText.trim()) return;
    const parsed = parseClientData(smartText);
    const fullName = `${parsed.lastName} ${parsed.firstName} ${parsed.middleName}`.trim();
    onChange({
      ...participant,
      ownerFullName: fullName || participant.ownerFullName,
      ownerAddress: parsed.address || participant.ownerAddress,
      ownerPhone: parsed.phone || participant.ownerPhone,
      ownerEmail: parsed.email || participant.ownerEmail,
      driverFullName: fullName || participant.driverFullName,
      driverAddress: parsed.address || participant.driverAddress,
    });
    setSmartText('');
  };

  // Client search
  const searchClients = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setClientResults([]); return; }
    try {
      const isDigits = /^\d+$/.test(q.replace(/[\s\-\+\(\)]/g, ''));
      let query = supabase.from('clients').select('id, first_name, last_name, middle_name, phone, address, passport_series, passport_number').limit(10);
      if (isDigits) {
        query = query.ilike('phone', `%${q.replace(/\D/g, '')}%`);
      } else {
        const parts = q.trim().split(/\s+/);
        if (parts.length >= 2) {
          query = query.ilike('last_name', `%${parts[0]}%`).ilike('first_name', `%${parts[1]}%`);
        } else {
          query = query.or(`last_name.ilike.%${parts[0]}%,first_name.ilike.%${parts[0]}%`);
        }
      }
      const { data } = await query;
      setClientResults((data || []) as ClientSearchResult[]);
    } catch { setClientResults([]); }
  }, []);

  useEffect(() => {
    if (!clientSearchOpen) return;
    const t = setTimeout(() => searchClients(clientSearch), 250);
    return () => clearTimeout(t);
  }, [clientSearch, clientSearchOpen, searchClients]);

  const selectClient = (c: ClientSearchResult) => {
    const fullName = `${c.last_name} ${c.first_name} ${c.middle_name || ''}`.trim();
    onChange({
      ...participant,
      ownerFullName: fullName,
      ownerAddress: c.address || '',
      ownerPhone: c.phone || '',
      driverFullName: fullName,
      driverAddress: c.address || '',
    });
    setClientSearchOpen(false);
    setClientSearch('');
  };

  // Vehicle search
  const searchVehicles = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setVehicleResults([]); return; }
    try {
      const { data } = await supabase
        .from('vehicle_registry')
        .select('id, plate_number, vin_code, brand_name, model_name, year, color')
        .or(`plate_number.ilike.%${q}%,vin_code.ilike.%${q}%,brand_name.ilike.%${q}%`)
        .limit(10);
      setVehicleResults((data || []) as VehicleSearchResult[]);
    } catch { setVehicleResults([]); }
  }, []);

  useEffect(() => {
    if (!vehicleSearchOpen) return;
    const t = setTimeout(() => searchVehicles(vehicleSearch), 250);
    return () => clearTimeout(t);
  }, [vehicleSearch, vehicleSearchOpen, searchVehicles]);

  const selectVehicle = (v: VehicleSearchResult) => {
    onChange({
      ...participant,
      vehicleBrand: v.brand_name,
      vehicleModel: v.model_name || '',
      vehicleVin: v.vin_code || '',
      vehiclePlate: v.plate_number || '',
      vehicleYear: v.year?.toString() || '',
      vehicleColor: v.color || '',
    });
    setVehicleSearchOpen(false);
    setVehicleSearch('');
  };

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) setClientSearchOpen(false);
      if (vehicleRef.current && !vehicleRef.current.contains(e.target as Node)) setVehicleSearchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleCircumstance = (idx: number) => {
    const current = participant.circumstances;
    if (current.includes(idx)) {
      update('circumstances', current.filter(c => c !== idx));
    } else {
      update('circumstances', [...current, idx]);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground border-b border-border pb-1">{title}</h3>

      {/* Smart parser */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Умный парсер — вставьте данные из СТС / мессенджера</Label>
        <div className="flex gap-2">
          <Textarea value={smartText} onChange={e => setSmartText(e.target.value)} placeholder="Вставьте ФИО, адрес, телефон, VIN, полис..." className="min-h-[50px] text-xs" />
          <Button type="button" variant="outline" size="icon" className="shrink-0 h-[50px] w-10" onClick={handleSmartParse}>
            <Wand2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Client search */}
      <div ref={clientRef} className="relative">
        <Label className="text-xs text-muted-foreground">Поиск клиента в базе</Label>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input value={clientSearch} onChange={e => { setClientSearch(e.target.value); setClientSearchOpen(true); }} onFocus={() => { if (clientSearch.length >= 2) setClientSearchOpen(true); }} className="h-8 text-xs pl-7" placeholder="ФИО или телефон..." />
        </div>
        {clientSearchOpen && clientResults.length > 0 && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-[180px] overflow-y-auto rounded-md border bg-popover shadow-lg">
            {clientResults.map(c => (
              <div key={c.id} className="px-3 py-1.5 text-xs cursor-pointer flex items-center gap-2 hover:bg-accent" onClick={() => selectClient(c)}>
                <UserCheck className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="font-medium">{c.last_name} {c.first_name}</span>
                <span className="text-muted-foreground ml-auto truncate">{c.phone}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Owner fields */}
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">ФИО собственника</Label><Input value={participant.ownerFullName} onChange={e => update('ownerFullName', e.target.value)} className="h-8 text-xs" /></div>
        <div><Label className="text-xs">Телефон</Label><Input value={participant.ownerPhone} onChange={e => update('ownerPhone', e.target.value)} className="h-8 text-xs" /></div>
      </div>
      <div><Label className="text-xs">Адрес собственника</Label><Input value={participant.ownerAddress} onChange={e => update('ownerAddress', e.target.value)} className="h-8 text-xs" /></div>

      {/* Vehicle search */}
      <div ref={vehicleRef} className="relative">
        <Label className="text-xs text-muted-foreground">Поиск ТС в базе (гос. номер / VIN)</Label>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input value={vehicleSearch} onChange={e => { setVehicleSearch(e.target.value); setVehicleSearchOpen(true); }} onFocus={() => { if (vehicleSearch.length >= 2) setVehicleSearchOpen(true); }} className="h-8 text-xs pl-7" placeholder="А123БВ777 или XTA..." />
        </div>
        {vehicleSearchOpen && vehicleResults.length > 0 && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-[180px] overflow-y-auto rounded-md border bg-popover shadow-lg">
            {vehicleResults.map(v => (
              <div key={v.id} className="px-3 py-1.5 text-xs cursor-pointer flex items-center gap-2 hover:bg-accent" onClick={() => selectVehicle(v)}>
                <span className="font-mono font-medium">{v.plate_number || v.vin_code}</span>
                <span className="text-muted-foreground">{v.brand_name} {v.model_name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vehicle fields */}
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-xs">Марка</Label><Input value={participant.vehicleBrand} onChange={e => update('vehicleBrand', e.target.value)} className="h-8 text-xs" /></div>
        <div><Label className="text-xs">Модель</Label><Input value={participant.vehicleModel} onChange={e => update('vehicleModel', e.target.value)} className="h-8 text-xs" /></div>
        <div><Label className="text-xs">Гос. номер</Label><Input value={participant.vehiclePlate} onChange={e => update('vehiclePlate', e.target.value.toUpperCase())} className="h-8 text-xs font-mono" /></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-xs">VIN</Label><Input value={participant.vehicleVin} onChange={e => update('vehicleVin', e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17))} className="h-8 text-xs font-mono" /></div>
        <div><Label className="text-xs">Год</Label><Input value={participant.vehicleYear} onChange={e => update('vehicleYear', e.target.value)} className="h-8 text-xs" /></div>
        <div><Label className="text-xs">Цвет</Label><Input value={participant.vehicleColor} onChange={e => update('vehicleColor', e.target.value)} className="h-8 text-xs" /></div>
      </div>
      <div><Label className="text-xs">СТС (серия и номер)</Label><Input value={participant.stsNumber} onChange={e => update('stsNumber', e.target.value)} className="h-8 text-xs font-mono" /></div>

      {/* Insurance */}
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Страховая компания</Label><Input value={participant.insuranceCompany} onChange={e => update('insuranceCompany', e.target.value)} className="h-8 text-xs" /></div>
        <div><Label className="text-xs">Полис (серия + номер)</Label>
          <div className="flex gap-1">
            <Input value={participant.policySeries} onChange={e => update('policySeries', e.target.value)} className="h-8 text-xs w-20 font-mono" placeholder="ХХХ" />
            <Input value={participant.policyNumber} onChange={e => update('policyNumber', e.target.value)} className="h-8 text-xs flex-1 font-mono" placeholder="0000000000" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Полис с</Label><Input type="date" value={participant.policyStartDate} onChange={e => update('policyStartDate', e.target.value)} className="h-8 text-xs" /></div>
        <div><Label className="text-xs">Полис по</Label><Input type="date" value={participant.policyEndDate} onChange={e => update('policyEndDate', e.target.value)} className="h-8 text-xs" /></div>
      </div>

      {/* Driver */}
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">ФИО водителя (если ≠ собственник)</Label><Input value={participant.driverFullName} onChange={e => update('driverFullName', e.target.value)} className="h-8 text-xs" placeholder="Совпадает с собственником" /></div>
        <div><Label className="text-xs">Дата рождения водителя</Label><Input type="date" value={participant.driverBirthDate} onChange={e => update('driverBirthDate', e.target.value)} className="h-8 text-xs" /></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-xs">ВУ (номер)</Label><Input value={participant.driverLicenseNumber} onChange={e => update('driverLicenseNumber', e.target.value)} className="h-8 text-xs font-mono" /></div>
        <div><Label className="text-xs">Категория</Label><Input value={participant.driverLicenseCategory} onChange={e => update('driverLicenseCategory', e.target.value)} className="h-8 text-xs" placeholder="B" /></div>
        <div><Label className="text-xs">ВУ до</Label><Input type="date" value={participant.driverLicenseExpiry} onChange={e => update('driverLicenseExpiry', e.target.value)} className="h-8 text-xs" /></div>
      </div>

      {/* Circumstances */}
      <div>
        <Label className="text-xs font-semibold">Обстоятельства ДТП</Label>
        <div className="grid grid-cols-1 gap-0.5 mt-1 max-h-[200px] overflow-y-auto border border-border rounded-md p-2">
          {CIRCUMSTANCES_LIST.map((c, i) => (
            <label key={i} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 px-1 py-0.5 rounded">
              <Checkbox checked={participant.circumstances.includes(i)} onCheckedChange={() => toggleCircumstance(i)} className="h-3.5 w-3.5" />
              <span>{i + 1}. {c}</span>
            </label>
          ))}
        </div>
        <div className="text-xs text-muted-foreground mt-1">Отмечено: {participant.circumstances.length}</div>
      </div>

      {/* Damage */}
      <div>
        <Label className="text-xs">Повреждения ТС</Label>
        <Textarea value={participant.damageDescription} onChange={e => update('damageDescription', e.target.value)} className="min-h-[50px] text-xs" placeholder="Опишите видимые повреждения..." />
      </div>

      <div>
        <Label className="text-xs">Замечания (п.10)</Label>
        <Textarea value={participant.remarks} onChange={e => update('remarks', e.target.value)} className="min-h-[40px] text-xs" placeholder="Дополнительные замечания..." />
      </div>

      {/* Back side fields */}
      <div className="border-t border-border pt-3 mt-2">
        <h4 className="text-xs font-bold text-muted-foreground mb-2">Оборотная сторона</h4>

        {/* п.16 — Управление */}
        <div className="space-y-1 mb-3">
          <Label className="text-xs font-semibold">П.16. ТС находилось под управлением:</Label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox checked={participant.driverIsOwner} onCheckedChange={() => update('driverIsOwner', true)} className="h-3.5 w-3.5" />
            <span>Собственника ТС</span>
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox checked={!participant.driverIsOwner} onCheckedChange={() => update('driverIsOwner', false)} className="h-3.5 w-3.5" />
            <span>Иного лица, допущенного к управлению ТС</span>
          </label>
        </div>

        {/* п.17 — Передвижение */}
        <div className="space-y-1 mb-3">
          <Label className="text-xs font-semibold">П.17. Может ли ТС передвигаться своим ходом?</Label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox checked={participant.canMove} onCheckedChange={() => update('canMove', true)} className="h-3.5 w-3.5" />
              <span>Да</span>
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox checked={!participant.canMove} onCheckedChange={() => update('canMove', false)} className="h-3.5 w-3.5" />
              <span>Нет</span>
            </label>
          </div>
          {!participant.canMove && (
            <div className="mt-1">
              <Label className="text-xs text-destructive">Где сейчас находится ТС? *</Label>
              <Input value={participant.vehicleLocation} onChange={e => update('vehicleLocation', e.target.value)} className="h-8 text-xs" placeholder="Адрес местонахождения ТС..." />
            </div>
          )}
        </div>

        {/* п.18 — Примечания и разногласия */}
        <div>
          <Label className="text-xs font-semibold">П.18. Примечания участника ДТП, в том числе разногласия</Label>
          <Textarea value={participant.backRemarks} onChange={e => update('backRemarks', e.target.value)} className="min-h-[60px] text-xs mt-1" placeholder="Опишите разногласия, дополнительные обстоятельства..." />
        </div>
      </div>
    </div>
  );
}
