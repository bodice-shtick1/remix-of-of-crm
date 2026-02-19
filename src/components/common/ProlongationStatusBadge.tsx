import { cn } from '@/lib/utils';
import { 
  ProlongationStatus, 
  prolongationStatusLabels, 
  prolongationStatusColors 
} from '@/hooks/useProlongationStatus';

interface ProlongationStatusBadgeProps {
  status: ProlongationStatus;
  className?: string;
  showPending?: boolean; // If false, don't show badge for 'pending' status
}

export function ProlongationStatusBadge({ 
  status, 
  className,
  showPending = false 
}: ProlongationStatusBadgeProps) {
  // Don't show badge for pending status unless explicitly requested
  if (status === 'pending' && !showPending) {
    return null;
  }

  const colors = prolongationStatusColors[status];
  const label = prolongationStatusLabels[status];

  return (
    <span 
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        colors.bg,
        colors.text,
        className
      )}
    >
      {label}
    </span>
  );
}
