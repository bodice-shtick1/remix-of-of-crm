import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logEventDirect } from '@/hooks/useEventLog';
import { format, addYears, subDays } from 'date-fns';

export type SalesImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';

export interface SalesImportResult {
  clientsCreated: number;
  clientsFound: number;
  salesCreated: number;
  policiesCreated: number;
  debtsCreated: number;
  debtTotalAmount: number;
  vehiclesCreated: number;
  skipped: number;
  errors: number;
  errorDetails: string[];
  minDate: string | null;
  maxDate: string | null;
}

// Validation helpers for preview
export function validatePhone(raw: string): boolean {
  if (!raw) return false;
  const digits = String(raw).replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11;
}

export function validateDate(raw: string | number): boolean {
  if (!raw) return true; // optional
  return parseDate(raw) !== null;
}

export function validateNumber(raw: string | number | null): boolean {
  if (raw === null || raw === undefined || raw === '') return true;
  const s = String(raw).replace(/\s/g, '').replace(',', '.');
  return !isNaN(parseFloat(s));
}

interface RawRow {
  [key: string]: string | number | null;
}

export interface SalesFieldMapping {
  // Client
  clientFullName: string | null;
  clientLastName: string | null;
  clientFirstName: string | null;
  clientMiddleName: string | null;
  clientPhone: string | null;
  clientBirthDate: string | null;
  // Policy
  productName: string | null;
  insuranceCompany: string | null;
  policySeries: string | null;
  policyNumber: string | null;
  startDate: string | null;
  endDate: string | null;
  // Vehicle
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleNumber: string | null;
  vinCode: string | null;
  // Finance
  premiumAmount: string | null;
  amountPaid: string | null;
  paymentDate: string | null;
  commissionPercent: string | null;
}

const FIELD_GROUPS = [
  {
    label: 'Клиент',
    fields: [
      { key: 'clientFullName', label: 'ФИО (одной строкой)' },
      { key: 'clientLastName', label: 'Фамилия' },
      { key: 'clientFirstName', label: 'Имя' },
      { key: 'clientMiddleName', label: 'Отчество' },
      { key: 'clientPhone', label: 'Телефон', required: true },
      { key: 'clientBirthDate', label: 'Дата рождения' },
    ],
  },
  {
    label: 'Полис',
    fields: [
      { key: 'productName', label: 'Продукт (ОСАГО, КАСКО…)' },
      { key: 'insuranceCompany', label: 'Страховая компания' },
      { key: 'policySeries', label: 'Серия полиса' },
      { key: 'policyNumber', label: 'Номер полиса' },
      { key: 'startDate', label: 'Дата начала' },
      { key: 'endDate', label: 'Дата окончания' },
    ],
  },
  {
    label: 'Транспорт',
    fields: [
      { key: 'vehicleBrand', label: 'Марка авто' },
      { key: 'vehicleModel', label: 'Модель авто' },
      { key: 'vehicleNumber', label: 'Гос. номер' },
      { key: 'vinCode', label: 'VIN-код' },
    ],
  },
  {
    label: 'Касса',
    fields: [
      { key: 'premiumAmount', label: 'Стоимость полиса', required: true },
      { key: 'amountPaid', label: 'Оплачено' },
      { key: 'paymentDate', label: 'Дата платежа' },
      { key: 'commissionPercent', label: 'Комиссия (%)' },
    ],
  },
];

export function getFieldGroups() {
  return FIELD_GROUPS;
}

