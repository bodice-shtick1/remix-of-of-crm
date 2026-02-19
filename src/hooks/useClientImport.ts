import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logEventDirect } from '@/hooks/useEventLog';

export interface ImportedRow {
  [key: string]: string | number | null;
}

export interface FieldMapping {
  sourceColumn: string;
  targetField: string | null;
}

export interface DuplicateEntry {
  rowIndex: number;
  importedRow: ImportedRow;
  existingClient: { id: string; first_name: string; last_name: string; phone: string };
  action: 'skip' | 'update' | 'create';
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetails: string[];
}

export type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';

const SYSTEM_FIELDS = [
  { value: 'last_name', label: 'Фамилия' },
  { value: 'first_name', label: 'Имя' },
  { value: 'middle_name', label: 'Отчество' },
  { value: 'full_name', label: 'ФИО (одной строкой)' },
  { value: 'phone', label: 'Телефон' },
  { value: 'email', label: 'Email' },
  { value: 'birth_date', label: 'Дата рождения' },
  { value: 'address', label: 'Адрес' },
  { value: 'inn', label: 'ИНН' },
  { value: 'passport_data', label: 'Паспортные данные' },
  { value: 'company_name', label: 'Название компании' },
  { value: 'notes', label: 'Примечания' },
  { value: '_skip', label: '— Пропустить —' },
];

const AUTO_MAP: Record<string, string> = {
  'фамилия': 'last_name',
  'фам': 'last_name',
  'lastname': 'last_name',
  'last_name': 'last_name',
  'имя': 'first_name',
  'firstname': 'first_name',
  'first_name': 'first_name',
  'отчество': 'middle_name',
  'middlename': 'middle_name',
  'middle_name': 'middle_name',
  'фио': 'full_name',
  'ф.и.о.': 'full_name',
  'ф.и.о': 'full_name',
  'fullname': 'full_name',
  'full_name': 'full_name',
  'телефон': 'phone',
  'тел': 'phone',
  'тел.': 'phone',
  'phone': 'phone',
  'mobile': 'phone',
  'мобильный': 'phone',
  'email': 'email',
  'e-mail': 'email',
  'почта': 'email',
  'эл.почта': 'email',
  'дата рождения': 'birth_date',
  'дата рожд': 'birth_date',
  'др': 'birth_date',
  'д.р.': 'birth_date',
  'birthday': 'birth_date',
  'birth_date': 'birth_date',
  'birthdate': 'birth_date',
  'адрес': 'address',
  'address': 'address',
  'инн': 'inn',
  'inn': 'inn',
  'паспорт': 'passport_data',
  'паспортные данные': 'passport_data',
  'passport': 'passport_data',
  'компания': 'company_name',
  'организация': 'company_name',
  'company': 'company_name',
  'company_name': 'company_name',
  'примечания': 'notes',
  'заметки': 'notes',
  'комментарий': 'notes',
  'notes': 'notes',
};

export function getSystemFields() {
  return SYSTEM_FIELDS;
}

function normalizePhone(raw: string): string {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    digits = '7' + digits.slice(1);
  } else if (digits.length === 10) {
    digits = '7' + digits;
  }
  if (digits.length !== 11 || !digits.startsWith('7')) {
    return '+' + digits;
  }
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
}

function fixNameCase(name: string): string {
  if (!name) return '';
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/(^|\s|-)\S/g, (c) => c.toUpperCase());
}

