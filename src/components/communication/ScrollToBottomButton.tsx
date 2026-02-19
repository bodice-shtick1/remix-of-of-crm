import { ArrowDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ScrollToBottomButtonProps {
  visible: boolean;
  newCount: number;
  onClick: () => void;
}

export function ScrollToBottomButton({ visible, newCount, onClick }: ScrollToBottomButtonProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        'absolute bottom-4 left-1/2 -translate-x-1/2 z-10',
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
        'bg-primary text-primary-foreground shadow-lg',
        'hover:bg-primary/90 transition-all duration-200',
        'animate-in fade-in slide-in-from-bottom-2'
      )}
    >
      <ArrowDown className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">Вниз</span>
      {newCount > 0 && (
        <Badge className="bg-destructive text-destructive-foreground text-[10px] h-4 min-w-[16px] px-1">
          {newCount}
        </Badge>
      )}
    </button>
  );
}
