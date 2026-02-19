import { Policy, Client } from '@/types/crm';
import { AlertTriangle, Calendar, Car, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpiringPoliciesProps {
  policies: Policy[];
  clients: Client[];
}

export function ExpiringPolicies({ policies, clients }: ExpiringPoliciesProps) {
  const getClient = (clientId: string) => clients.find(c => c.id === clientId);
  
  const getDaysUntilExpiry = (endDate: string) => {
    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryStatus = (days: number) => {
    if (days <= 7) return { color: 'text-destructive', bg: 'bg-destructive/10', label: 'Критично' };
    if (days <= 14) return { color: 'text-warning', bg: 'bg-warning/10', label: 'Скоро' };
    return { color: 'text-info', bg: 'bg-info/10', label: 'Планово' };
  };

  const expiringPolicies = policies
    .filter(p => {
      const days = getDaysUntilExpiry(p.endDate);
      return days > 0 && days <= 30;
    })
    .sort((a, b) => getDaysUntilExpiry(a.endDate) - getDaysUntilExpiry(b.endDate));

  if (expiringPolicies.length === 0) {
    return (
      <div className="card-elevated p-6">
        <h3 className="font-semibold text-foreground mb-4">Истекающие полисы</h3>
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-2 text-success/50" />
          <p>Нет полисов к продлению</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h3 className="font-semibold text-foreground">Истекающие полисы</h3>
          </div>
          <span className="text-xs bg-warning/10 text-warning px-2 py-1 rounded-full font-medium">
            {expiringPolicies.length}
          </span>
        </div>
      </div>
      <div className="divide-y divide-border max-h-80 overflow-y-auto scrollbar-thin">
        {expiringPolicies.map((policy) => {
          const client = getClient(policy.clientId);
          const days = getDaysUntilExpiry(policy.endDate);
          const status = getExpiryStatus(days);
          
          return (
            <div key={policy.id} className="p-4 hover:bg-muted/30 transition-colors cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {policy.type}
                    </span>
                    <span className={cn('status-badge text-[10px]', status.bg, status.color)}>
                      {days} дн.
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {client?.isCompany 
                      ? client.companyName 
                      : `${client?.lastName} ${client?.firstName}`
                    }
                  </p>
                  {policy.vehicleNumber && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <Car className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-mono">
                        {policy.vehicleNumber}
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">
                    до {new Date(policy.endDate).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short'
                    })}
                  </p>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {policy.premiumAmount.toLocaleString('ru-RU')} ₽
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
