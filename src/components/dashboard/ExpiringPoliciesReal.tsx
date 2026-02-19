import { useState } from 'react';
import { AlertTriangle, Calendar, Car, MoreHorizontal, Check, X, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExpiringPolicy } from '@/hooks/useDashboardData';
import {
  useProlongationStatus,
  ProlongationStatus,
} from '@/hooks/useProlongationStatus';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ExpiringPoliciesRealProps {
  policies: ExpiringPolicy[];
}

export function ExpiringPoliciesReal({ policies }: ExpiringPoliciesRealProps) {
  const { updateStatus, isUpdating } = useProlongationStatus();
  const [hiddenPolicies, setHiddenPolicies] = useState<Set<string>>(new Set());

  const getDaysUntilExpiry = (endDate: string) => {
    const today = new Date();
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const handleStatusChange = (policyId: string, status: ProlongationStatus) => {
    setHiddenPolicies(prev => new Set(prev).add(policyId));
    updateStatus({ policyId, status });
  };

  const visiblePolicies = policies.filter(p => !hiddenPolicies.has(p.id));

  if (visiblePolicies.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <Calendar className="h-4 w-4 text-success" />
          Истекающие полисы
        </div>
        <p className="text-xs text-muted-foreground text-center py-4">Нет полисов к продлению</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Истекающие полисы
        </div>
        <span className="text-[11px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full font-medium">
          {visiblePolicies.length}
        </span>
      </div>
      <ScrollArea className="max-h-[260px]">
        <div className="divide-y divide-border/40">
          {visiblePolicies.map((policy) => {
            const days = getDaysUntilExpiry(policy.end_date);
            const urgent = days <= 7;
            const soon = days <= 14;

            return (
              <div key={policy.id} className="px-3 py-2 hover:bg-muted/30 transition-colors group flex items-center gap-3">
                {/* Days badge */}
                <div className={cn(
                  'shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center text-[10px] leading-tight font-medium',
                  urgent ? 'bg-destructive/10 text-destructive' :
                  soon ? 'bg-warning/10 text-warning' :
                  'bg-info/10 text-info'
                )}>
                  <span className="text-sm font-bold">{days}</span>
                  дн.
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground truncate">{policy.client_name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                    <span>{policy.policy_type}</span>
                    {policy.vehicle_number && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-0.5 font-mono">
                          <Car className="h-2.5 w-2.5" />
                          {policy.vehicle_number}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Amount + date */}
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-foreground">{policy.premium_amount.toLocaleString('ru-RU')} ₽</p>
                  <p className="text-[10px] text-muted-foreground">
                    до {new Date(policy.end_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                  </p>
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" disabled={isUpdating}>
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => handleStatusChange(policy.id, 'prolonged')} className="gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 text-success" /> Пролонгирован
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange(policy.id, 'lost')} className="gap-2 text-xs">
                      <UserX className="h-3.5 w-3.5 text-orange-500" /> Ушел к другому
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange(policy.id, 'irrelevant')} className="gap-2 text-xs">
                      <X className="h-3.5 w-3.5 text-muted-foreground" /> Неактуально
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
