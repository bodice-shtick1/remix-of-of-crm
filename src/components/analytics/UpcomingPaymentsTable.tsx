import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isBefore, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { AlertTriangle, CalendarClock } from 'lucide-react';
import { getClientDisplayName } from '@/lib/mappers';

interface Payment {
  id: string;
  uid: string;
  client_id: string;
  total_amount: number;
  amount_paid: number;
  installment_due_date: string | null;
  debt_status: string;
  clients: { first_name: string; last_name: string; phone: string } | null;
}

interface UpcomingPaymentsTableProps {
  payments: Payment[];
  isLoading: boolean;
}

export function UpcomingPaymentsTable({ payments, isLoading }: UpcomingPaymentsTableProps) {
  const today = startOfDay(new Date());

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Ближайшие выплаты</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-48 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-muted-foreground" />
          Ближайшие выплаты (7 дней)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Нет предстоящих платежей</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Клиент</TableHead>
                <TableHead>Продажа</TableHead>
                <TableHead className="text-right">Долг</TableHead>
                <TableHead>Дата платежа</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map(p => {
                const debt = Number(p.total_amount) - Number(p.amount_paid);
                const dueDate = p.installment_due_date ? new Date(p.installment_due_date) : null;
                const isOverdue = dueDate ? isBefore(dueDate, today) : false;
                const client = p.clients as any;

                return (
                  <TableRow key={p.id} className={isOverdue ? 'bg-destructive/5' : ''}>
                    <TableCell className="font-medium">
                      {getClientDisplayName(client)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{p.uid}</TableCell>
                    <TableCell className="text-right font-medium">{debt.toLocaleString('ru-RU')} ₽</TableCell>
                    <TableCell>
                      {dueDate ? format(dueDate, 'd MMM yyyy', { locale: ru }) : '—'}
                    </TableCell>
                    <TableCell>
                      {isOverdue ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Просрочен
                        </Badge>
                      ) : (
                        <Badge variant="outline">Ожидает</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
