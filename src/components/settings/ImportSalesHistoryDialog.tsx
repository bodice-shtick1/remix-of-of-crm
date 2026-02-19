import { useCallback, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, AlertTriangle, Download } from 'lucide-react';
import { useSalesHistoryImport, getFieldGroups, SalesFieldMapping, validatePhone, validateDate, validateNumber } from '@/hooks/useSalesHistoryImport';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { downloadErrorReport } from '@/lib/importErrorExport';
import { cn } from '@/lib/utils';

interface ImportSalesHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PREVIEW_ROWS = 7;

export function ImportSalesHistoryDialog({ open, onOpenChange }: ImportSalesHistoryDialogProps) {
  const { user } = useAuth();
  const {
    step, fileName, rawData, columns, mapping, isProcessing, result, progress, totalRows,
    reset, parseFile, updateMapping, validateMapping, executeImport,
  } = useSalesHistoryImport();
  const fileRef = useRef<HTMLInputElement>(null);
  const fieldGroups = getFieldGroups();

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(reset, 300);
  }, [onOpenChange, reset]);

  const handleFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) return;
    parseFile(file);
  }, [parseFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleStartImport = useCallback(() => {
    if (!user) return;
    const err = validateMapping();
    if (err) return;
    executeImport(user.id);
  }, [user, validateMapping, executeImport]);

  const validationError = step === 'mapping' ? validateMapping() : null;

  // Cell-level validation for preview
  const previewValidation = useMemo(() => {
    if (step !== 'mapping') return [];
    const rows = rawData.slice(0, PREVIEW_ROWS);
    return rows.map((row) => {
      const errors: Record<string, boolean> = {};
      if (mapping.clientPhone) {
        const v = String(row[mapping.clientPhone] ?? '');
        if (v && !validatePhone(v)) errors['phone'] = true;
      }
      if (mapping.premiumAmount) {
        const v = row[mapping.premiumAmount];
        if (v !== '' && v !== null && !validateNumber(v as any)) errors['premium'] = true;
      }
      if (mapping.amountPaid) {
        const v = row[mapping.amountPaid];
        if (v !== '' && v !== null && !validateNumber(v as any)) errors['paid'] = true;
      }
      for (const dateField of ['startDate', 'endDate', 'paymentDate', 'clientBirthDate'] as const) {
        if (mapping[dateField]) {
          const v = row[mapping[dateField]!];
          if (v !== '' && v !== null && !validateDate(v as any)) errors[dateField] = true;
        }
      }
      return errors;
    });
  }, [step, rawData, mapping]);

  const hasPreviewErrors = previewValidation.some((r) => Object.keys(r).length > 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isProcessing) { if (!v) handleClose(); else onOpenChange(v); } }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Импорт истории продаж</DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Импорт создаст новые записи в базе данных. Убедитесь, что данные корректны перед загрузкой.
                Рекомендуется сначала импортировать тестовый файл с несколькими строками.
              </AlertDescription>
            </Alert>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium text-sm">Перетащите файл сюда или нажмите для выбора</p>
              <p className="text-xs text-muted-foreground mt-1">Поддерживаются .xlsx, .xls, .csv</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
              />
            </div>
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === 'mapping' && (
          <div className="flex flex-col flex-1 min-h-0 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="truncate">{fileName}</span>
              <span className="ml-auto whitespace-nowrap">{totalRows} строк</span>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-5 pr-3">
                {fieldGroups.map((group) => (
                  <div key={group.label}>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.label}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.fields.map((field) => (
                        <div key={field.key} className="flex items-center gap-2">
                          <label className="text-sm min-w-[140px] shrink-0">
                            {field.label}
                            {'required' in field && field.required && <span className="text-destructive ml-0.5">*</span>}
                          </label>
                          <Select
                            value={(mapping as any)[field.key] || '_none'}
                            onValueChange={(v) => updateMapping(field.key as keyof SalesFieldMapping, v)}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">— Не выбрано —</SelectItem>
                              {columns.map((col) => (
                                <SelectItem key={col} value={col}>{col}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Enhanced Preview */}
            {mapping.clientPhone && mapping.premiumAmount && (
              <div className="shrink-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Предпросмотр данных</p>
                  {hasPreviewErrors && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Обнаружены ошибки формата
                    </p>
                  )}
                </div>
                <div className="border rounded-md overflow-x-auto max-h-[200px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted sticky top-0">
                        <th className="p-1.5 text-left font-medium">#</th>
                        <th className="p-1.5 text-left font-medium">Телефон</th>
                        <th className="p-1.5 text-left font-medium">Клиент</th>
                        <th className="p-1.5 text-left font-medium">Продукт</th>
                        <th className="p-1.5 text-left font-medium">Начало</th>
                        <th className="p-1.5 text-left font-medium">Конец</th>
                        <th className="p-1.5 text-right font-medium">Стоимость</th>
                        <th className="p-1.5 text-right font-medium">Оплачено</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawData.slice(0, PREVIEW_ROWS).map((row, i) => {
                        const errs = previewValidation[i] || {};
                        return (
                          <tr key={i} className="border-t">
                            <td className="p-1.5 text-muted-foreground">{i + 1}</td>
                            <td className={cn('p-1.5', errs['phone'] && 'bg-destructive/10 text-destructive')}>
                              {mapping.clientPhone ? String(row[mapping.clientPhone] ?? '') : ''}
                            </td>
                            <td className="p-1.5">
                              {mapping.clientFullName ? String(row[mapping.clientFullName] ?? '') :
                               mapping.clientLastName ? String(row[mapping.clientLastName] ?? '') : '—'}
                            </td>
                            <td className="p-1.5">
                              {mapping.productName ? String(row[mapping.productName] ?? '') : '—'}
                            </td>
                            <td className={cn('p-1.5', errs['startDate'] && 'bg-destructive/10 text-destructive')}>
                              {mapping.startDate ? String(row[mapping.startDate] ?? '') : '—'}
                            </td>
                            <td className={cn('p-1.5', errs['endDate'] && 'bg-destructive/10 text-destructive')}>
                              {mapping.endDate ? String(row[mapping.endDate] ?? '') : '—'}
                            </td>
                            <td className={cn('p-1.5 text-right', errs['premium'] && 'bg-destructive/10 text-destructive')}>
                              {mapping.premiumAmount ? String(row[mapping.premiumAmount] ?? '') : ''}
                            </td>
                            <td className={cn('p-1.5 text-right', errs['paid'] && 'bg-destructive/10 text-destructive')}>
                              {mapping.amountPaid ? String(row[mapping.amountPaid] ?? '') : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <Alert variant="default" className="shrink-0">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Внимание: Продажи будут созданы задним числом согласно датам, указанным в файле.
              </AlertDescription>
            </Alert>

            <div className="flex items-center gap-2 justify-end shrink-0 pt-1">
              {validationError && (
                <p className="text-xs text-destructive mr-auto">{validationError}</p>
              )}
              <Button variant="outline" size="sm" onClick={handleClose}>Отмена</Button>
              <Button size="sm" onClick={handleStartImport} disabled={!!validationError || isProcessing}>
                {isProcessing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Начать импорт ({totalRows} строк)
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Importing */}
        {step === 'importing' && (
          <div className="py-8 space-y-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm font-medium">Импорт данных…</p>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">{progress}% — обработка строк</p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold text-sm">Импорт завершён</span>
            </div>

            {result.minDate && result.maxDate && (
              <div className="border rounded-md p-2.5 bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  Восстановлена история за период с{' '}
                  <span className="font-medium text-foreground">{new Date(result.minDate).toLocaleDateString('ru-RU')}</span>
                  {' '}по{' '}
                  <span className="font-medium text-foreground">{new Date(result.maxDate).toLocaleDateString('ru-RU')}</span>
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Успешно сделок', value: result.salesCreated, color: 'text-primary' },
                { label: 'Клиентов создано', value: result.clientsCreated, color: 'text-primary' },
                { label: 'Клиентов найдено', value: result.clientsFound, color: 'text-muted-foreground' },
                { label: 'Полисов создано', value: result.policiesCreated, color: 'text-primary' },
                { label: 'ТС добавлено', value: result.vehiclesCreated, color: 'text-primary' },
                { label: 'Выявлено долгов', value: result.debtsCreated, color: 'text-orange-500' },
              ].map((stat) => (
                <div key={stat.label} className="border rounded-md p-2.5 text-center">
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            {result.debtTotalAmount > 0 && (
              <div className="border border-orange-300/50 bg-orange-50/50 dark:bg-orange-950/20 rounded-md p-3">
                <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                  Сумма долгов: {result.debtTotalAmount.toLocaleString('ru-RU')} ₽
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Долги отображаются в карточках клиентов и в Умной кассе
                </p>
              </div>
            )}

            {result.skipped > 0 && (
              <p className="text-xs text-muted-foreground">Пропущено строк (нет телефона/суммы): {result.skipped}</p>
            )}

            {result.errors > 0 && (
              <div className="border border-destructive/30 bg-destructive/5 rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-destructive text-sm font-medium">
                    <AlertCircle className="h-4 w-4" />
                    Пропущено строк с ошибками: {result.errors}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => downloadErrorReport(result.errorDetails)}
                  >
                    <Download className="h-3 w-3" />
                    Скачать отчёт
                  </Button>
                </div>
                <div className="max-h-24 overflow-y-auto space-y-0.5">
                  {result.errorDetails.slice(0, 10).map((e, i) => (
                    <p key={i} className="text-xs text-destructive/80">{e}</p>
                  ))}
                  {result.errorDetails.length > 10 && (
                    <p className="text-xs text-destructive/60">… и ещё {result.errorDetails.length - 10}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button size="sm" onClick={handleClose}>Закрыть</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