// ---- Auto-mapping ----
const AUTO_MAP: Record<string, keyof SalesFieldMapping> = {
  'фио': 'clientFullName',
  'ф.и.о.': 'clientFullName',
  'ф.и.о': 'clientFullName',
  'фамилия': 'clientLastName',
  'имя': 'clientFirstName',
  'отчество': 'clientMiddleName',
  'телефон': 'clientPhone',
  'тел': 'clientPhone',
  'тел.': 'clientPhone',
  'phone': 'clientPhone',
  'дата рождения': 'clientBirthDate',
  'др': 'clientBirthDate',
  'д.р.': 'clientBirthDate',
  'продукт': 'productName',
  'тип полиса': 'productName',
  'вид страхования': 'productName',
  'страховая компания': 'insuranceCompany',
  'ск': 'insuranceCompany',
  'компания': 'insuranceCompany',
  'серия': 'policySeries',
  'серия полиса': 'policySeries',
  'номер': 'policyNumber',
  'номер полиса': 'policyNumber',
  'дата начала': 'startDate',
  'начало': 'startDate',
  'дата окончания': 'endDate',
  'окончание': 'endDate',
  'марка': 'vehicleBrand',
  'марка авто': 'vehicleBrand',
  'модель': 'vehicleModel',
  'модель авто': 'vehicleModel',
  'гос номер': 'vehicleNumber',
  'госномер': 'vehicleNumber',
  'гос. номер': 'vehicleNumber',
  'номер авто': 'vehicleNumber',
  'vin': 'vinCode',
  'вин': 'vinCode',
  'vin-код': 'vinCode',
  'вин-код': 'vinCode',
  'премия': 'premiumAmount',
  'стоимость': 'premiumAmount',
  'сумма': 'premiumAmount',
  'стоимость полиса': 'premiumAmount',
  'оплачено': 'amountPaid',
  'оплата': 'amountPaid',
  'инкассация': 'amountPaid',
  'дата оплаты': 'paymentDate',
  'дата платежа': 'paymentDate',
  'комиссия': 'commissionPercent',
  'комиссия %': 'commissionPercent',
  'кв': 'commissionPercent',
};

// ---- Helpers ----

function normalizePhone(raw: string): string {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    digits = '7' + digits.slice(1);
  } else if (digits.length === 10) {
    digits = '7' + digits;
  }
  if (digits.length !== 11 || !digits.startsWith('7')) return '+' + digits;
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
}

function fixNameCase(name: string): string {
  if (!name) return '';
  return String(name).trim().toLowerCase().replace(/(^|\s|-)\S/g, c => c.toUpperCase());
}

function splitFullName(full: string) {
  const parts = String(full).trim().split(/\s+/);
  return {
    last_name: fixNameCase(parts[0] || ''),
    first_name: fixNameCase(parts[1] || ''),
    middle_name: fixNameCase(parts.slice(2).join(' ')),
  };
}

