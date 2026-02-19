import { useState, useMemo } from 'react';
import { Calculator, CreditCard, Banknote, QrCode, Check, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { PaymentMethod, SaleItem } from '@/types/crm';
import { cn } from '@/lib/utils';

interface FinanceModuleProps {
  items: SaleItem[];
  roundingAmount: number;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onToggleRounding: (enabled: boolean) => void;
  onComplete: () => void;
  isRoundingEnabled: boolean;
}

export function FinanceModule({
  items,
  roundingAmount,
  paymentMethod,
  onPaymentMethodChange,
  onToggleRounding,
  onComplete,
  isRoundingEnabled,
}: FinanceModuleProps) {
  const [showQR, setShowQR] = useState(false);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.amount, 0);
  }, [items]);

  const total = subtotal + roundingAmount;

  const commission = useMemo(() => {
    return items.reduce((sum, item) => {
      if (item.type === 'insurance' && item.insuranceProduct) {
        return sum + (item.insuranceProduct.premiumAmount * item.insuranceProduct.commissionPercent / 100);
      }
      if (item.type === 'service') {
        return sum + item.amount;
      }
      return sum;
    }, 0);
  }, [items]);

  const paymentMethods: { id: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { id: 'cash', label: 'Наличные', icon: <Banknote className="h-4 w-4" /> },
    { id: 'card', label: 'Карта', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'sbp', label: 'СБП', icon: <QrCode className="h-4 w-4" /> },
    { id: 'transfer', label: 'Перевод', icon: <Calculator className="h-4 w-4" /> },
  ];

  return (
    <div className="card-elevated p-4">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Умная касса</h3>
      </div>

      {/* Сводка */}
      <div className="space-y-3 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Подытог:</span>
          <span>{subtotal.toLocaleString('ru-RU')} ₽</span>
        </div>
        
        {roundingAmount > 0 && (
          <div className="flex justify-between text-sm text-primary">
            <span>Округление:</span>
            <span>+{roundingAmount.toLocaleString('ru-RU')} ₽</span>
          </div>
        )}
        
        <div className="h-px bg-border" />
        
        <div className="flex justify-between items-baseline">
          <span className="font-medium">Итого к оплате:</span>
          <span className="text-2xl font-bold text-primary">
            {total.toLocaleString('ru-RU')} ₽
          </span>
        </div>
        
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Ваша комиссия:</span>
          <span className="text-green-600 font-medium">
            +{commission.toLocaleString('ru-RU')} ₽
          </span>
        </div>
      </div>

      {/* Переключатель округления */}
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg mb-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="rounding" className="text-sm cursor-pointer">
            Без сдачи (округление)
          </Label>
        </div>
        <Switch
          id="rounding"
          checked={isRoundingEnabled}
          onCheckedChange={onToggleRounding}
        />
      </div>

      {/* Способ оплаты */}
      <div className="mb-6">
        <Label className="text-sm text-muted-foreground mb-2 block">Способ оплаты</Label>
        <div className="grid grid-cols-4 gap-2">
          {paymentMethods.map((method) => (
            <button
              key={method.id}
              onClick={() => {
                onPaymentMethodChange(method.id);
                if (method.id === 'sbp') setShowQR(true);
              }}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-lg border transition-all",
                paymentMethod === method.id
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:border-primary/50"
              )}
            >
              {method.icon}
              <span className="text-xs">{method.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* QR-код СБП */}
      {paymentMethod === 'sbp' && showQR && (
        <div className="mb-6 p-4 bg-muted/30 rounded-lg text-center">
          <p className="text-sm text-muted-foreground mb-3">Сканируйте QR-код для оплаты</p>
          <div className="w-48 h-48 mx-auto bg-white rounded-lg flex items-center justify-center border">
            <div className="text-center">
              <QrCode className="h-24 w-24 mx-auto text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground mt-2">QR-код СБП</p>
            </div>
          </div>
          <p className="text-lg font-bold mt-3">{total.toLocaleString('ru-RU')} ₽</p>
        </div>
      )}

      {/* Кнопки действий */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 gap-2">
          <Receipt className="h-4 w-4" />
          Товарный чек
        </Button>
        <Button 
          onClick={onComplete} 
          className="flex-1 gap-2 btn-gradient"
          disabled={items.length === 0}
        >
          <Check className="h-4 w-4" />
          Провести
        </Button>
      </div>
    </div>
  );
}
