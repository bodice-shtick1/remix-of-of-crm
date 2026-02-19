import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export interface DebtPaymentDetail {
  id: string;
  amount: number;
  payment_method: string;
  paid_at: string;
  client_name: string;
  sale_description: string;
  debt_date: string;
}

interface DebtPaymentsDetailTableProps {
  payments: DebtPaymentDetail[];
  totalCash: number;
  totalCard: number;
  totalAmount: number;
  compact?: boolean;
}

const paymentMethodLabels: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  transfer: 'Перевод',
  sbp: 'СБП',
};

export function DebtPaymentsDetailTable({
  payments,
  totalCash,
  totalCard,
  totalAmount,
  compact = false,
}: DebtPaymentsDetailTableProps) {
  if (payments.length === 0) {
    return (
      <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
        Возвраты долгов: 0 ₽
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
        <Wallet className="h-4 w-4" />
        <span className={compact ? 'text-xs font-medium' : 'text-sm font-medium'}>
          Погашение долгов за смену
        </span>
        <span className={compact ? 'text-sm font-semibold ml-auto' : 'text-lg font-bold ml-auto'}>
          {totalAmount.toLocaleString('ru-RU')} ₽
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm text-emerald-600 dark:text-emerald-400 mb-2">
        {totalCash > 0 && <span>нал: {totalCash.toLocaleString('ru-RU')} ₽</span>}
        {totalCard > 0 && <span>безнал: {totalCard.toLocaleString('ru-RU')} ₽</span>}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Клиент</TableHead>
              <TableHead>Основание</TableHead>
              <TableHead>Дата долга</TableHead>
              <TableHead className="text-center">Оплата</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="font-medium">{payment.client_name}</TableCell>
                <TableCell className="text-sm">{payment.sale_description}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(payment.debt_date), 'dd.MM.yyyy', { locale: ru })}
                </TableCell>
                <TableCell className="text-center text-sm">
                  {paymentMethodLabels[payment.payment_method] || payment.payment_method}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {payment.amount.toLocaleString('ru-RU')} ₽
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell colSpan={4}>Итого погашение долгов</TableCell>
              <TableCell className="text-right">
                {totalAmount.toLocaleString('ru-RU')} ₽
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
