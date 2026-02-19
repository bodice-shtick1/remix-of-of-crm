import { TrendingUp, Target } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useMonthlyGoal } from '@/hooks/useMonthlyGoal';

interface MonthlyRevenueCardProps {
  revenue: number;
}

export function MonthlyRevenueCard({ revenue }: MonthlyRevenueCardProps) {
  const { goal } = useMonthlyGoal();
  const percent = goal > 0 ? Math.min(Math.round((revenue / goal) * 100), 100) : 0;

  return (
    <div className="stat-card bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Target className="h-3 w-3" />
          <span>{percent}%</span>
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">
        {revenue.toLocaleString('ru-RU')} ₽
      </p>
      <p className="text-sm text-muted-foreground mt-0.5">Доход за месяц</p>
      <div className="mt-3">
        <Progress value={percent} className="h-2" />
        <p className="text-[11px] text-muted-foreground mt-1">
          Цель: {goal.toLocaleString('ru-RU')} ₽
        </p>
      </div>
    </div>
  );
}
