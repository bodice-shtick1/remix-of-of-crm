import { useState, useRef } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { Wallet, TrendingUp, Zap, Building2, Download, Target, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAnalyticsData, PeriodType } from '@/hooks/useAnalyticsData';
import { RevenueChart } from '@/components/analytics/RevenueChart';
import { ChannelPieChart } from '@/components/analytics/ChannelPieChart';
import { UpcomingPaymentsTable } from '@/components/analytics/UpcomingPaymentsTable';
import { generateAnalyticsPdf } from '@/lib/analyticsExport';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useMonthlyGoal } from '@/hooks/useMonthlyGoal';

function fmt(n: number): string {
  return n.toLocaleString('ru-RU');
}

export default function Analytics() {
  const [period, setPeriod] = useState<PeriodType>('month');
  const data = useAnalyticsData(period);
  const { goal, saveGoal, loading: goalLoading } = useMonthlyGoal();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const goalPercent = goal > 0 ? Math.min(100, Math.round((data.totalRevenue / goal) * 100)) : 0;

  const startEditing = () => {
    setDraft(String(goal));
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const confirmEdit = () => {
    const num = parseInt(draft.replace(/\s/g, ''), 10);
    if (num > 0) saveGoal(num);
    setEditing(false);
  };

  const cancelEdit = () => setEditing(false);

  const handleExportPdf = () => {
    generateAnalyticsPdf(data, period);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 overflow-auto max-h-[calc(100vh-48px)]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Аналитика</h1>
            <p className="text-sm text-muted-foreground mt-1">Финансовые показатели и статистика</p>
          </div>
          <div className="flex items-center gap-3">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
              <TabsList>
                <TabsTrigger value="week">Неделя</TabsTrigger>
                <TabsTrigger value="month">Месяц</TabsTrigger>
                <TabsTrigger value="quarter">Квартал</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-2">
              <Download className="h-4 w-4" /> PDF
            </Button>
          </div>
        </div>

        {/* Stat Cards */}
        {data.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Выручка"
              value={`${fmt(data.totalRevenue)} ₽`}
              subtitle={`${data.salesCount} продаж за период`}
              icon={<Wallet className="h-5 w-5" />}
              variant="primary"
            />
            <StatCard
              title="Ожидаемые поступления"
              value={`${fmt(data.expectedIncome)} ₽`}
              subtitle="Дебиторская задолженность"
              icon={<TrendingUp className="h-5 w-5" />}
              variant="warning"
            />
            <StatCard
              title="ROI Автопилота"
              value={`${data.salesCount}`}
              subtitle="Сделок за период"
              icon={<Zap className="h-5 w-5" />}
              variant="success"
            />
            <StatCard
              title="Топ СК"
              value={data.topCompany}
              subtitle="По объёму продаж"
              icon={<Building2 className="h-5 w-5" />}
            />
          </div>
        )}

        {/* Monthly Goal Progress */}
        {!data.isLoading && !goalLoading && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  План на февраль 2026
                </CardTitle>
                <span className="text-sm font-semibold text-primary">{goalPercent}%</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={goalPercent} className="h-3" />
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Выполнено: {fmt(data.totalRevenue)} ₽</span>
                <div className="flex items-center gap-1">
                  {editing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        ref={inputRef}
                        type="text"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmEdit();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        className="h-6 w-32 text-xs px-2"
                      />
                      <button onClick={confirmEdit} className="p-0.5 rounded hover:bg-muted text-success">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={cancelEdit} className="p-0.5 rounded hover:bg-muted text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span>Цель: {fmt(goal)} ₽</span>
                      <button
                        onClick={startEditing}
                        className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RevenueChart data={data.dailyData} isLoading={data.isLoading} />
          </div>
          <div>
            <ChannelPieChart data={data.channelData} isLoading={data.isLoading} />
          </div>
        </div>

        {/* Upcoming Payments */}
        <UpcomingPaymentsTable payments={data.upcomingPayments} isLoading={data.isLoading} />
      </div>
  );
}
