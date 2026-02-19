import { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { sanitizeFileName } from '@/lib/sanitizeFileName';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { mapDbClientToClient } from '@/lib/mappers';
import { logEventDirect } from '@/hooks/useEventLog';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeftRight, Printer, Save, Car, CarFront } from 'lucide-react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { DkpPartyForm } from './DkpPartyForm';
import { DkpPreview, DkpData, DkpParty, DkpVehicle } from './DkpPreview';
import { numberToWordsRub } from '@/lib/numberToWords';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VehicleBrandModelCombobox } from '@/components/sales/VehicleBrandModelCombobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVehicleRegistry } from '@/hooks/useVehicleRegistry';
import { markPndSigned } from '@/lib/pndConsentGenerator';
import { generateDkpHTML, generatePndHTML, generatePndBodyFragment, printDocumentHTML } from '@/lib/documentTemplates';
import { useOrganization } from '@/hooks/useOrganization';
import { saveDocumentArchive } from '@/hooks/useDocumentArchives';
import { useAuth } from '@/hooks/useAuth';

const emptyParty = (): DkpParty => ({
  fullName: '', passportSeries: '', passportNumber: '',
  passportIssuedBy: '', passportIssueDate: '', passportUnitCode: '',
  address: '', phone: '',
});

const emptyVehicle = (): DkpVehicle => ({
  brand: '', model: '', year: '', vin: '', bodyNumber: '',
  engineNumber: '', color: '', regPlate: '', ptsNumber: '',
  ptsDate: '', ptsIssuedBy: '', isEpts: false,
  stsNumber: '', stsDate: '', stsIssuedBy: '',
  vehicleType: '', vehicleCategory: '', mileage: '',
  enginePower: '', chassisNumber: '',
});

interface DkpConstructorProps {
  clientId: string;
  initialArchiveData?: Record<string, any>;
}

export interface DkpConstructorRef {
  getDocumentData: () => Record<string, any>;
  getClientUpdates: () => Record<string, any> | null;
  validateRequired: () => string[];
}

