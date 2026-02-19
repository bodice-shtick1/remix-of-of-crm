import { PndConsentWidget } from '@/components/dashboard/PndConsentWidget';
import { ExpiringPoliciesReal } from '@/components/dashboard/ExpiringPoliciesReal';
import { BirthdayList } from '@/components/dashboard/BirthdayList';
import { UpcomingTasksWidget } from '@/components/dashboard/UpcomingTasksWidget';
import { DebtsWidget } from '@/components/dashboard/DebtsWidget';
import { EmailDashboardWidget } from '@/components/dashboard/EmailDashboardWidget';
import { AutopilotWidget } from '@/components/dashboard/AutopilotWidget';
import { ChannelWarningBanner } from '@/components/dashboard/ChannelWarningBanner';
import { LiveClock } from '@/components/dashboard/LiveClock';
import { SearchInput } from '@/components/ui/search-input';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useTodayDebtPayments } from '@/hooks/useDebtPayments';
import { useMonthlyGoal } from '@/hooks/useMonthlyGoal';
import { ShiftControls } from '@/components/shifts/ShiftControls';
import {
  Users, FileText, ShoppingCart, Plus,
  Wallet, TrendingUp, CreditCard, Target, ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useShiftManagement } from '@/hooks/useShiftManagement';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePermissions } from '@/hooks/usePermissions';


const DASHBOARD_PERMISSIONS = ['dash_stats_view', 'dash_debts_view', 'dash_income_view', 'dash_expiring_view', 'dash_events_view', 'dash_actions_access', 'dash_shift_manage', 'dash_emails_view'];

export default function Dashboard() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { stats, expiringPolicies, upcomingBirthdays, loading } = useDashboardData();
  const { isShiftOpen, isLoading: isShiftLoading } = useShiftManagement();
  const { data: debtData } = useTodayDebtPayments();
  const { goal } = useMonthlyGoal();

  const hasAnyDashPerm = DASHBOARD_PERMISSIONS.some(k => can(k));

  if (!hasAnyDashPerm) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Нет доступа</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          У вас нет доступа к виджетам рабочего стола. Обратитесь к администратору для настройки прав.
        </p>
      </div>
    );
  }

  const todayDebt = debtData?.total ?? 0;
  const safeStats = stats ?? { totalClients: 0, activePolicies: 0, pendingPayments: 0, monthlyRevenue: 0 };
  const goalPct = goal > 0 ? Math.min(Math.round((safeStats.monthlyRevenue / goal) * 100), 100) : 0;

  return (
    <div className="p-3 lg:p-4 space-y-3">
      {/* ── Header row ── */}
      <div className="flex items-center justify-between gap-2">
        <LiveClock />
        <div className="flex items-center gap-1.5">
          <SearchInput value={search} onChange={setSearch} placeholder="Поиск..." className="w-48 lg:w-56" />
          {can('dash_actions_access') && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button size="icon" className="btn-gradient rounded-full h-8 w-8" onClick={() => navigate('/sales')} disabled={!isShiftOpen && !isShiftLoading}>
                      <ShoppingCart className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{!isShiftOpen && !isShiftLoading ? 'Откройте смену' : 'Новая продажа'}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="outline" className="rounded-full h-8 w-8" onClick={() => navigate('/clients')}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Новый клиент</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {can('dash_shift_manage') && <ShiftControls className="ml-1" />}
        </div>
      </div>

      <ChannelWarningBanner />

      {/* ── Stat strip ── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-[72px] rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          {/* Clients + Policies */}
          {can('dash_stats_view') && (
            <div className="rounded-lg border border-border/50 bg-card px-3 py-2.5 flex items-center gap-3">
              <div className="flex -space-x-1">
                <div className="p-1.5 rounded-md bg-secondary"><Users className="h-3.5 w-3.5 text-secondary-foreground" /></div>
                <div className="p-1.5 rounded-md bg-primary/10"><FileText className="h-3.5 w-3.5 text-primary" /></div>
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold text-foreground leading-none">{safeStats.totalClients}</span>
                  <span className="text-[11px] text-muted-foreground">/</span>
                  <span className="text-lg font-bold text-primary leading-none">{safeStats.activePolicies}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">клиенты / полисы</p>
              </div>
            </div>
          )}

          {/* Today debt collected */}
          {can('dash_debts_view') && (
            <div className={`rounded-lg border px-3 py-2.5 flex items-center gap-3 ${todayDebt > 0 ? 'border-success/30 bg-success/5' : 'border-border/50 bg-card'}`}>
              <div className="p-1.5 rounded-md bg-success/10"><Wallet className="h-3.5 w-3.5 text-success" /></div>
              <div className="min-w-0">
                <p className={`text-lg font-bold leading-none ${todayDebt > 0 ? 'text-success' : 'text-foreground'}`}>{todayDebt.toLocaleString('ru-RU')} ₽</p>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">долги сегодня</p>
              </div>
            </div>
          )}

          {/* Pending */}
          {can('dash_stats_view') && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-warning/10"><CreditCard className="h-3.5 w-3.5 text-warning" /></div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-foreground leading-none">{safeStats.pendingPayments}</p>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">ожидают оплаты</p>
              </div>
            </div>
          )}

          {/* Monthly revenue + goal */}
          {can('dash_income_view') && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-primary/10"><TrendingUp className="h-3.5 w-3.5 text-primary" /></div>
                  <div>
                    <p className="text-lg font-bold text-foreground leading-none">{safeStats.monthlyRevenue.toLocaleString('ru-RU')} ₽</p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">доход / мес.</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-primary flex items-center gap-0.5"><Target className="h-3 w-3" />{goalPct}%</span>
              </div>
              <Progress value={goalPct} className="h-1 mt-2" />
            </div>
          )}

          {/* PND Consent */}
          {can('sale_legal') && <PndConsentWidget />}
        </div>
      )}

      <AutopilotWidget />

      {/* ── Top row: Expiring + Debts | Email (stretch to match) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
        <div className="lg:col-span-2 flex flex-col gap-3">
          {can('dash_expiring_view') && (
            loading ? (
              <Skeleton className="h-48 rounded-lg" />
            ) : (
              <ExpiringPoliciesReal policies={expiringPolicies} />
            )
          )}
          {can('dash_debts_view') && <DebtsWidget />}
        </div>
        <div className="flex flex-col gap-3">
          {can('dash_emails_view') && (
            <div className="flex-1 flex flex-col min-h-0">
              <EmailDashboardWidget className="flex-1" />
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom row: Tasks | Birthdays ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          {can('dash_events_view') && <UpcomingTasksWidget />}
        </div>
        <div>
          {can('dash_events_view') && (
            loading ? (
              <Skeleton className="h-40 rounded-lg" />
            ) : (
              <BirthdayList clients={upcomingBirthdays} />
            )
          )}
        </div>
      </div>
    </div>
  );
}
