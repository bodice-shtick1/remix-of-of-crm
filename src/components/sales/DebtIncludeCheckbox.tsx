import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { AlertTriangle, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useClientDebtDetails, DetailedDebtRecord } from '@/hooks/useClientDebtDetails';
import { cn } from '@/lib/utils';

interface DebtIncludeCheckboxProps {
  clientId: string | null;
  onDebtSelectionChange: (selectedDebts: DetailedDebtRecord[]) => void;
}

export function DebtIncludeCheckbox({ clientId, onDebtSelectionChange }: DebtIncludeCheckboxProps) {
  const { data: debts = [], isLoading } = useClientDebtDetails(clientId || '');
  const [selectedSaleIds, setSelectedSaleIds] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-select all debts when client changes and debts are loaded
  useEffect(() => {
    if (debts.length > 0) {
      // Auto-select all debts by default
      const allSaleIds = new Set(debts.map(d => d.saleId));
      setSelectedSaleIds(allSaleIds);
      setIsExpanded(true);
    } else {
      setSelectedSaleIds(new Set());
      setIsExpanded(false);
    }
  }, [clientId, debts]);

  // Notify parent when selection changes
  useEffect(() => {
    const selectedDebts = debts.filter(d => selectedSaleIds.has(d.saleId));
    onDebtSelectionChange(selectedDebts);
  }, [selectedSaleIds, debts]);

  if (!clientId || isLoading || debts.length === 0) {
    return null;
  }

  const totalDebt = debts.reduce((sum, d) => sum + d.remainingDebt, 0);
  const selectedDebt = debts
    .filter(d => selectedSaleIds.has(d.saleId))
    .reduce((sum, d) => sum + d.remainingDebt, 0);

  const toggleDebt = (saleId: string) => {
    setSelectedSaleIds(prev => {
      const next = new Set(prev);
      if (next.has(saleId)) {
        next.delete(saleId);
      } else {
        next.add(saleId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedSaleIds(new Set(debts.map(d => d.saleId)));
  };

  const deselectAll = () => {
    setSelectedSaleIds(new Set());
  };

  return (
    <div className="flex flex-col gap-1">
      {/* Compact debt badge */}
      <div 
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/10 border border-destructive/30 cursor-pointer hover:bg-destructive/15 transition-colors w-fit"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <AlertTriangle className="h-3 w-3 text-destructive" />
        <span className="text-xs font-medium text-destructive tabular-nums">
          Долг: {totalDebt.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}&nbsp;₽
        </span>
        {isExpanded ? (
          <ChevronUp className="h-3 w-3 text-destructive" />
        ) : (
          <ChevronDown className="h-3 w-3 text-destructive" />
        )}
      </div>

      {isExpanded && (
        <div className="mt-2 space-y-2 p-2 border rounded-md bg-muted/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Выберите долги для включения в чек:</span>
            <div className="flex gap-2">
              <Button variant="link" size="sm" className="h-5 p-0 text-xs" onClick={selectAll}>
                Все
              </Button>
              <span>/</span>
              <Button variant="link" size="sm" className="h-5 p-0 text-xs" onClick={deselectAll}>
                Снять
              </Button>
            </div>
          </div>

          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {debts.map((debt) => (
              <div
                key={debt.saleId}
                className={cn(
                  'flex items-start gap-2 p-1.5 rounded border transition-colors cursor-pointer',
                  selectedSaleIds.has(debt.saleId) 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                )}
                onClick={() => toggleDebt(debt.saleId)}
              >
                <Checkbox
                  checked={selectedSaleIds.has(debt.saleId)}
                  onCheckedChange={() => toggleDebt(debt.saleId)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">
                      #{debt.saleUid}
                    </span>
                    <span className={cn(
                      'text-xs font-bold tabular-nums',
                      debt.isOverdue ? 'text-destructive' : 'text-foreground'
                    )}>
                      {debt.remainingDebt.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}&nbsp;₽
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {debt.items.slice(0, 2).map(item => item.productName).join(', ')}
                    {debt.items.length > 2 && ` +${debt.items.length - 2}`}
                  </div>
                  {debt.dueDate && (
                    <div className={cn(
                      'text-[10px]',
                      debt.isOverdue ? 'text-destructive' : 'text-muted-foreground'
                    )}>
                      {debt.isOverdue ? 'Просрочен ' : 'До '}
                      {format(parseISO(debt.dueDate), 'd.MM.yy', { locale: ru })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {selectedDebt > 0 && (
            <div className="flex items-center justify-between pt-1.5 border-t text-xs">
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-success" />
                К погашению:
              </span>
              <span className="font-bold text-success tabular-nums">
                +{selectedDebt.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}&nbsp;₽
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
