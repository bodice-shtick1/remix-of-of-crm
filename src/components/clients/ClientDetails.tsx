import { Client, Policy } from '@/types/crm';
import { 
  Phone, Mail, MapPin, Calendar, FileText, 
  User, Building2, CreditCard, X, Edit2, 
  MessageCircle, Car
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

interface ClientDetailsProps {
  client: Client;
  policies: Policy[];
  onClose: () => void;
}

const paymentStatusLabels = {
  pending: { label: 'Ожидает оплаты', class: 'status-warning' },
  paid: { label: 'Оплачено', class: 'status-success' },
  transferred: { label: 'В СК', class: 'status-info' },
  commission_received: { label: 'Комиссия получена', class: 'status-success' },
};

export function ClientDetails({ client, policies, onClose }: ClientDetailsProps) {
  const { can } = usePermissions();
  const clientPolicies = policies.filter(p => p.clientId === client.id);
  
  const displayName = client.isCompany 
    ? client.companyName 
    : `${client.lastName} ${client.firstName} ${client.middleName || ''}`.trim();

  const initials = client.isCompany
    ? (client.companyName?.substring(0, 2).toUpperCase() || 'КО')
    : `${client.lastName?.[0] || ''}${client.firstName?.[0] || ''}`.toUpperCase();

  const totalPremium = clientPolicies.reduce((sum, p) => sum + p.premiumAmount, 0);
  const totalCommission = clientPolicies.reduce((sum, p) => sum + p.commissionAmount, 0);

  return (
    <div className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm animate-fade-in">
      <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border shadow-elevated overflow-hidden animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className={cn(
              'avatar-initials h-10 w-10 text-sm',
              client.isCompany && 'bg-accent'
            )}>
              {client.isCompany ? <Building2 className="h-5 w-5" /> : initials}
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{displayName}</h2>
              <p className="text-xs text-muted-foreground">
                {client.createdAt && !isNaN(new Date(client.createdAt).getTime())
                  ? `Клиент с ${new Date(client.createdAt).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`
                  : 'Клиент'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-65px)] overflow-y-auto scrollbar-thin">
          {/* Quick Actions */}
          <div className="p-4 border-b border-border">
            <div className="flex gap-2">
              {can('client_comm_actions') && (
                <Button variant="outline" size="sm" className="flex-1 gap-2">
                  <Phone className="h-4 w-4" />
                  Позвонить
                </Button>
              )}
              {can('client_comm_actions') && (
                <Button variant="outline" size="sm" className="flex-1 gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Сообщение
                </Button>
              )}
              {can('client_info_edit') && (
                <Button variant="outline" size="sm" className="gap-2">
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Contact Info */}
          {can('client_contacts_view') && (
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-medium text-foreground mb-3">Контактная информация</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <Phone className="h-4 w-4 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-foreground">{client.phone}</p>
                  <p className="text-xs text-muted-foreground">Телефон</p>
                </div>
              </div>
              {client.email && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-secondary">
                    <Mail className="h-4 w-4 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-foreground">{client.email}</p>
                    <p className="text-xs text-muted-foreground">Email</p>
                  </div>
                </div>
              )}
              {client.address && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-secondary">
                    <MapPin className="h-4 w-4 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-foreground">{client.address}</p>
                    <p className="text-xs text-muted-foreground">Адрес</p>
                  </div>
                </div>
              )}
              {client.birthDate && !client.isCompany && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-secondary">
                    <Calendar className="h-4 w-4 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-foreground">
                      {new Date(client.birthDate).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">Дата рождения</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Stats */}
          <div className="p-4 border-b border-border">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-primary/5 rounded-lg p-3 text-center">
                <p className="text-lg font-semibold text-primary">{totalPremium.toLocaleString('ru-RU')} ₽</p>
                <p className="text-xs text-muted-foreground">Премии</p>
              </div>
              <div className="bg-success/5 rounded-lg p-3 text-center">
                <p className="text-lg font-semibold text-success">{totalCommission.toLocaleString('ru-RU')} ₽</p>
                <p className="text-xs text-muted-foreground">Комиссия</p>
              </div>
            </div>
          </div>

          {/* Policies */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">Полисы</h3>
              <Button variant="ghost" size="sm" className="text-primary h-7">
                + Добавить
              </Button>
            </div>
            <div className="space-y-2">
              {clientPolicies.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Нет полисов
                </div>
              ) : (
                clientPolicies.map((policy) => (
                  <div key={policy.id} className="p-3 rounded-lg border border-border hover:border-primary/30 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{policy.type}</span>
                          <span className={cn(
                            'status-badge text-[10px]',
                            policy.status === 'active' && 'status-success',
                            policy.status === 'expiring_soon' && 'status-warning',
                            policy.status === 'expired' && 'status-danger'
                          )}>
                            {policy.status === 'active' && 'Активен'}
                            {policy.status === 'expiring_soon' && 'Истекает'}
                            {policy.status === 'expired' && 'Истек'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {policy.insuranceCompany} • №{policy.policyNumber}
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
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">
                          {policy.premiumAmount.toLocaleString('ru-RU')} ₽
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          до {new Date(policy.endDate).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <span className={cn('status-badge text-[10px]', paymentStatusLabels[policy.paymentStatus].class)}>
                        {paymentStatusLabels[policy.paymentStatus].label}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
