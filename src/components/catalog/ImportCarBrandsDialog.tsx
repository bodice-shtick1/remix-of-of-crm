import { useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useCarBrandsImport } from '@/hooks/useCarBrandsImport';

interface ImportCarBrandsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function ImportCarBrandsDialog({ open, onOpenChange, onComplete }: ImportCarBrandsDialogProps) {
  const {
    step, fileName, columns, rawData, brandColumn, modelColumn,
    isProcessing, result, progress,
    reset, parseFile, setBrandColumn, setModelColumn, executeImport,
  } = useCarBrandsImport();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    if (step === 'done') {
      onComplete();
    }
    setTimeout(reset, 300);
  }, [onOpenChange, onComplete, reset, step]);

  const handleFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      return;
    }
    parseFile(file);
  }, [parseFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isProcessing) { if (!v) handleClose(); else onOpenChange(v); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Импорт марок и моделей</DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
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
        )}

        {/* Step 2: Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              <span>{fileName}</span>
              <span className="ml-auto">{rawData.length} строк</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Колонка «Марка» <span className="text-destructive">*</span></label>
                <Select value={brandColumn || ''} onValueChange={setBrandColumn}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Выберите колонку" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Колонка «Модель» <span className="text-muted-foreground text-xs">(необязательно)</span></label>
                <Select value={modelColumn || '_none'} onValueChange={(v) => setModelColumn(v === '_none' ? null : v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Выберите колонку" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Не выбрано —</SelectItem>
                    {columns.map((col) => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview */}
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted">
                    <th className="p-2 text-left font-medium">Марка</th>
                    <th className="p-2 text-left font-medium">Модель</th>
                  </tr>
                </thead>
                <tbody>
                  {rawData.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{brandColumn ? String(row[brandColumn] ?? '') : '—'}</td>
                      <td className="p-2">{modelColumn ? String(row[modelColumn] ?? '') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rawData.length > 5 && (
                <p className="text-xs text-muted-foreground text-center py-1 border-t">
                  ... и ещё {rawData.length - 5} строк
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleClose}>Отмена</Button>
              <Button size="sm" onClick={executeImport} disabled={!brandColumn || isProcessing}>
                {isProcessing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Импортировать
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Importing */}
        {step === 'importing' && (
          <div className="py-6 space-y-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm font-medium">Импорт данных…</p>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">{progress}%</p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold text-sm">Импорт завершён</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="border rounded-md p-3 text-center">
                <p className="text-2xl font-bold text-primary">{result.newBrands}</p>
                <p className="text-xs text-muted-foreground">Новых марок</p>
              </div>
              <div className="border rounded-md p-3 text-center">
                <p className="text-2xl font-bold text-primary">{result.newModels}</p>
                <p className="text-xs text-muted-foreground">Новых моделей</p>
              </div>
              <div className="border rounded-md p-3 text-center">
                <p className="text-2xl font-bold text-muted-foreground">{result.skippedDuplicates}</p>
                <p className="text-xs text-muted-foreground">Пропущено</p>
              </div>
            </div>

            {result.errors > 0 && (
              <div className="border border-destructive/30 bg-destructive/5 rounded-md p-3 space-y-1">
                <div className="flex items-center gap-1 text-destructive text-sm font-medium">
                  <AlertCircle className="h-4 w-4" />
                  Ошибки: {result.errors}
                </div>
                {result.errorDetails.map((e, i) => (
                  <p key={i} className="text-xs text-destructive/80">{e}</p>
                ))}
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
