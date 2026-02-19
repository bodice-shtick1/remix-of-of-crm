import { Cake, Gift, Phone, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardClient } from '@/hooks/useDashboardData';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BirthdayListProps {
  clients: DashboardClient[];
}

export function BirthdayList({ clients }: BirthdayListProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDaysUntilBirthday = (birthDate: string) => {
    const birth = new Date(birthDate);
    const thisYear = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
    if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
    return Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getAge = (birthDate: string) => {
    const birth = new Date(birthDate);
    const thisYear = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
    return thisYear < today ? today.getFullYear() - birth.getFullYear() + 1 : today.getFullYear() - birth.getFullYear();
  };

  const getDayLabel = (d: number) => d === 0 ? 'Сегодня' : d === 1 ? 'Завтра' : `Через ${d} дн.`;

  const formatPhone = (p: string) => p.replace(/[^\d+]/g, '');

  const openWhatsApp = (phone: string, name: string) => {
    const clean = formatPhone(phone).replace('+', '');
    window.open(`https://wa.me/${clean}?text=${encodeURIComponent(`Здравствуйте, ${name}! Поздравляем Вас с Днём рождения! 🎂🎉`)}`, '_blank');
  };

  const sorted = [...clients].sort((a, b) => getDaysUntilBirthday(a.birth_date!) - getDaysUntilBirthday(b.birth_date!));

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold mb-3">
          <Cake className="h-4 w-4 text-pink-500" /> Дни рождения
        </div>
        <p className="text-xs text-muted-foreground text-center py-4">В ближайшие дни нет</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Gift className="h-4 w-4 text-pink-500" /> Дни рождения
        </div>
        <span className="text-[11px] bg-pink-500/10 text-pink-500 px-1.5 py-0.5 rounded-full font-medium">
          {sorted.length}
        </span>
      </div>
      <ScrollArea className="max-h-[260px]">
        <div className="divide-y divide-border/40">
          {sorted.map((client) => {
            const days = getDaysUntilBirthday(client.birth_date!);
            const age = getAge(client.birth_date!);
            const isToday = days === 0;
            const fullName = `${client.last_name} ${client.first_name}`.trim();

            return (
              <div key={client.id} className={cn('px-3 py-2 flex items-center gap-2.5', isToday && 'bg-pink-500/5')}>
                <div className={cn(
                  'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                  isToday ? 'bg-pink-500 text-white' : 'bg-pink-500/10'
                )}>
                  <Cake className={cn('h-3.5 w-3.5', isToday ? 'text-white' : 'text-pink-500')} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{fullName}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn(
                      'text-[10px] font-medium px-1 py-0.5 rounded',
                      isToday ? 'bg-pink-500 text-white' : days === 1 ? 'bg-orange-500/10 text-orange-600' : 'bg-muted text-muted-foreground'
                    )}>
                      {getDayLabel(days)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {age} {age % 10 === 1 && age !== 11 ? 'год' : age % 10 >= 2 && age % 10 <= 4 && (age < 12 || age > 14) ? 'года' : 'лет'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <a href={`tel:${formatPhone(client.phone)}`} className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
                    <Phone className="h-3 w-3 text-primary" />
                  </a>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-green-600 hover:bg-green-500/10" onClick={() => openWhatsApp(client.phone, client.first_name)}>
                    <MessageCircle className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
