import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Banknote } from 'lucide-react';

interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (actualBalance: number, expectedBalance: number, discrepancyReason?: string) => Promise<boolean>;
  expectedBalance: number;
}

export function OpenShiftModal({
  isOpen,
  onClose,
  onConfirm,
  expectedBalance,
}: OpenShiftModalProps) {
  const [actualBalance, setActualBalance] = useState('');
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const actualBalanceNum = parseFloat(actualBalance) || 0;
  const hasDiscrepancy = actualBalanceNum !== expectedBalance && actualBalance !== '';
  const discrepancyAmount = actualBalanceNum - expectedBalance;

  useEffect(() => {
    if (isOpen) {
      setActualBalance(expectedBalance > 0 ? expectedBalance.toString() : '');
      setDiscrepancyReason('');
    }
  }, [isOpen, expectedBalance]);

  const handleSubmit = async () => {
    if (!actualBalance) return;
    
    if (hasDiscrepancy && !discrepancyReason.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onConfirm(
        actualBalanceNum,
        expectedBalance,
        hasDiscrepancy ? discrepancyReason : undefined
      );
      if (success) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            Открытие смены
          </DialogTitle>
          <DialogDescription>
            Введите начальный остаток кассы для начала работы
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="expected-balance">Ожидаемый остаток</Label>
            <div className="flex items-center gap-2">
              <Input
                id="expected-balance"
                type="text"
                value={expectedBalance.toLocaleString('ru-RU')}
                disabled
                className="bg-muted"
              />
              <span className="text-muted-foreground">₽</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Рассчитан на основе предыдущей смены
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="actual-balance">Фактический остаток *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="actual-balance"
                type="number"
                value={actualBalance}
                onChange={(e) => setActualBalance(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
              />
              <span className="text-muted-foreground">₽</span>
            </div>
          </div>

          {hasDiscrepancy && (
            <>
              <Alert variant={discrepancyAmount > 0 ? 'default' : 'destructive'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {discrepancyAmount > 0 ? 'Излишек' : 'Недостача'}: {' '}
                  <span className="font-semibold">
                    {Math.abs(discrepancyAmount).toLocaleString('ru-RU')} ₽
                  </span>
                </AlertDescription>
              </Alert>

              <div className="grid gap-2">
                <Label htmlFor="discrepancy-reason">
                  Причина расхождения *
                </Label>
                <Textarea
                  id="discrepancy-reason"
                  value={discrepancyReason}
                  onChange={(e) => setDiscrepancyReason(e.target.value)}
                  placeholder="Укажите причину расхождения..."
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !actualBalance || (hasDiscrepancy && !discrepancyReason.trim())}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Открыть смену
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
