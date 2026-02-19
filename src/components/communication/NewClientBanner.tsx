import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';

interface NewClientBannerProps {
  clientName: string;
  onFillDetails: () => void;
}

export function NewClientBanner({ clientName, onFillDetails }: NewClientBannerProps) {
  return (
    <div className="mx-4 mt-2 p-3 rounded-lg bg-accent/50 border border-accent flex items-center gap-3">
      <UserPlus className="h-5 w-5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Временный контакт</p>
        <p className="text-xs text-muted-foreground truncate">{clientName} — данные не заполнены</p>
      </div>
      <Button size="sm" variant="outline" onClick={onFillDetails} className="shrink-0 text-xs">
        Заполнить данные
      </Button>
    </div>
  );
}
