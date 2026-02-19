import { Badge } from '@/components/ui/badge';
import { LockOpen, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShiftStatusBadgeProps {
  isOpen: boolean;
  className?: string;
}

export function ShiftStatusBadge({ isOpen, className }: ShiftStatusBadgeProps) {
  return (
    <Badge
      variant={isOpen ? 'default' : 'secondary'}
      className={cn(
        'gap-1.5',
        isOpen 
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-100' 
          : 'bg-muted text-muted-foreground',
        className
      )}
    >
      {isOpen ? (
        <>
          <LockOpen className="h-3 w-3" />
          Смена открыта
        </>
      ) : (
        <>
          <Lock className="h-3 w-3" />
          Смена закрыта
        </>
      )}
    </Badge>
  );
}
