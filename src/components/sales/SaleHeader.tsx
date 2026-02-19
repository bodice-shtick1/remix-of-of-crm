import { useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { History, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AuditLogEntry } from '@/types/crm';

interface SaleHeaderProps {
  uid: string;
  createdAt: Date;
  auditLog: AuditLogEntry[];
}

export function SaleHeader({ uid, createdAt, auditLog }: SaleHeaderProps) {
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  return (
    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Документ №</p>
            <p className="font-mono font-semibold text-foreground">{uid}</p>
          </div>
        </div>
        
        <div className="h-8 w-px bg-border" />
        
        <div>
          <p className="text-xs text-muted-foreground">Дата и время</p>
          <p className="font-medium text-foreground">
            {format(createdAt, 'dd MMMM yyyy, HH:mm', { locale: ru })}
          </p>
        </div>
      </div>

      <Dialog open={isAuditOpen} onOpenChange={setIsAuditOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <History className="h-4 w-4" />
            История изменений
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>История изменений</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {auditLog.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Изменений пока нет
              </p>
            ) : (
              <div className="space-y-3">
                {auditLog.map((entry) => (
                  <div 
                    key={entry.id} 
                    className="p-3 bg-muted/50 rounded-lg border text-sm"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{entry.userName}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(entry.timestamp), 'dd.MM.yyyy HH:mm')}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{entry.action}</p>
                    {entry.field && (
                      <p className="text-xs mt-1">
                        <span className="text-muted-foreground">{entry.field}: </span>
                        {entry.oldValue && (
                          <span className="line-through text-destructive mr-2">{entry.oldValue}</span>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