function parseDate(raw: string | number): string | null {
  if (!raw) return null;
  const s = String(raw).trim();

  // dd.mm.yyyy or dd/mm/yyyy
  let m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    let year = m[3];
    if (year.length === 2) {
      year = Number(year) > 50 ? '19' + year : '20' + year;
    }
    return `${year}-${month}-${day}`;
  }

  // yyyy-mm-dd
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }

  // Excel serial number
  if (!isNaN(Number(raw)) && Number(raw) > 10000) {
    const date = new Date((Number(raw) - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  return null;
}

function splitFullName(fullName: string): { last_name: string; first_name: string; middle_name: string } {
  const parts = String(fullName).trim().split(/\s+/);
  return {
    last_name: fixNameCase(parts[0] || ''),
    first_name: fixNameCase(parts[1] || ''),
    middle_name: fixNameCase(parts.slice(2).join(' ')),
  };
}

export function useClientImport() {
  const [step, setStep] = useState<ImportStep>('upload');
  const [fileName, setFileName] = useState('');
  const [rawData, setRawData] = useState<ImportedRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateEntry[]>([]);
  const [validRows, setValidRows] = useState<Record<string, string | null>[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setRawData([]);
    setColumns([]);
    setMappings([]);
    setDuplicates([]);
    setValidRows([]);
    setResult(null);
    setIsProcessing(false);
  }, []);

  const parseFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json: ImportedRow[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (json.length === 0) {
        toast.error('Файл пуст или имеет неверный формат');
        setIsProcessing(false);
        return;
      }

      const cols = Object.keys(json[0]);
      setRawData(json);
      setColumns(cols);
      setFileName(file.name);

      // Auto-map columns
      const autoMappings: FieldMapping[] = cols.map((col) => {
        const normalized = col.toLowerCase().trim();
        const target = AUTO_MAP[normalized] || null;
        return { sourceColumn: col, targetField: target };
      });
      setMappings(autoMappings);
      setStep('mapping');
    } catch (e) {
      toast.error('Ошибка чтения файла');
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const updateMapping = useCallback((sourceColumn: string, targetField: string | null) => {
    setMappings((prev) =>
      prev.map((m) => (m.sourceColumn === sourceColumn ? { ...m, targetField } : m))
    );
  }, []);

  const processAndCheckDuplicates = useCallback(async () => {
    setIsProcessing(true);
    try {
      const activeMappings = mappings.filter((m) => m.targetField && m.targetField !== '_skip');
      const hasFullName = activeMappings.some((m) => m.targetField === 'full_name');
      const hasFirstName = activeMappings.some((m) => m.targetField === 'first_name');
      const hasLastName = activeMappings.some((m) => m.targetField === 'last_name');
      const hasPhone = activeMappings.some((m) => m.targetField === 'phone');

      if (!hasPhone) {
        toast.error('Поле "Телефон" обязательно для сопоставления');
        setIsProcessing(false);
        return;
      }

      if (!hasFullName && !(hasFirstName && hasLastName)) {
        toast.error('Необходимо сопоставить ФИО или Фамилию + Имя');
        setIsProcessing(false);
        return;
      }

      // Transform rows
      const processed: Record<string, string | null>[] = [];
      for (const row of rawData) {
        const record: Record<string, string | null> = {};
        for (const mapping of activeMappings) {
          const val = String(row[mapping.sourceColumn] ?? '').trim();
          if (!val) continue;

          switch (mapping.targetField) {
            case 'phone':
              record.phone = normalizePhone(val);
              break;
            case 'birth_date':
              record.birth_date = parseDate(val);
              break;
            case 'full_name': {
              const parts = splitFullName(val);
              record.last_name = parts.last_name;
              record.first_name = parts.first_name;
              if (parts.middle_name) record.middle_name = parts.middle_name;
              break;
            }
            case 'first_name':
              record.first_name = fixNameCase(val);
              break;
            case 'last_name':
              record.last_name = fixNameCase(val);
              break;
            case 'middle_name':
              record.middle_name = fixNameCase(val);
              break;
            default:
              record[mapping.targetField!] = val;
          }
        }

        if (record.phone && record.first_name && record.last_name) {
          processed.push(record);
        }
      }

      if (processed.length === 0) {
        toast.error('Нет валидных записей для импорта');
        setIsProcessing(false);
        return;
      }

      // Check duplicates by phone
      const phones = processed.map((r) => r.phone!.replace(/\D/g, ''));
      const { data: existingClients } = await supabase
        .from('clients')
        .select('id, first_name, last_name, phone');

      const existingByPhone = new Map<string, { id: string; first_name: string; last_name: string; phone: string }>();
      if (existingClients) {
        for (const c of existingClients) {
          const normalized = c.phone.replace(/\D/g, '');
          existingByPhone.set(normalized, c);
        }
      }

      const dupes: DuplicateEntry[] = [];
      const clean: Record<string, string | null>[] = [];

      processed.forEach((row, i) => {
        const phoneDigits = row.phone!.replace(/\D/g, '');
        const existing = existingByPhone.get(phoneDigits);
        if (existing) {
          dupes.push({
            rowIndex: i,
            importedRow: row as ImportedRow,
            existingClient: existing,
            action: 'skip',
          });
        } else {
          clean.push(row);
        }
      });

      setValidRows(clean);
      setDuplicates(dupes);
      setStep('preview');
    } catch (e) {
      toast.error('Ошибка обработки данных');
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  }, [mappings, rawData]);

  const setDuplicateAction = useCallback((rowIndex: number, action: DuplicateEntry['action']) => {
    setDuplicates((prev) =>
      prev.map((d) => (d.rowIndex === rowIndex ? { ...d, action } : d))
    );
  }, []);

  const setAllDuplicateActions = useCallback((action: DuplicateEntry['action']) => {
    setDuplicates((prev) => prev.map((d) => ({ ...d, action })));
  }, []);

  const executeImport = useCallback(async () => {
    setIsProcessing(true);
    setStep('importing');

    const res: ImportResult = { added: 0, updated: 0, skipped: 0, errors: 0, errorDetails: [] };

    try {
      // Insert new clients
      if (validRows.length > 0) {
        const toInsert = validRows.map((r) => ({
          first_name: r.first_name || '',
          last_name: r.last_name || '',
          middle_name: r.middle_name || null,
          phone: r.phone || '',
          email: r.email || null,
          birth_date: r.birth_date || null,
          address: r.address || null,
          inn: r.inn || null,
          passport_data: r.passport_data || null,
          company_name: r.company_name || null,
          is_company: !!r.company_name,
          notes: r.notes || null,
        }));

        // Batch insert in chunks of 100
        for (let i = 0; i < toInsert.length; i += 100) {
          const chunk = toInsert.slice(i, i + 100);
          const { error } = await supabase.from('clients').insert(chunk);
          if (error) {
            res.errors += chunk.length;
            res.errorDetails.push(`Ошибка вставки строк ${i + 1}-${i + chunk.length}: ${error.message}`);
          } else {
            res.added += chunk.length;
          }
        }
      }

      // Handle duplicates
      for (const dup of duplicates) {
        if (dup.action === 'skip') {
          res.skipped++;
          continue;
        }

        if (dup.action === 'update') {
          const row = dup.importedRow as Record<string, string | null>;
          const updateData: Record<string, string | null | boolean> = {};
          if (row.first_name) updateData.first_name = row.first_name;
          if (row.last_name) updateData.last_name = row.last_name;
          if (row.middle_name) updateData.middle_name = row.middle_name;
          if (row.email) updateData.email = row.email;
          if (row.birth_date) updateData.birth_date = row.birth_date;
          if (row.address) updateData.address = row.address;
          if (row.inn) updateData.inn = row.inn;
          if (row.passport_data) updateData.passport_data = row.passport_data;
          if (row.company_name) {
            updateData.company_name = row.company_name;
            updateData.is_company = true;
          }
          if (row.notes) updateData.notes = row.notes;

          const { error } = await supabase
            .from('clients')
            .update(updateData)
            .eq('id', dup.existingClient.id);

          if (error) {
            res.errors++;
            res.errorDetails.push(`Ошибка обновления ${dup.existingClient.last_name}: ${error.message}`);
          } else {
            res.updated++;
          }
        }

        if (dup.action === 'create') {
          const row = dup.importedRow as Record<string, string | null>;
          const { error } = await supabase.from('clients').insert({
            first_name: row.first_name || '',
            last_name: row.last_name || '',
            middle_name: row.middle_name || null,
            phone: row.phone || '',
            email: row.email || null,
            birth_date: row.birth_date || null,
            address: row.address || null,
            inn: row.inn || null,
            passport_data: row.passport_data || null,
            company_name: row.company_name || null,
            is_company: !!row.company_name,
            notes: row.notes || null,
          });

          if (error) {
            res.errors++;
            res.errorDetails.push(`Ошибка создания дубля: ${error.message}`);
          } else {
            res.added++;
          }
        }
      }

      setResult(res);
      setStep('done');
      logEventDirect({ action: 'import', category: 'clients', entityType: 'clients_import', fieldAccessed: 'Импорт клиентов', newValue: `Добавлено: ${res.added}, Обновлено: ${res.updated}, Пропущено: ${res.skipped}, Ошибок: ${res.errors}` });
    } catch (e) {
      toast.error('Ошибка импорта');
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  }, [validRows, duplicates]);

  return {
    step,
    fileName,
    rawData,
    columns,
    mappings,
    duplicates,
    validRows,
    result,
    isProcessing,
    reset,
    parseFile,
    updateMapping,
    processAndCheckDuplicates,
    setDuplicateAction,
    setAllDuplicateActions,
    executeImport,
    getSystemFields,
  };
}
