import { useState, useMemo } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { 
  Wallet, TrendingUp, CreditCard, Building2, 
  ArrowDownLeft, ArrowUpRight, Calendar,
  Download, Filter, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const paymentLabels: Record<string, { label: string; class: string }> = {
  pending: { label: 'Ожидает оплаты', class: 'status-warning' },
  paid: { label: 'Оплачено клиентом', class: 'status-success' },
  transferred: { label: 'Перечислено в СК', class: 'status-info' },
  commission_received: { label: 'Комиссия получена', class: 'status-success' },
};

export default function Finances() {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  // Fetch policies from Supabase
  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ['policies-raw'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('policies')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch clients from Supabase
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['clients-raw'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*');
      
      if (error) throw error;
      return data;
    },
  });

  const isLoading = policiesLoading || clientsLoading;

  // Calculate financial stats
  const totalPremiums = useMemo(() => 
    policies.reduce((sum, p) => sum + Number(p.premium_amount), 0), 
    [policies]
  );
  
  const totalCommissions = useMemo(() => 
    policies.reduce((sum, p) => sum + Number(p.commission_amount), 0), 
    [policies]
  );
  
  const pendingPayments = useMemo(() => 
    policies.filter(p => p.payment_status === 'pending'), 
    [policies]
  );
  
  const pendingAmount = useMemo(() => 
    pendingPayments.reduce((sum, p) => sum + Number(p.premium_amount), 0), 
    [pendingPayments]
  );
  
  const receivedCommissions = useMemo(() => 
    policies
      .filter(p => p.payment_status === 'commission_received')
      .reduce((sum, p) => sum + Number(p.commission_amount), 0),
    [policies]
  );

  const getClient = (clientId: string) => clients.find(c => c.id === clientId);

  // Transform policies into transactions for display
  const recentTransactions = useMemo(() => 
    policies
      .map(policy => ({
        id: policy.id,
        type: policy.payment_status === 'paid' || policy.payment_status === 'commission_received' ? 'income' : 'pending',
        client: getClient(policy.client_id),
        amount: policy.payment_status === 'commission_received' 
          ? Number(policy.commission_amount) 
          : Number(policy.premium_amount),
        status: policy.payment_status,
        date: policy.created_at,
        policyType: policy.policy_type,
        insuranceCompany: policy.insurance_company,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [policies, clients]
  );

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 pb-24 overflow-auto max-h-[calc(100vh-48px)]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Касса и финансы</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Учет оплат и взаиморасчетов
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-secondary rounded-lg p-1">
              {(['month', 'quarter', 'year'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    period === p 
                      ? 'bg-card text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p === 'month' && 'Месяц'}
                  {p === 'quarter' && 'Квартал'}
                  {p === 'year' && 'Год'}
                </button>
              ))}
            </div>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Отчет
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Общие премии"
            value={`${totalPremiums.toLocaleString('ru-RU')} ₽`}
            icon={<Wallet className="h-5 w-5" />}
            variant="primary"
          />
          <StatCard
            title="Ожидаемые комиссии"
            value={`${totalCommissions.toLocaleString('ru-RU')} ₽`}
            icon={<TrendingUp className="h-5 w-5" />}
            variant="success"
          />
          <StatCard
            title="Получено комиссий"
            value={`${receivedCommissions.toLocaleString('ru-RU')} ₽`}
            icon={<CreditCard className="h-5 w-5" />}
            variant="success"
          />
          <StatCard
            title="Ожидают оплаты"
            value={`${pendingAmount.toLocaleString('ru-RU')} ₽`}
            subtitle={`${pendingPayments.length} полисов`}
            icon={<Building2 className="h-5 w-5" />}
            variant="warning"
          />
        </div>

        {/* Transactions Table */}
        <div className="card-elevated">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">История операций</h2>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <Filter className="h-4 w-4" />
              Фильтры
            </Button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="p-12 text-center">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-medium text-foreground mb-1">Нет операций</h3>
              <p className="text-muted-foreground">
                Здесь будут отображаться финансовые операции по полисам
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Дата</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Клиент</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Полис / СК</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Сумма</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((tx, index) => {
                    const paymentStatus = paymentLabels[tx.status] || { label: tx.status, class: '' };
                    
                    return (
                      <tr 
                        key={tx.id} 
                        className="table-row-hover border-b border-border/50 animate-fade-in"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-foreground">
                              {new Date(tx.date).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {tx.client?.is_company ? (
                              <Building2 className="h-4 w-4 text-accent shrink-0" />
                            ) : (
                              <div className="avatar-initials h-7 w-7 text-xs shrink-0">
                                {tx.client?.last_name?.[0]}{tx.client?.first_name?.[0]}
                              </div>
                            )}
                            <span className="text-sm text-foreground">
                              {tx.client?.is_company 
                                ? tx.client.company_name 
                                : `${tx.client?.last_name} ${tx.client?.first_name}`
                              }
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div>
                            <span className="text-sm text-foreground">{tx.policyType}</span>
                            <p className="text-xs text-muted-foreground mt-0.5">{tx.insuranceCompany}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {tx.type === 'income' ? (
                              <ArrowDownLeft className="h-4 w-4 text-success" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4 text-warning" />
                            )}
                            <span className={cn(
                              'text-sm font-medium',
                              tx.type === 'income' ? 'text-success' : 'text-foreground'
                            )}>
                              {tx.type === 'income' ? '+' : ''}{tx.amount.toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={cn('status-badge', paymentStatus.class)}>
                            {paymentStatus.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </div>
  );
}