function parseDate(raw: string | number): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    let year = m[3];
    if (year.length === 2) year = Number(year) > 50 ? '19' + year : '20' + year;
    return `${year}-${month}-${day}`;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  if (!isNaN(Number(raw)) && Number(raw) > 10000) {
    const date = new Date((Number(raw) - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return null;
}

function parseNumber(raw: string | number | null): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  const s = String(raw).replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function generateUID() {
  const year = new Date().getFullYear();
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `${year}-IMP-${uuid}`;
}

// ---- Hook ----

export function useSalesHistoryImport() {
  const [step, setStep] = useState<SalesImportStep>('upload');
  const [fileName, setFileName] = useState('');
  const [rawData, setRawData] = useState<RawRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<SalesFieldMapping>({
    clientFullName: null, clientLastName: null, clientFirstName: null, clientMiddleName: null,
    clientPhone: null, clientBirthDate: null,
    productName: null, insuranceCompany: null, policySeries: null, policyNumber: null,
    startDate: null, endDate: null,
    vehicleBrand: null, vehicleModel: null, vehicleNumber: null, vinCode: null,
    premiumAmount: null, amountPaid: null, paymentDate: null, commissionPercent: null,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<SalesImportResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [totalRows, setTotalRows] = useState(0);

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setRawData([]);
    setColumns([]);
    setMapping({
      clientFullName: null, clientLastName: null, clientFirstName: null, clientMiddleName: null,
      clientPhone: null, clientBirthDate: null,
      productName: null, insuranceCompany: null, policySeries: null, policyNumber: null,
      startDate: null, endDate: null,
      vehicleBrand: null, vehicleModel: null, vehicleNumber: null, vinCode: null,
      premiumAmount: null, amountPaid: null, paymentDate: null, commissionPercent: null,
    });
    setIsProcessing(false);
    setResult(null);
    setProgress(0);
    setTotalRows(0);
  }, []);

  const parseFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json: RawRow[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (json.length === 0) { toast.error('Файл пуст'); setIsProcessing(false); return; }

      const cols = Object.keys(json[0]);
      setRawData(json);
      setColumns(cols);
      setFileName(file.name);
      setTotalRows(json.length);

      // Auto-map
      const autoMapping = { ...mapping };
      for (const col of cols) {
        const key = col.toLowerCase().trim();
        if (AUTO_MAP[key]) {
          (autoMapping as any)[AUTO_MAP[key]] = col;
        }
      }
      setMapping(autoMapping);
      setStep('mapping');
    } catch {
      toast.error('Ошибка чтения файла');
    } finally {
      setIsProcessing(false);
    }
  }, [mapping]);

  const updateMapping = useCallback((field: keyof SalesFieldMapping, column: string | null) => {
    setMapping(prev => ({ ...prev, [field]: column === '_none' ? null : column }));
  }, []);

  const validateMapping = useCallback((): string | null => {
    if (!mapping.clientPhone) return 'Поле «Телефон» обязательно';
    if (!mapping.clientFullName && !mapping.clientLastName) return 'Необходимо указать ФИО или Фамилию';
    if (!mapping.premiumAmount) return 'Поле «Стоимость полиса» обязательно';
    return null;
  }, [mapping]);

  const executeImport = useCallback(async (userId: string) => {
    const err = validateMapping();
    if (err) { toast.error(err); return; }

    setIsProcessing(true);
    setStep('importing');
    setProgress(0);

    const res: SalesImportResult = {
      clientsCreated: 0, clientsFound: 0, salesCreated: 0,
      policiesCreated: 0, debtsCreated: 0, debtTotalAmount: 0, vehiclesCreated: 0,
      skipped: 0, errors: 0, errorDetails: [],
      minDate: null, maxDate: null,
    };

    // Preload existing clients by phone
    const { data: existingClients } = await supabase.from('clients').select('id, first_name, last_name, phone');
    const clientByPhone = new Map<string, { id: string; first_name: string; last_name: string }>();
    if (existingClients) {
      for (const c of existingClients) {
        const digits = c.phone.replace(/\D/g, '');
        clientByPhone.set(digits, c);
      }
    }

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      try {
        // ---- 1. Parse client data ----
        const rawPhone = mapping.clientPhone ? String(row[mapping.clientPhone] ?? '').trim() : '';
        if (!rawPhone) { res.skipped++; continue; }
        const phone = normalizePhone(rawPhone);
        const phoneDigits = phone.replace(/\D/g, '');

        let clientId: string;
        let clientName = '';

        const existing = clientByPhone.get(phoneDigits);
        if (existing) {
          clientId = existing.id;
          clientName = `${existing.last_name} ${existing.first_name}`;
          res.clientsFound++;
        } else {
          // Parse name
          let lastName = '', firstName = '', middleName = '';
          if (mapping.clientFullName) {
            const full = String(row[mapping.clientFullName] ?? '').trim();
            const parts = splitFullName(full);
            lastName = parts.last_name;
            firstName = parts.first_name;
            middleName = parts.middle_name;
          }
          if (mapping.clientLastName) lastName = fixNameCase(String(row[mapping.clientLastName] ?? '').trim());
          if (mapping.clientFirstName) firstName = fixNameCase(String(row[mapping.clientFirstName] ?? '').trim());
          if (mapping.clientMiddleName) middleName = fixNameCase(String(row[mapping.clientMiddleName] ?? '').trim());

          if (!lastName && !firstName) { lastName = 'Импорт'; firstName = `#${i + 1}`; }

          const birthDate = mapping.clientBirthDate ? parseDate(row[mapping.clientBirthDate] ?? '') : null;

          const { data: newClient, error: clientErr } = await supabase
            .from('clients')
            .insert({
              first_name: firstName || 'Не указано',
              last_name: lastName || 'Не указано',
              middle_name: middleName || null,
              phone,
              birth_date: birthDate,
              agent_id: userId,
            })
            .select('id')
            .single();

          if (clientErr) {
            res.errors++;
            res.errorDetails.push(`Строка ${i + 1}: Ошибка создания клиента — ${clientErr.message}`);
            continue;
          }
          clientId = newClient.id;
          clientName = `${lastName} ${firstName}`;
          clientByPhone.set(phoneDigits, { id: clientId, first_name: firstName, last_name: lastName });
          res.clientsCreated++;
        }

        // ---- 2. Parse sale data ----
        const premium = parseNumber(mapping.premiumAmount ? row[mapping.premiumAmount] : 0);
        if (premium <= 0) { res.skipped++; continue; }

        const amountPaid = mapping.amountPaid ? parseNumber(row[mapping.amountPaid]) : premium;
        const paymentDate = mapping.paymentDate ? parseDate(row[mapping.paymentDate] ?? '') : null;
        const commissionPercent = mapping.commissionPercent ? parseNumber(row[mapping.commissionPercent]) : 15;

        const productName = mapping.productName ? String(row[mapping.productName] ?? '').trim() : 'Страхование';
        const company = mapping.insuranceCompany ? String(row[mapping.insuranceCompany] ?? '').trim() : 'Не указана';
        const series = mapping.policySeries ? String(row[mapping.policySeries] ?? '').trim() : '';
        const policyNum = mapping.policyNumber ? String(row[mapping.policyNumber] ?? '').trim() : '';

        const startDateStr = mapping.startDate ? parseDate(row[mapping.startDate] ?? '') : (paymentDate || format(new Date(), 'yyyy-MM-dd'));
        const endDateStr = mapping.endDate ? parseDate(row[mapping.endDate] ?? '') : (startDateStr ? format(subDays(addYears(new Date(startDateStr), 1), 1), 'yyyy-MM-dd') : null);

        const isDebt = amountPaid < premium;
        const uid = generateUID();

        // ---- 3. Date validation & record date ----
        const recordDateStr = paymentDate || startDateStr || null;
        
        // Validate date is not in the far future (max current year + 1) and not empty
        if (recordDateStr) {
          const recordDateObj = new Date(recordDateStr);
          const maxAllowedYear = new Date().getFullYear() + 1;
          if (isNaN(recordDateObj.getTime())) {
            res.errors++;
            res.errorDetails.push(`Строка ${i + 1} (${clientName}): Некорректная дата «${recordDateStr}» — строка пропущена`);
            continue;
          }
          if (recordDateObj.getFullYear() > maxAllowedYear) {
            res.errors++;
            res.errorDetails.push(`Строка ${i + 1} (${clientName}): Дата в будущем (${recordDateStr}, макс. ${maxAllowedYear}) — строка пропущена`);
            continue;
          }
        }
        
        const recordDate = recordDateStr ? new Date(recordDateStr).toISOString() : new Date().toISOString();
        const usedFallbackDate = !recordDateStr;

        if (usedFallbackDate) {
          res.errorDetails.push(`Строка ${i + 1} (${clientName}): Дата не указана — использована текущая дата`);
        }

        // Track min/max dates for summary
        const trackDate = recordDateStr || null;
        if (trackDate) {
          if (!res.minDate || trackDate < res.minDate) res.minDate = trackDate;
          if (!res.maxDate || trackDate > res.maxDate) res.maxDate = trackDate;
        }

        // ---- 4. Create Sale ----
        const { data: sale, error: saleErr } = await supabase
          .from('sales')
          .insert({
            uid,
            client_id: clientId,
            total_amount: premium,
            amount_paid: amountPaid,
            payment_method: 'cash',
            status: 'completed',
            debt_status: isDebt ? 'debt' : 'paid',
            created_by: userId,
            completed_at: recordDate,
            created_at: recordDate,
          })
          .select('id')
          .single();

        if (saleErr) {
          res.errors++;
          res.errorDetails.push(`Строка ${i + 1} (${clientName}): Ошибка создания продажи — ${saleErr.message}`);
          continue;
        }
        res.salesCreated++;
        if (isDebt) { res.debtsCreated++; res.debtTotalAmount += (premium - amountPaid); }

        // ---- 5. Sale item ----
        await supabase.from('sale_items').insert({
          sale_id: sale.id,
          item_type: 'insurance',
          policy_series: series || null,
          policy_number: policyNum || null,
          insurance_company: company,
          start_date: startDateStr,
          end_date: endDateStr,
          premium_amount: premium,
          commission_percent: commissionPercent,
          commission_amount: premium * commissionPercent / 100,
          amount: premium,
        });

        // ---- 6. Policy (with status based on end_date) ----
        const policyNumFull = series && policyNum ? `${series} ${policyNum}` : policyNum || `IMP-${Date.now()}`;
        const vBrand = mapping.vehicleBrand ? String(row[mapping.vehicleBrand] ?? '').trim() : '';
        const vModel = mapping.vehicleModel ? String(row[mapping.vehicleModel] ?? '').trim() : '';
        const vNumber = mapping.vehicleNumber ? String(row[mapping.vehicleNumber] ?? '').trim() : '';

        // Determine policy status based on end_date
        const today = format(new Date(), 'yyyy-MM-dd');
        const policyEndDate = endDateStr || format(subDays(addYears(new Date(), 1), 1), 'yyyy-MM-dd');
        const policyStartDate = startDateStr || format(new Date(), 'yyyy-MM-dd');
        let policyStatus: string = 'active';
        if (policyEndDate < today) {
          policyStatus = 'expired';
        }

        const { error: policyErr } = await supabase.from('policies').insert({
          client_id: clientId,
          policy_type: productName,
          policy_series: series || null,
          policy_number: policyNumFull,
          insurance_company: company,
          start_date: policyStartDate,
          end_date: policyEndDate,
          premium_amount: premium,
          commission_percent: commissionPercent,
          commission_amount: premium * commissionPercent / 100,
          status: policyStatus,
          payment_status: isDebt ? 'pending' : 'paid',
          agent_id: userId,
          vehicle_model: vBrand ? `${vBrand}${vModel ? ' ' + vModel : ''}` : null,
          vehicle_number: vNumber || null,
        });
        if (!policyErr) res.policiesCreated++;

        // ---- 7. Vehicle registry ----
        if (vBrand || vNumber) {
          const vinCode = mapping.vinCode ? String(row[mapping.vinCode] ?? '').trim() : '';
          await supabase.from('vehicle_registry').insert({
            brand_name: vBrand || 'Не указана',
            model_name: vModel || null,
            plate_number: vNumber || null,
            vin_code: vinCode || null,
            last_customer_id: clientId,
          });
          res.vehiclesCreated++;
        }

      } catch (e: any) {
        res.errors++;
        res.errorDetails.push(`Строка ${i + 1}: ${e?.message || 'Неизвестная ошибка'}`);
      }

      if ((i + 1) % 10 === 0 || i === rawData.length - 1) {
        setProgress(Math.round(((i + 1) / rawData.length) * 100));
      }
    }

    setResult(res);
    setStep('done');
    logEventDirect({ action: 'import', category: 'sales', entityType: 'sales_history_import', fieldAccessed: 'Импорт истории продаж', newValue: `Продаж: ${res.salesCreated}, Полисов: ${res.policiesCreated}, Клиентов: ${res.clientsCreated}` });
    setIsProcessing(false);
  }, [rawData, mapping, validateMapping]);

  return {
    step, fileName, rawData, columns, mapping, isProcessing, result, progress, totalRows,
    reset, parseFile, updateMapping, validateMapping, executeImport,
  };
}
