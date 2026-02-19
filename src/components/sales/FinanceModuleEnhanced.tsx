import { useState, useMemo, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Calculator, CreditCard, Banknote, QrCode, Check, Receipt, Building2, CalendarClock, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { SaleItemRow } from './SaleItemsTableInline';
import { usePermissions } from '@/hooks/usePermissions';

export type PaymentMethodType = 'cash' | 'card' | 'sbp' | 'transfer' | 'debt';

export interface Bank {
  id: string;
  name: string;
}

interface FinanceModuleEnhancedProps {
  items: SaleItemRow[];
  paymentMethod: PaymentMethodType;
  onPaymentMethodChange: (method: PaymentMethodType) => void;
  onToggleRounding: (enabled: boolean, roundingAmount: number) => void;
  onComplete: () => void;
  onCompleteAndNext: () => void;
  onPrintCashReceipt: () => void;
  onPrintCommodityReceipt: () => void;
  isRoundingEnabled: boolean;
  showCommission: boolean;
  banks: Bank[];
  selectedBankId?: string;
  onBankChange: (bankId: string) => void;
  installmentDueDate?: string;
  onInstallmentDueDateChange: (date: string) => void;
  installmentPaymentsCount?: number;
  onInstallmentPaymentsCountChange: (count: number) => void;
  roundingStep?: number;
  selectedDebtsTotal?: number;
}

export interface FinanceModuleEnhancedRef {
  focusPaymentMethod: () => void;
}

export const FinanceModuleEnhanced = forwardRef<FinanceModuleEnhancedRef, FinanceModuleEnhancedProps>(({
  items,
  paymentMethod,
  onPaymentMethodChange,
  onToggleRounding,
  onComplete,
  onCompleteAndNext,
  onPrintCashReceipt,
  onPrintCommodityReceipt,
  isRoundingEnabled,
  showCommission,
  banks,
  selectedBankId,
  onBankChange,
  installmentDueDate,
  onInstallmentDueDateChange,
  installmentPaymentsCount,
  onInstallmentPaymentsCountChange,
  roundingStep = 100,
  selectedDebtsTotal = 0,
}, ref) => {
  const [showQR, setShowQR] = useState(false);
  const paymentMethodRef = useRef<HTMLButtonElement>(null);
  const { can } = usePermissions();

  const paymentMethodsList: PaymentMethodType[] = ['cash', 'card', 'sbp', 'transfer', 'debt'];

  useImperativeHandle(ref, () => ({
    focusPaymentMethod: () => {
      paymentMethodRef.current?.focus();
    }
  }));

  // Keyboard shortcuts for payment method (1-5)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const key = e.key;
      if (key >= '1' && key <= '5') {
        e.preventDefault();
        const index = parseInt(key) - 1;
        const method = paymentMethodsList[index];
        onPaymentMethodChange(method);
        if (method === 'sbp') setShowQR(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPaymentMethodChange]);

  // Calculate subtotal (excluding rounding items)
  const subtotal = useMemo(() => {
    return items
      .filter(item => item.type !== 'rounding')
      .reduce((sum, item) => sum + item.premiumAmount, 0);
  }, [items]);

  // Calculate rounding amount
  const roundingAmount = useMemo(() => {
    if (!isRoundingEnabled || subtotal === 0) return 0;
    const roundTo = roundingStep;
    const rounded = Math.ceil(subtotal / roundTo) * roundTo;
    return rounded - subtotal;
  }, [isRoundingEnabled, subtotal, roundingStep]);

  const total = subtotal + roundingAmount + selectedDebtsTotal;

  const commission = useMemo(() => {
    return items
      .filter(item => item.type !== 'rounding')
      .reduce((sum, item) => {
        if (item.type === 'insurance' && item.commissionPercent) {
          return sum + (item.premiumAmount * item.commissionPercent / 100);
        }
        if (item.type === 'service') {
          return sum + item.premiumAmount;
        }
        return sum;
      }, 0);
  }, [items]);

  const formatAmount = (value: number): string => {
    return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Call parent when rounding changes
  const handleRoundingToggle = (enabled: boolean) => {
    const newRoundingAmount = enabled && subtotal > 0 
      ? Math.ceil(subtotal / roundingStep) * roundingStep - subtotal 
      : 0;
    onToggleRounding(enabled, newRoundingAmount);
  };

  // Update rounding amount when subtotal changes
  useEffect(() => {
    if (isRoundingEnabled && subtotal > 0) {
      const newRoundingAmount = Math.ceil(subtotal / roundingStep) * roundingStep - subtotal;
      if (newRoundingAmount !== roundingAmount) {
        onToggleRounding(true, newRoundingAmount);
      }
    }
  }, [subtotal, isRoundingEnabled, roundingStep]);

  const paymentMethods: { id: PaymentMethodType; label: string; icon: React.ReactNode; permKey: string }[] = [
    { id: 'cash', label: 'Наличные', icon: <Banknote className="h-4 w-4" />, permKey: 'pay_cash' },
    { id: 'card', label: 'Карта', icon: <CreditCard className="h-4 w-4" />, permKey: 'pay_card' },
    { id: 'sbp', label: 'СБП', icon: <QrCode className="h-4 w-4" />, permKey: 'pay_sbp' },
    { id: 'transfer', label: 'Перевод', icon: <Building2 className="h-4 w-4" />, permKey: 'pay_transfer' },
    { id: 'debt', label: 'Долг/Рассрочка', icon: <CalendarClock className="h-4 w-4" />, permKey: 'pay_debt' },
  ];

  // Check if there are valid items (with amount > 0)
  const hasValidItems = items.some(item => item.type !== 'rounding' && item.premiumAmount > 0);

  return (
    <div className="card-elevated p-3">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Умная касса</h3>
      </div>

      {/* Summary - compact */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Подытог:</span>
          <span>{formatAmount(subtotal)} ₽</span>
        </div>
        
        {roundingAmount > 0 && (
          <div className="flex justify-between text-xs text-primary">
            <span>Округление:</span>
            <span>+{formatAmount(roundingAmount)} ₽</span>
          </div>
        )}
        
        {selectedDebtsTotal > 0 && (
          <div className="flex justify-between text-xs text-destructive">
            <span>Погашение долга:</span>
            <span>+{formatAmount(selectedDebtsTotal)} ₽</span>
          </div>
        )}
        
        <div className="h-px bg-border" />
        
        <div className="flex justify-between items-baseline">
          <span className="font-medium text-sm">Итого:</span>
          <span className="text-xl font-bold text-primary">
            {formatAmount(total)} ₽
          </span>
        </div>
        
        {showCommission && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Ваша комиссия:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              +{formatAmount(commission)} ₽
            </span>
          </div>
        )}
      </div>

      {/* Rounding switch - compact */}
      {can('receipt_none') && (
      <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg mb-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
          <Label htmlFor="rounding" className="text-xs cursor-pointer">
            Без сдачи
          </Label>
        </div>
        <Switch
          id="rounding"
          checked={isRoundingEnabled}
          onCheckedChange={handleRoundingToggle}
          disabled={subtotal === 0}
          className="scale-90"
        />
      </div>
      )}

      {/* Payment method - compact grid */}
      {can('sale_process') && (
        <div className="mb-3">
          <Label className="text-xs text-muted-foreground mb-1.5 block">Способ оплаты</Label>
          <div className="grid grid-cols-5 gap-1">
            {paymentMethods.map((method, index) => (
              can(method.permKey) && (
              <button
                key={method.id}
                ref={index === 0 ? paymentMethodRef : undefined}
                onClick={() => {
                  onPaymentMethodChange(method.id);
                  if (method.id === 'sbp') setShowQR(true);
                }}
                className={cn(
                  "flex flex-col items-center gap-0.5 p-1.5 rounded-md border transition-all text-[10px]",
                  paymentMethod === method.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/50"
                )}
              >
                {method.icon}
                <span className="leading-tight text-center">{method.label}</span>
              </button>
              )
            ))}
          </div>
        </div>
      )}

      {/* Bank selection for transfer */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          paymentMethod === 'transfer' 
            ? "grid-rows-[1fr] opacity-100 mb-4" 
            : "grid-rows-[0fr] opacity-0 mb-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="p-3 bg-muted/30 rounded-lg space-y-3">
            <Label className="text-sm">Выберите банк</Label>
            <Select value={selectedBankId} onValueChange={onBankChange}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите банк" />
              </SelectTrigger>
              <SelectContent>
                {banks.map((bank) => (
                  <SelectItem key={bank.id} value={bank.id}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Installment options for debt */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          paymentMethod === 'debt' 
            ? "grid-rows-[1fr] opacity-100 mb-4" 
            : "grid-rows-[0fr] opacity-0 mb-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="p-3 bg-muted/30 rounded-lg space-y-3">
            <Label className="text-sm font-medium">Параметры рассрочки</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Срок до</Label>
                <Input
                  type="date"
                  value={installmentDueDate || ''}
                  onChange={(e) => onInstallmentDueDateChange(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Количество платежей</Label>
                <Input
                  type="number"
                  value={installmentPaymentsCount || ''}
                  onChange={(e) => onInstallmentPaymentsCountChange(parseInt(e.target.value) || 1)}
                  min={1}
                  max={12}
                  className="h-9"
                  placeholder="1"
                />
              </div>
            </div>
            {installmentPaymentsCount && installmentPaymentsCount > 1 && (
              <p className="text-xs text-muted-foreground">
                Сумма платежа: {formatAmount(total / installmentPaymentsCount)} ₽ × {installmentPaymentsCount}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* SBP QR Code */}
      {paymentMethod === 'sbp' && showQR && (
        <div className="mb-4 p-4 bg-muted/30 rounded-lg text-center">
          <p className="text-sm text-muted-foreground mb-3">Сканируйте QR-код для оплаты</p>
          <div className="w-40 h-40 mx-auto bg-white rounded-lg flex items-center justify-center border">
            <div className="text-center">
              <QrCode className="h-20 w-20 mx-auto text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground mt-1">QR-код СБП</p>
            </div>
          </div>
          <p className="text-lg font-bold mt-3">{formatAmount(total)} ₽</p>
        </div>
      )}

      {/* Print buttons */}
      {(can('receipt_cash') || can('receipt_bill')) && (
        <div className="flex gap-2 mb-4">
          {can('receipt_cash') && (
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 gap-1 text-xs"
            onClick={onPrintCashReceipt}
            disabled={!hasValidItems}
          >
            <Printer className="h-3 w-3" />
            Кассовый чек
          </Button>
          )}
          {can('receipt_bill') && (
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 gap-1 text-xs"
            onClick={onPrintCommodityReceipt}
            disabled={!hasValidItems}
          >
            <Receipt className="h-3 w-3" />
            Товарный чек
          </Button>
          )}
        </div>
      )}

      {/* Action buttons */}
      {can('sale_finalize') && (
      <div className="flex gap-2">
        <Button 
          onClick={onComplete} 
          variant="outline"
          className="flex-1 gap-2"
          disabled={!hasValidItems}
        >
          <Check className="h-4 w-4" />
          <span>Провести продажу</span>
        </Button>
        <Button 
          onClick={onCompleteAndNext} 
          className="flex-1 gap-2 btn-gradient"
          disabled={!hasValidItems}
        >
          <Check className="h-4 w-4" />
          <span>Провести и след.</span>
        </Button>
      </div>
      )}
    </div>
  );
});

FinanceModuleEnhanced.displayName = 'FinanceModuleEnhanced';
