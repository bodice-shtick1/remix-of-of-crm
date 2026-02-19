import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logEventDirect } from '@/hooks/useEventLog';

export type CarImportStep = 'upload' | 'mapping' | 'importing' | 'done';

export interface CarImportResult {
  newBrands: number;
  newModels: number;
  skippedDuplicates: number;
  errors: number;
  errorDetails: string[];
}

interface RawRow {
  [key: string]: string | number | null;
}

const AUTO_MAP_BRAND: Record<string, boolean> = {
  'марка': true, 'brand': true, 'make': true, 'производитель': true,
  'бренд': true, 'марка авто': true, 'марка автомобиля': true,
};

const AUTO_MAP_MODEL: Record<string, boolean> = {
  'модель': true, 'model': true, 'модель авто': true, 'модель автомобиля': true,
};

function fixCase(val: string): string {
  if (!val) return '';
  const s = val.trim();
  // If all uppercase and length > 3, title-case it; otherwise keep original
  if (s.length > 3 && s === s.toUpperCase()) {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
  return s;
}

export function useCarBrandsImport() {
  const [step, setStep] = useState<CarImportStep>('upload');
  const [fileName, setFileName] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [rawData, setRawData] = useState<RawRow[]>([]);
  const [brandColumn, setBrandColumn] = useState<string | null>(null);
  const [modelColumn, setModelColumn] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<CarImportResult | null>(null);
  const [progress, setProgress] = useState(0);

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setColumns([]);
    setRawData([]);
    setBrandColumn(null);
    setModelColumn(null);
    setIsProcessing(false);
    setResult(null);
    setProgress(0);
  }, []);

  const parseFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json: RawRow[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (json.length === 0) {
        toast.error('Файл пуст или имеет неверный формат');
        setIsProcessing(false);
        return;
      }

      const cols = Object.keys(json[0]);
      setRawData(json);
      setColumns(cols);
      setFileName(file.name);

      // Auto-detect columns
      let autoBrand: string | null = null;
      let autoModel: string | null = null;
      for (const col of cols) {
        const key = col.toLowerCase().trim();
        if (AUTO_MAP_BRAND[key] && !autoBrand) autoBrand = col;
        if (AUTO_MAP_MODEL[key] && !autoModel) autoModel = col;
      }
      setBrandColumn(autoBrand);
      setModelColumn(autoModel);
      setStep('mapping');
    } catch {
      toast.error('Ошибка чтения файла');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const executeImport = useCallback(async () => {
    if (!brandColumn) {
      toast.error('Выберите колонку «Марка»');
      return;
    }

    setIsProcessing(true);
    setStep('importing');
    setProgress(0);

    const res: CarImportResult = { newBrands: 0, newModels: 0, skippedDuplicates: 0, errors: 0, errorDetails: [] };

    try {
      // 1. Load existing data
      const { data: existing, error: loadErr } = await supabase
        .from('car_brands_models')
        .select('brand, model');
      if (loadErr) throw loadErr;

      // Build a set of existing pairs for fast lookup: \"BRAND|||MODEL\"
      const existingSet = new Set<string>();
      const existingBrandsWithoutModel = new Set<string>();
      for (const row of existing || []) {
        const key = `${row.brand.toLowerCase()}|||${(row.model || '').toLowerCase()}`;
        existingSet.add(key);
        if (!row.model) existingBrandsWithoutModel.add(row.brand.toLowerCase());
      }

      // 2. Collect unique pairs from file
      const pairs: { brand: string; model: string | null }[] = [];
      const seenInFile = new Set<string>();

      for (const row of rawData) {
        const rawBrand = String(row[brandColumn] ?? '').trim();
        if (!rawBrand) continue;

        const brand = fixCase(rawBrand);
        const rawModel = modelColumn ? String(row[modelColumn] ?? '').trim() : '';
        const model = rawModel ? fixCase(rawModel) : null;

        const key = `${brand.toLowerCase()}|||${(model || '').toLowerCase()}`;

        // Skip if already seen in this file
        if (seenInFile.has(key)) {
          res.skippedDuplicates++;
          continue;
        }
        seenInFile.add(key);

        // Skip if already in DB
        if (existingSet.has(key)) {
          res.skippedDuplicates++;
          continue;
        }

        // If we have a model, check if brand-only row exists; if not, we need brand placeholder
        if (model) {
          const brandOnlyKey = `${brand.toLowerCase()}|||`;
          if (!existingSet.has(brandOnlyKey) && !seenInFile.has(brandOnlyKey)) {
            // Add brand-only entry if brand doesn't exist at all
            if (!existingBrandsWithoutModel.has(brand.toLowerCase())) {
              pairs.push({ brand, model: null });
              seenInFile.add(brandOnlyKey);
              res.newBrands++;
            }
          }
        } else {
          // Brand-only row
          if (!existingBrandsWithoutModel.has(brand.toLowerCase())) {
            res.newBrands++;
          } else {
            res.skippedDuplicates++;
            continue;
          }
        }

        if (model) {
          res.newModels++;
        }

        pairs.push({ brand, model });
      }

      // 3. Batch insert in chunks of 200
      const CHUNK = 200;
      for (let i = 0; i < pairs.length; i += CHUNK) {
        const chunk = pairs.slice(i, i + CHUNK);
        const { error } = await supabase.from('car_brands_models').insert(chunk);
        if (error) {
          res.errors += chunk.length;
          res.errorDetails.push(`Ошибка вставки строк ${i + 1}-${i + chunk.length}: ${error.message}`);
        }
        setProgress(Math.round(((i + chunk.length) / pairs.length) * 100));
      }

      if (pairs.length === 0) {
        setProgress(100);
      }

      setResult(res);
      setStep('done');
      logEventDirect({ action: 'import', category: 'service', entityType: 'car_brands_import', fieldAccessed: 'Импорт марок/моделей', newValue: `Марок: ${res.newBrands}, Моделей: ${res.newModels}` });
    } catch (e: any) {
      toast.error('Ошибка импорта');
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  }, [brandColumn, modelColumn, rawData]);

  return {
    step, fileName, columns, rawData, brandColumn, modelColumn,
    isProcessing, result, progress,
    reset, parseFile, setBrandColumn, setModelColumn, executeImport,
  };
}
