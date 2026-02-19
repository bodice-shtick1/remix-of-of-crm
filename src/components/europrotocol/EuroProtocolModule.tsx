/**
 * EuroProtocolModule — Self-contained Europrotocol (Form №155 RSA) module.
 * All styles are scoped. Printing uses a hidden iframe to avoid conflicts.
 */
import { useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { sanitizeFileName } from '@/lib/sanitizeFileName';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { saveDocumentArchive } from '@/hooks/useDocumentArchives';
import { logEventDirect } from '@/hooks/useEventLog';
import { useOrganization } from '@/hooks/useOrganization';
import { generatePndBodyFragment, printDocumentHTML } from '@/lib/documentTemplates';
import type { PndTemplateData } from '@/lib/documentTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Printer, Save, ChevronLeft, ChevronRight, Camera, X, CheckCircle2, FileText } from 'lucide-react';
import { EuroprotocolData, emptyEuroprotocolData } from '@/types/europrotocol';
import { EuroParticipantForm } from './EuroParticipantForm';
import { buildEuroprotocolHTML } from './europrotocolHtmlBuilder';

interface EuroProtocolModuleProps {
  clientId?: string;
  initialArchiveData?: Record<string, any>;
}

export interface EuroProtocolModuleRef {
  getDocumentData: () => Record<string, any>;
}

const STEPS = [
  { id: 'accident', label: 'Данные о ДТП' },
  { id: 'participantA', label: 'Участник А' },
  { id: 'participantB', label: 'Участник Б' },
  { id: 'sketch', label: 'Схема и фото' },
];

export const EuroProtocolModule = forwardRef<EuroProtocolModuleRef, EuroProtocolModuleProps>(({ clientId, initialArchiveData }, ref) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { org } = useOrganization();
  const [data, setData] = useState<EuroprotocolData>(() => {
    if (initialArchiveData) return { ...emptyEuroprotocolData(), ...initialArchiveData } as EuroprotocolData;
    return emptyEuroprotocolData();
  });
  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    getDocumentData: () => ({ ...data }),
  }));

  const updateData = useCallback(<K extends keyof EuroprotocolData>(key: K, value: EuroprotocolData[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

  const nextStep = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const prevStep = () => setStep(s => Math.max(s - 1, 0));

  // Photo upload
  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newPhotos: string[] = [];
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const path = `europrotocol/${Date.now()}_${sanitizeFileName(file.name)}`;
        const { error } = await supabase.storage.from('client-documents').upload(path, file);
        if (error) { console.error('Upload error:', error); continue; }
        const { data: urlData } = supabase.storage.from('client-documents').getPublicUrl(path);
        if (urlData?.publicUrl) newPhotos.push(urlData.publicUrl);
      }
      if (newPhotos.length > 0) {
        updateData('photos', [...data.photos, ...newPhotos]);
        toast({ title: `Загружено ${newPhotos.length} фото` });
      }
    } catch (err: any) {
      toast({ title: 'Ошибка загрузки', description: err?.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (idx: number) => {
    updateData('photos', data.photos.filter((_, i) => i !== idx));
  };

  // Build full standalone HTML for printing / snapshot
  const buildFullHTML = (): string => {
    const formHtml = buildEuroprotocolHTML(data);

    const buildPnd = (p: EuroprotocolData['participantA']) => generatePndBodyFragment({
      clientName: p.ownerFullName,
      passportSeries: '',
      passportNumber: '',
      passportIssuedBy: '',
      passportIssueDate: '',
      address: p.ownerAddress,
      phone: p.ownerPhone,
      organizationName: org?.name || 'Организация',
      organizationInn: org?.inn || undefined,
      organizationAddress: org?.address || undefined,
      date: data.accidentDate || new Date().toISOString().slice(0, 10),
    });

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Европротокол — ${data.accidentDate}</title>
<style>
@page { size: A4 portrait; margin: 0; }
@media print {
  html, body { margin:0; padding:0; width:210mm; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
@media screen {
  body { background: #e0e0e0; }
}
html, body { margin:0; padding:0; background:white; font-family: Arial, sans-serif; font-size: 11px; }
</style>
</head><body>
${formHtml}
<div style="page-break-before:always;width:210mm;height:297mm;margin:0;padding:10mm;box-sizing:border-box;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;font-size:11px">
<p style="text-align:center;font-size:11px;color:#999;margin-bottom:4px;">Согласие на обработку ПДН — Участник А</p>
${buildPnd(data.participantA)}
</div>
<div style="page-break-before:always;width:210mm;height:297mm;margin:0;padding:10mm;box-sizing:border-box;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;font-size:11px">
<p style="text-align:center;font-size:11px;color:#999;margin-bottom:4px;">Согласие на обработку ПДН — Участник В</p>
${buildPnd(data.participantB)}
</div>
</body></html>`;
  };

  // Print via new browser tab
  const handlePrint = async () => {
    const html = buildFullHTML();

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: 'Ошибка', description: 'Не удалось открыть окно печати. Разрешите всплывающие окна.', variant: 'destructive' });
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for images/render, then print and close
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.onafterprint = () => printWindow.close();
      }, 300);
    };

    // Also trigger after a fallback timeout (for browsers that fire onload early)
    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (_) { /* window may already be closed */ }
    }, 1000);

    // Save archive on print
    const effectiveClientId = clientId || 'europrotocol';
    await saveDocumentArchive({
      clientId: effectiveClientId,
      type: 'europrotocol' as any,
      documentData: { ...data, _type: 'europrotocol', _htmlSnapshot: html },
      userId: user?.id,
    });

    logEventDirect({
      action: 'create',
      category: 'clients',
      entityType: 'europrotocol',
      entityId: effectiveClientId,
      clientId: effectiveClientId !== 'europrotocol' ? effectiveClientId : undefined,
      newValue: `Европротокол: ${data.participantA.ownerFullName} vs ${data.participantB.ownerFullName}`,
    } as any);
  };

  // Ensure new clients / vehicles in DB
  const ensureParticipantInDb = async (p: EuroprotocolData['participantA']) => {
    if (!p.ownerFullName.trim() || !p.ownerPhone.trim()) return;
    try {
      const digits = p.ownerPhone.replace(/\D/g, '');
      if (digits.length < 10) return;
      const last10 = digits.slice(-10);
      const { data: found } = await supabase.from('clients').select('id').ilike('phone', `%${last10}%`).limit(1);
      if (!found || found.length === 0) {
        const parts = p.ownerFullName.trim().split(/\s+/);
        await supabase.from('clients').insert({
          last_name: parts[0] || 'Не указано',
          first_name: parts[1] || 'Не указано',
          middle_name: parts.slice(2).join(' ') || null,
          phone: p.ownerPhone,
          address: p.ownerAddress || null,
        } as any);
      }

      if (p.vehicleVin && p.vehicleVin.length >= 10) {
        const { data: existVeh } = await supabase.from('vehicle_registry').select('id').ilike('vin_code', p.vehicleVin).limit(1);
        if (!existVeh || existVeh.length === 0) {
          await supabase.from('vehicle_registry').insert({
            vin_code: p.vehicleVin,
            plate_number: p.vehiclePlate || null,
            brand_name: p.vehicleBrand || 'Не указано',
            model_name: p.vehicleModel || null,
            year: p.vehicleYear ? parseInt(p.vehicleYear) : null,
            color: p.vehicleColor || null,
          } as any);
        }
      }
    } catch (err) {
      console.error('Ensure participant in DB error:', err);
    }
  };

  // Save HTML snapshot
  const handleSave = async () => {
    await ensureParticipantInDb(data.participantA);
    await ensureParticipantInDb(data.participantB);

    const effectiveClientId = clientId || 'europrotocol';
    const html = buildFullHTML();

    try {
      const rawName = `Европротокол_${data.accidentDate}_${data.participantA.vehiclePlate}_${data.participantB.vehiclePlate}.html`;
      const fileName = sanitizeFileName(rawName);
      const blob = new Blob([html], { type: 'text/html' });
      const filePath = `${effectiveClientId}/${Date.now()}_${fileName}`;

      const { error: uploadError } = await supabase.storage.from('client-documents').upload(filePath, blob);
      if (uploadError) throw uploadError;

      if (effectiveClientId !== 'europrotocol') {
        await supabase.from('client_documents').insert({
          client_id: effectiveClientId,
          file_name: fileName,
          file_path: filePath,
          document_type: 'europrotocol',
          mime_type: 'text/html',
          file_size: blob.size,
        });
      }

      await saveDocumentArchive({
        clientId: effectiveClientId,
        type: 'europrotocol' as any,
        documentData: { ...data, _type: 'europrotocol', _htmlSnapshot: html },
        userId: user?.id,
      });

      toast({ title: 'Сохранено', description: 'Европротокол сохранён' });
    } catch (err: any) {
      toast({ title: 'Ошибка сохранения', description: err?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="h-full flex flex-col">

      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-border shrink-0">
        <FileText className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Европротокол (Форма №155 РСА)</span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSave}>
          <Save className="h-3.5 w-3.5" />
          Сохранить
        </Button>
        <Button size="sm" className="gap-1.5" onClick={handlePrint}>
          <Printer className="h-3.5 w-3.5" />
          Печать
        </Button>
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left: Stepper + Form */}
        <ResizablePanel defaultSize={45} minSize={30}>
          <div className="h-full flex flex-col">
            {/* Stepper */}
            <div className="flex items-center gap-1 px-4 py-3 border-b border-border bg-muted/30">
              {STEPS.map((s, i) => (
                <button key={s.id} className="flex items-center gap-1.5 group" onClick={() => setStep(i)}>
                  <div className={`flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold transition-colors ${
                    i === step ? 'bg-primary text-primary-foreground' : i < step ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span className={`text-xs hidden lg:inline ${i === step ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
                  {i < STEPS.length - 1 && <div className="w-4 h-px bg-border mx-1" />}
                </button>
              ))}
            </div>

            {/* Form content */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {step === 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-xs">Дата ДТП</Label><Input type="date" value={data.accidentDate} onChange={e => updateData('accidentDate', e.target.value)} className="h-8 text-xs" /></div>
                      <div><Label className="text-xs">Время ДТП</Label><Input type="time" value={data.accidentTime} onChange={e => updateData('accidentTime', e.target.value)} className="h-8 text-xs" /></div>
                    </div>
                    <div><Label className="text-xs">Место ДТП (адрес, ориентиры)</Label><Textarea value={data.accidentLocation} onChange={e => updateData('accidentLocation', e.target.value)} className="min-h-[60px] text-xs" placeholder="г. Москва, ул. Ленина, д. 1" /></div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Пострадавшие</Label>
                      <Switch checked={data.injuredPersons} onCheckedChange={v => updateData('injuredPersons', v)} />
                      <span className="text-xs text-muted-foreground">{data.injuredPersons ? 'Да' : 'Нет'}</span>
                    </div>
                    <div><Label className="text-xs">Свидетели</Label><Textarea value={data.witnesses} onChange={e => updateData('witnesses', e.target.value)} className="min-h-[50px] text-xs" /></div>
                    <div><Label className="text-xs">Повреждение иного имущества</Label><Input value={data.otherDamage} onChange={e => updateData('otherDamage', e.target.value)} className="h-8 text-xs" placeholder="Нет" /></div>
                  </>
                )}
                {step === 1 && <EuroParticipantForm title="Участник «А»" participant={data.participantA} onChange={p => updateData('participantA', p)} />}
                {step === 2 && <EuroParticipantForm title="Участник «Б»" participant={data.participantB} onChange={p => updateData('participantB', p)} />}
                {step === 3 && (
                  <>
                    <div><Label className="text-xs">Описание схемы ДТП</Label><Textarea value={data.sketchDescription} onChange={e => updateData('sketchDescription', e.target.value)} className="min-h-[80px] text-xs" placeholder="Направление движения, положение ТС..." /></div>
                    <div>
                      <Label className="text-xs font-semibold">Фотоматериалы</Label>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {data.photos.map((url, i) => (
                          <div key={i} className="relative group">
                            <img src={url} alt={`Фото ${i + 1}`} className="w-full h-20 object-cover rounded-md border border-border" />
                            <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3" /></button>
                          </div>
                        ))}
                        <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center h-20 border-2 border-dashed border-border rounded-md hover:border-primary hover:bg-primary/5 transition-colors text-muted-foreground hover:text-primary" disabled={uploading}>
                          {uploading ? <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <><Camera className="h-5 w-5 mb-1" /><span className="text-[10px]">Добавить</span></>}
                        </button>
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handlePhotoUpload(e.target.files)} />
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            {/* Step navigation */}
            <div className="flex items-center justify-between p-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={prevStep} disabled={step === 0} className="gap-1"><ChevronLeft className="h-3.5 w-3.5" />Назад</Button>
              <span className="text-xs text-muted-foreground">Шаг {step + 1} из {STEPS.length}</span>
              <Button variant="outline" size="sm" onClick={nextStep} disabled={step === STEPS.length - 1} className="gap-1">Далее<ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Preview */}
        <ResizablePanel defaultSize={55} minSize={30}>
          <ScrollArea className="h-full">
            <div className="p-4">
              <EuroPreviewScaled data={data} />
            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
});

EuroProtocolModule.displayName = 'EuroProtocolModule';

/** Scaled preview in the panel — uses inline dangerouslySetInnerHTML with scoped styles */
function EuroPreviewScaled({ data }: { data: EuroprotocolData }) {
  const html = buildEuroprotocolHTML(data);
  return (
    <div style={{ transform: 'scale(0.62)', transformOrigin: 'top left', width: '161%' }}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
