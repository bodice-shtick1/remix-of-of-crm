import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useClientDebts } from '@/hooks/useDebts';
import { cn } from '@/lib/utils';

interface ClientDebtBadgeProps {
  clientId: string;
}

export function ClientDebtBadge({ clientId }: ClientDebtBadgeProps) {
  const { hasDebts, totalDebt, nearestDueDate, hasOverdue, isLoading } = useClientDebts(clientId);

  if (isLoading || !hasDebts) {
    return null;
  }

  return (
    <Badge 
      variant="destructive" 
      className={cn(
        'gap-1 text-xs',
        hasOverdue ? 'animate-pulse' : ''
      )}
    >
      <AlertTriangle className="h-3 w-3" />
      Долг: {totalDebt.toLocaleString('ru-RU')} ₽
      {nearestDueDate && (
        <span className="opacity-80">
          до {format(parseISO(nearestDueDate), 'd MMM', { locale: ru })}
        </span>
      )}
    </Badge>
  );
}