export const DkpConstructor = forwardRef<DkpConstructorRef, DkpConstructorProps>(({ clientId, initialArchiveData }, ref) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { lookupByPlate, lookupByVin } = useVehicleRegistry();
  const { org } = useOrganization();
  const [seller, setSeller] = useState<DkpParty>(emptyParty());
  const [buyer, setBuyer] = useState<DkpParty>(emptyParty());
  const [vehicle, setVehicle] = useState<DkpVehicle>(emptyVehicle());
  const [price, setPrice] = useState<number>(0);
  const [sellerPreFilled, setSellerPreFilled] = useState<Set<string>>(new Set());

  useImperativeHandle(ref, () => ({
    getDocumentData: () => ({ seller, buyer, vehicle, price, contractDate, contractCity }),
    getClientUpdates: () => {
      // Return updated client fields for write-back
      if (!client) return null;
      const updates: Record<string, any> = {};
      if (seller.passportSeries && seller.passportSeries !== (client.passportSeries || ''))
        updates.passport_series = seller.passportSeries;
      if (seller.passportNumber && seller.passportNumber !== (client.passportNumber || ''))
        updates.passport_number = seller.passportNumber;
      if (seller.passportIssuedBy && seller.passportIssuedBy !== (client.passportIssuedBy || ''))
        updates.passport_issued_by = seller.passportIssuedBy;
      if (seller.passportIssueDate && seller.passportIssueDate !== (client.passportIssueDate || ''))
        updates.passport_issue_date = seller.passportIssueDate;
      if (seller.passportUnitCode && seller.passportUnitCode !== (client.passportUnitCode || ''))
        updates.passport_unit_code = seller.passportUnitCode;
      if (seller.address && seller.address !== (client.address || ''))
        updates.address = seller.address;
      if (seller.phone && seller.phone !== (client.phone || ''))
        updates.phone = seller.phone;
      return Object.keys(updates).length > 0 ? updates : null;
    },
    validateRequired: () => {
      const missing: string[] = [];
      if (!vehicle.vin || vehicle.vin.length < 17) missing.push('VIN (17 символов)');
      if (!seller.passportSeries) missing.push('Серия паспорта продавца');
      if (!seller.passportNumber) missing.push('Номер паспорта продавца');
      if (!seller.fullName) missing.push('ФИО продавца');
      return missing;
    },
  }));
  const [contractDate, setContractDate] = useState(new Date().toISOString().slice(0, 10));
  const [contractCity, setContractCity] = useState('');

  // Fetch client (Party 1)
  const { data: client } = useQuery({
    queryKey: ['dkp-client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
      if (error) throw error;
      return mapDbClientToClient(data);
    },
  });

  // Fetch client vehicles (policies with vehicle data)
  const { data: vehicles = [] } = useQuery({
    queryKey: ['dkp-client-vehicles', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('policies')
        .select('vehicle_number, vehicle_model')
        .eq('client_id', clientId)
        .not('vehicle_number', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Deduplicate by vehicle_number
      const seen = new Set<string>();
      return (data || []).filter(v => {
        const key = v.vehicle_number?.toLowerCase().replace(/\s/g, '') || '';
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
  });

  // Auto-fill Party 1 from client + track pre-filled fields
  useEffect(() => {
    if (!client) return;
    const fullName = `${client.lastName} ${client.firstName} ${client.middleName || ''}`.trim();
    const filled = new Set<string>();
    if (fullName) filled.add('fullName');
    if (client.passportSeries) filled.add('passportSeries');
    if (client.passportNumber) filled.add('passportNumber');
    if (client.passportIssuedBy) filled.add('passportIssuedBy');
    if (client.passportIssueDate) filled.add('passportIssueDate');
    if (client.passportUnitCode) filled.add('passportUnitCode');
    if (client.address) filled.add('address');
    if (client.phone) filled.add('phone');
    setSellerPreFilled(filled);
    setSeller({
      fullName,
      passportSeries: client.passportSeries || '',
      passportNumber: client.passportNumber || '',
      passportIssuedBy: client.passportIssuedBy || '',
      passportIssueDate: client.passportIssueDate || '',
      passportUnitCode: client.passportUnitCode || '',
      address: client.address || '',
      phone: client.phone || '',
    });
  }, [client]);

  // Load from archive if provided
  useEffect(() => {
    if (!initialArchiveData) return;
    if (initialArchiveData.seller) setSeller(initialArchiveData.seller);
    if (initialArchiveData.buyer) setBuyer(initialArchiveData.buyer);
    if (initialArchiveData.vehicle) setVehicle(initialArchiveData.vehicle);
    if (initialArchiveData.price != null) setPrice(initialArchiveData.price);
    if (initialArchiveData.contractDate) setContractDate(initialArchiveData.contractDate);
    if (initialArchiveData.contractCity) setContractCity(initialArchiveData.contractCity);
  }, [initialArchiveData]);

  const handleSwapParties = () => {
    setSeller(buyer);
    setBuyer(seller);
  };

  const selectVehicle = (v: { vehicle_number: string | null; vehicle_model: string | null }) => {
    const parts = (v.vehicle_model || '').split(' ');
    setVehicle(prev => ({
      ...prev,
      brand: parts[0] || '',
      model: parts.slice(1).join(' ') || '',
      regPlate: v.vehicle_number || '',
    }));
  };

  const updateVehicle = (field: keyof DkpVehicle, value: string) => {
    if (field === 'vin') {
      // VIN mask: uppercase, max 17 alphanumeric chars
      value = value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17);
    }
    if (field === 'regPlate') {
      // Basic cleanup for Russian plate numbers
      value = value.toUpperCase().slice(0, 12);
    }
    setVehicle(prev => ({ ...prev, [field]: value }));
  };

  const handleBrandModelSelect = (brand: string, model: string) => {
    setVehicle(prev => ({ ...prev, brand, model }));
  };

  const dkpData: DkpData = { seller, buyer, vehicle, price, contractDate, contractCity };

  const ensureBrandModel = async () => {
    if (!vehicle.brand.trim()) return;
    try {
      // Check if brand+model exists
      let query = supabase.from('car_brands_models').select('id').eq('brand', vehicle.brand.trim());
      if (vehicle.model.trim()) {
        query = query.eq('model', vehicle.model.trim());
      } else {
        query = query.is('model', null);
      }
      const { data } = await query.limit(1);
      if (!data || data.length === 0) {
        await supabase.from('car_brands_models').insert({
          brand: vehicle.brand.trim(),
          model: vehicle.model.trim() || null,
        });
      }
    } catch (err) {
      console.error('Ensure brand/model error:', err);
    }
  };

  const buildPndConsentData = (party: DkpParty) => ({
    clientName: party.fullName,
    passportSeries: party.passportSeries,
    passportNumber: party.passportNumber,
    passportIssuedBy: party.passportIssuedBy,
    passportIssueDate: party.passportIssueDate,
    address: party.address,
    phone: party.phone,
    organizationName: org?.name || 'Организация',
    organizationInn: org?.inn || undefined,
    organizationAddress: org?.address || undefined,
    date: contractDate || new Date().toISOString().slice(0, 10),
  });

  const handlePrint = async (includePnd = false) => {
    await ensureCounterparty();
    await ensureBrandModel();
    await logEvent();

    // If printing with PND, mark BOTH parties as signed
    if (includePnd) {
      try { await markPndSigned(clientId); } catch {}
      if (buyer.phone) {
        try {
          const digits = buyer.phone.replace(/\D/g, '');
          if (digits.length >= 10) {
            const last10 = digits.slice(-10);
            const { data: found } = await supabase.from('clients').select('id').ilike('phone', `%${last10}%`).limit(1);
            if (found && found.length > 0) await markPndSigned(found[0].id);
          }
        } catch {}
      }
    }

    // Use unified template generator
    const dkpHtml = generateDkpHTML({ seller, buyer, vehicle, price, contractDate, contractCity });

    const pndPageHtml = includePnd ? `
      <div style="page-break-before: always;"></div>
      <p style="text-align: center; font-size: 11px; color: #999; margin-bottom: 4px; font-family: 'Times New Roman', serif;">Согласие Продавца (Сторона 1)</p>
      ${generatePndBodyFragment(buildPndConsentData(seller))}
      <div style="page-break-before: always;"></div>
      <p style="text-align: center; font-size: 11px; color: #999; margin-bottom: 4px; font-family: 'Times New Roman', serif;">Согласие Покупателя (Сторона 2)</p>
      ${generatePndBodyFragment(buildPndConsentData(buyer))}
    ` : '';

    // Inject PND pages into the DKP HTML before closing </body>
    const finalHtml = dkpHtml.replace('</body></html>', `${pndPageHtml}</body></html>`);

    printDocumentHTML(finalHtml);

    // Save DKP snapshot to archives
    saveDocumentArchive({
      clientId,
      type: 'dkp',
      documentData: { seller, buyer, vehicle, price, contractDate, contractCity, includePnd },
      userId: user?.id,
    });

    // If printing PND, also save PND snapshots
    if (includePnd) {
      saveDocumentArchive({
        clientId,
        type: 'pnd',
        documentData: buildPndConsentData(seller),
        userId: user?.id,
      });
      saveDocumentArchive({
        clientId,
        type: 'pnd',
        documentData: buildPndConsentData(buyer),
        userId: user?.id,
      });
    }
  };

  const handleSave = async () => {
    await ensureCounterparty();
    await ensureBrandModel();
    await logEvent();
    
    // Generate HTML content of the preview
    const el = document.getElementById('dkp-print-area');
    if (!el) return;
    const htmlContent = el.outerHTML;

    // Save as document for client
    try {
      const rawName = `ДКП_${seller.fullName}_${buyer.fullName}_${contractDate}.html`;
      const fileName = sanitizeFileName(rawName);
      const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:"Times New Roman",serif;}</style></head><body>${htmlContent}</body></html>`], { type: 'text/html' });
      const filePath = `${clientId}/${Date.now()}_${fileName}`;
      
      const { error: uploadError } = await supabase.storage.from('client-documents').upload(filePath, blob);
      if (uploadError) throw uploadError;

      await supabase.from('client_documents').insert({
        client_id: clientId,
        file_name: fileName,
        file_path: filePath,
        document_type: 'contract',
        mime_type: 'text/html',
        file_size: blob.size,
      });

      toast({ title: 'Сохранено', description: 'ДКП сохранён в документы клиента' });
    } catch (err: any) {
      console.error('Save DKP error:', err);
      toast({ title: 'Ошибка сохранения', description: err?.message || 'Не удалось сохранить документ', variant: 'destructive' });
    }
  };

  const logEvent = async () => {
    try {
      await logEventDirect({
        action: 'create',
        category: 'clients',
        entityType: 'dkp',
        entityId: clientId,
        clientId,
        newValue: `Сформирован ДКП между ${seller.fullName} и ${buyer.fullName}. ТС: ${vehicle.brand} ${vehicle.model} (${vehicle.regPlate || 'б/н'}). Сумма: ${price.toLocaleString('ru-RU')} руб.`,
        details: { section: 'ДКП', seller: seller.fullName, buyer: buyer.fullName, price, vehicle: `${vehicle.brand} ${vehicle.model}`, regPlate: vehicle.regPlate, vin: vehicle.vin },
      });
    } catch {}
  };

  const ensureCounterparty = async () => {
    if (!buyer.phone && !buyer.passportNumber) return;

    try {
      const nameParts = buyer.fullName.split(' ');
      const lastName = nameParts[0] || 'Не указано';
      const firstName = nameParts[1] || 'Не указано';
      const middleName = nameParts.slice(2).join(' ') || null;

      // 1. Try to find existing client by phone
      let existingId: string | null = null;
      if (buyer.phone) {
        const digits = buyer.phone.replace(/\D/g, '');
        if (digits.length >= 10) {
          const last10 = digits.slice(-10);
          const { data: found } = await supabase
            .from('clients')
            .select('id')
            .ilike('phone', `%${last10}%`)
            .limit(1);
          if (found && found.length > 0) {
            existingId = found[0].id;
          }
        }
      }

      // 2. Build client payload — nullify empty dates
      const clientPayload: Record<string, any> = {
        last_name: lastName,
        first_name: firstName,
        middle_name: middleName,
        phone: buyer.phone || '0000000000',
        passport_series: buyer.passportSeries || null,
        passport_number: buyer.passportNumber || null,
        passport_issued_by: buyer.passportIssuedBy || null,
        passport_issue_date: buyer.passportIssueDate?.trim() || null,
        passport_unit_code: buyer.passportUnitCode || null,
        address: buyer.address || null,
        is_pnd_signed: true,
        pnd_signed_date: new Date().toISOString().split('T')[0],
      };

      if (existingId) {
        // 3a. Update existing client
        clientPayload.id = existingId;
        const { error } = await supabase
          .from('clients')
          .upsert(clientPayload as any, { onConflict: 'id' });
        if (error) {
          if (error.message?.includes('duplicate key')) {
            toast({ title: 'Клиент найден', description: 'Этот клиент уже есть в базе. Данные обновлены.' });
          } else {
            toast({ title: 'Ошибка сохранения', description: error.message, variant: 'destructive' });
          }
        } else {
          toast({ title: 'Обновлено', description: `Данные ${buyer.fullName} обновлены` });
        }
      } else {
        // 3b. Insert new client
        const { error } = await supabase.from('clients').insert(clientPayload as any);
        if (error) {
          if (error.message?.includes('duplicate key')) {
            toast({ title: 'Клиент найден', description: 'Этот клиент уже есть в базе. Данные обновлены.' });
          } else {
            toast({ title: 'Ошибка создания клиента', description: error.message, variant: 'destructive' });
          }
        } else {
          toast({ title: 'Клиент создан', description: `${buyer.fullName} добавлен в базу` });
        }
      }
    } catch (err: any) {
      console.error('Counterparty check error:', err);
      toast({ title: 'Ошибка', description: err?.message || 'Ошибка при проверке контрагента', variant: 'destructive' });
    }
  };

  return (
    <div className="h-full flex flex-col print:block">
      {/* Toolbar — hidden on print */}
      <div className="flex items-center gap-2 p-3 border-b border-border shrink-0 print:hidden">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSwapParties}>
          <ArrowLeftRight className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Поменять местами</span>
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSave}>
          <Save className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Сохранить</span>
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handlePrint(false)}>
          <Printer className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Печать ДКП</span>
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => handlePrint(true)}>
          <Printer className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">ДКП + Согласие ПДН</span>
        </Button>
      </div>

      {/* Split view */}
      <div className="flex-1 min-h-0 print:block">
        <ResizablePanelGroup direction="horizontal" className="h-full print:block">
          {/* Left: Form */}
          <ResizablePanel defaultSize={45} minSize={30} className="print:hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-5">
                {/* Party 1 — Seller */}
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm">Сторона 1 (Продавец)</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <DkpPartyForm title="" party={seller} onChange={setSeller} preFilledFields={sellerPreFilled} />
                  </CardContent>
                </Card>

                {/* Vehicle */}
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Данные ТС</CardTitle>
                      {vehicles.length > 0 && (
                        <Select onValueChange={(idx) => selectVehicle(vehicles[Number(idx)])}>
                          <SelectTrigger className="w-auto h-7 text-xs gap-1">
                            <CarFront className="h-3 w-3" />
                            <SelectValue placeholder="Из авто клиента" />
                          </SelectTrigger>
                          <SelectContent>
                            {vehicles.map((v, i) => (
                              <SelectItem key={i} value={String(i)} className="text-xs">
                                {v.vehicle_number} {v.vehicle_model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Марка / Модель</Label>
                        <VehicleBrandModelCombobox
                          brandValue={vehicle.brand}
                          modelValue={vehicle.model}
                          onSelect={handleBrandModelSelect}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Год</Label>
                        <Input value={vehicle.year} onChange={e => updateVehicle('year', e.target.value)} className="h-7 text-xs" placeholder="2020" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">VIN (17 знаков)</Label>
                        <Input value={vehicle.vin} onChange={e => updateVehicle('vin', e.target.value)} className="h-7 text-xs font-mono" placeholder="XXXXXXXXXXXXXXXXX" maxLength={17} />
                      </div>
                      <div>
                        <Label className="text-xs">Гос. номер</Label>
                        <Input value={vehicle.regPlate} onChange={e => updateVehicle('regPlate', e.target.value)} className="h-7 text-xs font-mono" placeholder="А000АА000" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Тип ТС</Label>
                        <Input value={vehicle.vehicleType} onChange={e => updateVehicle('vehicleType', e.target.value)} className="h-7 text-xs" placeholder="Легковой" />
                      </div>
                      <div>
                        <Label className="text-xs">Категория</Label>
                        <Input value={vehicle.vehicleCategory} onChange={e => updateVehicle('vehicleCategory', e.target.value)} className="h-7 text-xs" placeholder="B" />
                      </div>
                      <div>
                        <Label className="text-xs">Пробег (км)</Label>
                        <Input value={vehicle.mileage} onChange={e => updateVehicle('mileage', e.target.value)} className="h-7 text-xs" placeholder="100000" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Цвет кузова</Label>
                      <Input value={vehicle.color} onChange={e => updateVehicle('color', e.target.value)} className="h-7 text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Мощность и объём двигателя</Label>
                        <Input value={vehicle.enginePower} onChange={e => updateVehicle('enginePower', e.target.value)} className="h-7 text-xs" placeholder="150 л.с. / 2.0 л" />
                      </div>
                      <div>
                        <Label className="text-xs">Модель и номер двигателя</Label>
                        <Input value={vehicle.engineNumber} onChange={e => updateVehicle('engineNumber', e.target.value)} className="h-7 text-xs font-mono" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-xs">Номер шасси (рамы)</Label><Input value={vehicle.chassisNumber} onChange={e => updateVehicle('chassisNumber', e.target.value)} className="h-7 text-xs font-mono" /></div>
                      <div><Label className="text-xs">Номер кузова</Label><Input value={vehicle.bodyNumber} onChange={e => updateVehicle('bodyNumber', e.target.value)} className="h-7 text-xs font-mono" /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 items-end">
                      <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Label className="text-xs">{vehicle.isEpts ? 'ЭПТС' : 'ПТС'}</Label>
                          <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                            <input type="checkbox" checked={vehicle.isEpts} onChange={e => setVehicle(prev => ({ ...prev, isEpts: e.target.checked }))} className="h-3 w-3" />
                            ЭПТС
                          </label>
                        </div>
                        <Input value={vehicle.ptsNumber} onChange={e => updateVehicle('ptsNumber', e.target.value)} className="h-7 text-xs" placeholder="Серия номер" />
                      </div>
                      <div>
                        <Label className="text-xs">Дата выдачи</Label>
                        <Input type="date" value={vehicle.ptsDate} onChange={e => updateVehicle('ptsDate', e.target.value)} className="h-7 text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs">Кем выдан</Label>
                        <Input value={vehicle.ptsIssuedBy} onChange={e => updateVehicle('ptsIssuedBy', e.target.value)} className="h-7 text-xs" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">СТС</Label>
                        <Input value={vehicle.stsNumber} onChange={e => updateVehicle('stsNumber', e.target.value)} className="h-7 text-xs" placeholder="Серия номер" />
                      </div>
                      <div>
                        <Label className="text-xs">Дата выдачи</Label>
                        <Input type="date" value={vehicle.stsDate} onChange={e => updateVehicle('stsDate', e.target.value)} className="h-7 text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs">Кем выдан</Label>
                        <Input value={vehicle.stsIssuedBy} onChange={e => updateVehicle('stsIssuedBy', e.target.value)} className="h-7 text-xs" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Party 2 — Buyer */}
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm">Сторона 2 (Покупатель)</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <DkpPartyForm title="" party={buyer} onChange={setBuyer} showSmartParser showClientSearch />
                  </CardContent>
                </Card>

                {/* Price & Date */}
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm">Условия договора</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    <div>
                      <Label className="text-xs">Цена (руб.)</Label>
                      <Input
                        type="number"
                        value={price || ''}
                        onChange={e => setPrice(Number(e.target.value) || 0)}
                        className="text-sm"
                      />
                      {price > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          {numberToWordsRub(price)}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Дата договора</Label>
                        <Input type="date" value={contractDate} onChange={e => setContractDate(e.target.value)} className="text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs">Место составления</Label>
                        <Input value={contractCity} onChange={e => setContractCity(e.target.value)} placeholder="г. Москва" className="text-sm" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </ResizablePanel>

          <ResizableHandle withHandle className="print:hidden" />

          {/* Right: Live Preview */}
          <ResizablePanel defaultSize={55} minSize={35}>
            <ScrollArea className="h-full bg-muted/30 print:bg-white">
              <div className="p-6 print:p-0">
                <DkpPreview data={dkpData} />
              </div>
            </ScrollArea>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
});

DkpConstructor.displayName = 'DkpConstructor';
