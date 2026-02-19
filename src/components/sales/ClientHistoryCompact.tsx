import { useState } from 'react';
import { History, ChevronDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ClientVisit } from './ClientSearchField';

interface ClientHistoryCompactProps {
  visits: ClientVisit[];
  isLoading?: boolean;
}

export function ClientHistoryCompact({ visits, isLoading }: ClientHistoryCompactProps) {
  const [showAll, setShowAll] = useState(false);
  
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Загрузка истории...
      </div>
    );
  }
  
  if (visits.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-1 flex items-center gap-1.5">
        <History className="h-3 w-3" />
        Нет истории посещений
      </div>
    );
  }
  
  const displayVisits = showAll ? visits.slice(0, 5) : visits.slice(0, 3);
  
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <History className="h-3 w-3" />
        Последние визиты
      </div>
      
      {/* Vertical list - each visit on new line */}
      <div className="space-y-0.5">
        {displayVisits.map((visit) => (
          <div
            key={visit.id}
            className="text-xs text-muted-foreground flex items-center gap-1"
          >
            <span className="text-muted-foreground/70">•</span>
            <span className="font-medium text-foreground">
              {format(parseISO(visit.date), 'dd.MM.yy', { locale: ru })}
            </span>
            <span className="text-muted-foreground">—</span>
            <span className="truncate flex-1">
              {visit.items.map(i => i.name).join(', ')}
            </span>
            <span className="font-medium text-foreground whitespace-nowrap">
              {visit.totalAmount.toLocaleString('ru-RU')} ₽
            </span>
          </div>
        ))}
      </div>
      
      {visits.length > 3 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll(!showAll)}
          className="h-5 px-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          {showAll ? 'Свернуть' : `Ещё ${visits.length - 3}`}
          <ChevronDown className={cn("h-3 w-3 ml-0.5 transition-transform", showAll && "rotate-180")} />
        </Button>
      )}
    </div>
  );
}
