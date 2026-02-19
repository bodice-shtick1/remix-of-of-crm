import { Wallet, TrendingUp, Banknote, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTodayDebtPayments } from '@/hooks/useDebtPayments';

export function TodayDebtCollectedWidget() {
  const { data, isLoading } = useTodayDebtPayments();

  if (isLoading) {
    return (
      <Card className="card-elevated">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-5 w-5 text-success" />
            Собрано долгов за сегодня
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    );
  }

  const total = data?.total ?? 0;
  const totalCash = data?.totalCash ?? 0;
  const totalCard = data?.totalCard ?? 0;
  const count = data?.count ?? 0;

  return (
    <Card className={`card-elevated ${total > 0 ? 'bg-gradient-to-br from-success/5 to-success/10 border-success/20' : ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {total > 0 ? (
            <TrendingUp className="h-5 w-5 text-success" />
          ) : (
            <Wallet className="h-5 w-5 text-muted-foreground" />
          )}
          Собрано долгов за сегодня
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold ${total > 0 ? 'text-success' : 'text-muted-foreground'}`}>
          {total.toLocaleString('ru-RU')} ₽
        </p>
        {total > 0 && (
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            {totalCash > 0 && (
              <span className="flex items-center gap-1">
                <Banknote className="h-4 w-4 text-success" />
                {totalCash.toLocaleString('ru-RU')} ₽
              </span>
            )}
            {totalCard > 0 && (
              <span className="flex items-center gap-1">
                <CreditCard className="h-4 w-4 text-primary" />
                {totalCard.toLocaleString('ru-RU')} ₽
              </span>
            )}
            <span>{count} платежей</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
