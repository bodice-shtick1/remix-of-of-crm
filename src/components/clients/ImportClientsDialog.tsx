import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertTriangle, Loader2, ArrowRight, ArrowLeft, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useClientImport, getSystemFields, type DuplicateEntry } from '@/hooks/useClientImport';
import { cn } from '@/lib/utils';

interface ImportClientsDialogProps {
  onImportComplete: () => void;
}

export function ImportClientsDialog({ onImportComplete }: ImportClientsDialogProps) {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    step, fileName, rawData, columns, mappings, duplicates, validRows,
    result, isProcessing, reset, parseFile, updateMapping,
    processAndCheckDuplicates, setDuplicateAction, setAllDuplicateActions,
    executeImport,
  } = useClientImport();

  const handleClose = () => {
    setOpen(false);
    setTimeout(reset, 300);
  };

  const handleDone = () => {
    onImportComplete();
    handleClose();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      parseFile(file);
    }
  }, [parseFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const systemFields = getSystemFields();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-8">
          <Upload className="h-3.5 w-3.5" />
          Импорт
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Импорт клиентов
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          {(['upload', 'mapping', 'preview', 'done'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && <div className="w-4 h-px bg-border" />}
              <span className={cn(
                'px-2 py-0.5 rounded-full',
                step === s || (step === 'importing' && s === 'preview')
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'bg-muted'
              )}>
                {i + 1}. {s === 'upload' ? 'Файл' : s === 'mapping' ? 'Поля' : s === 'preview' ? 'Проверка' : 'Готово'}
              </span>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium text-foreground mb-1">Перетащите файл сюда</p>
              <p className="text-sm text-muted-foreground mb-3">или нажмите для выбора</p>
              <Badge variant="secondary">.xlsx, .xls, .csv</Badge>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {/* STEP 2: Mapping */}
          {step === 'mapping' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Файл: <span className="font-medium text-foreground">{fileName}</span> ({rawData.length} строк)
                </p>
                <Button variant="ghost" size="sm" onClick={reset} className="gap-1 h-7">
                  <RotateCcw className="h-3 w-3" />
                  Другой файл
                </Button>
              </div>

              <ScrollArea className="h-[320px] pr-2">
                <div className="space-y-2">
                  {mappings.map((m) => {
                    const sampleValues = rawData.slice(0, 3).map(r => String(r[m.sourceColumn] ?? '')).filter(Boolean);
                    return (
                      <div key={m.sourceColumn} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{m.sourceColumn}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {sampleValues.join(', ') || '—'}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Select
                          value={m.targetField || '_skip'}
                          onValueChange={(v) => updateMapping(m.sourceColumn, v === '_skip' ? null : v)}
                        >
                          <SelectTrigger className="w-[180px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {systemFields.map((f) => (
                              <SelectItem key={f.value} value={f.value} className="text-xs">
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={reset}>
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                  Назад
                </Button>
                <Button size="sm" onClick={processAndCheckDuplicates} disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Далее
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Preview / Duplicates */}
          {(step === 'preview' || step === 'importing') && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-md border bg-success/5 border-success/20">
                  <p className="text-xs text-muted-foreground">Новые клиенты</p>
                  <p className="text-xl font-bold text-success">{validRows.length}</p>
                </div>
                <div className="p-3 rounded-md border bg-warning/5 border-warning/20">
                  <p className="text-xs text-muted-foreground">Возможные дубли</p>
                  <p className="text-xl font-bold text-warning">{duplicates.length}</p>
                </div>
              </div>

              {duplicates.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Обнаружены совпадения по телефону:</p>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => setAllDuplicateActions('skip')}>
                        Все: пропустить
                      </Button>
                      <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => setAllDuplicateActions('update')}>
                        Все: обновить
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-[200px] pr-2">
                    <div className="space-y-1.5">
                      {duplicates.map((dup) => (
                        <DuplicateRow key={dup.rowIndex} dup={dup} onAction={setDuplicateAction} />
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}

              {step === 'importing' && (
                <div className="space-y-2">
                  <p className="text-sm text-center text-muted-foreground">Импорт данных...</p>
                  <Progress value={undefined} className="h-2" />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => reset()} disabled={step === 'importing'}>
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                  Назад
                </Button>
                <Button size="sm" onClick={executeImport} disabled={isProcessing || step === 'importing'}>
                  {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Импортировать
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: Done */}
          {step === 'done' && result && (
            <div className="space-y-4 text-center py-4">
              <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
              <p className="text-lg font-semibold">Импорт завершён</p>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-md border">
                  <p className="text-2xl font-bold text-success">{result.added}</p>
                  <p className="text-xs text-muted-foreground">Добавлено</p>
                </div>
                <div className="p-3 rounded-md border">
                  <p className="text-2xl font-bold text-primary">{result.updated}</p>
                  <p className="text-xs text-muted-foreground">Обновлено</p>
                </div>
                <div className="p-3 rounded-md border">
                  <p className="text-2xl font-bold text-destructive">{result.errors}</p>
                  <p className="text-xs text-muted-foreground">Ошибок</p>
                </div>
              </div>

              {result.skipped > 0 && (
                <p className="text-sm text-muted-foreground">Пропущено дублей: {result.skipped}</p>
              )}

              {result.errorDetails.length > 0 && (
                <div className="text-left p-3 rounded-md bg-destructive/5 border border-destructive/20">
                  <p className="text-xs font-medium text-destructive mb-1">Детали ошибок:</p>
                  {result.errorDetails.map((e, i) => (
                    <p key={i} className="text-[10px] text-destructive/80">{e}</p>
                  ))}
                </div>
              )}

              <Button onClick={handleDone} className="mt-2">
                Закрыть
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateRow({ dup, onAction }: { dup: DuplicateEntry; onAction: (rowIndex: number, action: DuplicateEntry['action']) => void }) {
  const row = dup.importedRow as Record<string, string | null>;
  return (
    <div className="flex items-center gap-2 p-2 rounded-md border bg-warning/5 border-warning/20">
      <div className="flex-1 min-w-0">
        <p className="text-xs">
          <span className="font-medium">{row.last_name} {row.first_name}</span>
          <span className="text-muted-foreground ml-1">→ совпадает с</span>
          <span className="font-medium ml-1">{dup.existingClient.last_name} {dup.existingClient.first_name}</span>
        </p>
        <p className="text-[10px] text-muted-foreground">Тел: {row.phone}</p>
      </div>
      <Select value={dup.action} onValueChange={(v) => onAction(dup.rowIndex, v as DuplicateEntry['action'])}>
        <SelectTrigger className="w-[130px] h-7 text-[10px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="skip" className="text-xs">Пропустить</SelectItem>
          <SelectItem value="update" className="text-xs">Обновить</SelectItem>
          <SelectItem value="create" className="text-xs">Создать дубль</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
