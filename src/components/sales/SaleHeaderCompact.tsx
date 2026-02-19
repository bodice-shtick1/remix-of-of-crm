import { useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { History, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { AuditLogEntry } from '@/types/crm';
import { cn } from '@/lib/utils';

interface SaleHeaderCompactProps {
  uid: string;
  createdAt: Date;
  auditLog: AuditLogEntry[];
}

export function SaleHeaderCompact({ uid, createdAt, auditLog }: SaleHeaderCompactProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex items-center justify-between py-1.5 px-2">
      <div className="flex items-center gap-2 text-sm font-mono">
        <FileText className="h-3.5 w-3.5 text-primary" />
        <span className="text-muted-foreground">№</span>
        <span className="font-semibold">{uid}</span>
        <span className="text-muted-foreground">от</span>
        <span className="font-medium">
          {format(createdAt, 'dd.MM.yy HH:mm', { locale: ru })}
        </span>
      </div>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn(
              "h-7 w-7 p-0",
              auditLog.length > 1 && "text-primary"
            )}
            title="История изменений"
          >
            <History className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="p-3 border-b bg-muted/30">
            <h4 className="font-semibold text-sm">История изменений</h4>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {auditLog.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">
                Изменений пока нет
              </p>
            ) : (
              <div className="divide-y">
                {auditLog.map((entry) => (
                  <div 
                    key={entry.id} 
                    className="p-3 text-sm hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium text-xs">{entry.userName}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(entry.timestamp), 'dd.MM HH:mm')}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">{entry.action}</p>
                    {entry.field && (
                      <p className="text-[10px] mt-1">
                        <span className="text-muted-foreground">{entry.field}: </span>
                        {entry.oldValue && (
                          <span className="line-through text-destructive mr-1">{entry.oldValue}</span>
                        )}
                        {entry.newValue && (
                          <span className="text-primary">{entry.newValue}</span>
                        )}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
