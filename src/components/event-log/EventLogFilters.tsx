import { Filter, Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const CATEGORIES = [
  { value: '', label: 'Все категории' },
  { value: 'sales', label: 'Продажи' },
  { value: 'clients', label: 'Клиенты' },
  { value: 'finance', label: 'Финансы' },
  { value: 'service', label: 'Сервис' },
  { value: 'access', label: 'Доступ' },
  { value: 'auth', label: 'Авторизация' },
];

const ACTIONS = [
  { value: '__all__', label: 'Все действия' },
  { value: 'create', label: 'Создание' },
  { value: 'update', label: 'Изменение' },
  { value: 'delete', label: 'Удаление' },
  { value: 'view_contact_phone', label: '📱 Просмотр телефона' },
  { value: 'view_contact_email', label: '📧 Просмотр email' },
  { value: 'open_card', label: '📂 Открытие карточки' },
  { value: 'access_denied', label: '⚠️ Отказ доступа' },
  { value: 'view', label: 'Просмотр (другое)' },
];

const QUICK_DATES: { label: string; from: string; to: string }[] = (() => {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  return [
    { label: 'Сегодня', from: fmt(today), to: fmt(today) },
    { label: 'Вчера', from: fmt(yesterday), to: fmt(yesterday) },
    { label: 'Неделя', from: fmt(weekAgo), to: fmt(today) },
  ];
})();

interface Props {
  operatorFilter: string;
  setOperatorFilter: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  actionFilter: string;
  setActionFilter: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  profiles: { user_id: string; full_name: string | null }[];
  onRefresh: () => void;
}

export function EventLogFilters({
  operatorFilter, setOperatorFilter,
  categoryFilter, setCategoryFilter,
  actionFilter, setActionFilter,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  searchQuery, setSearchQuery,
  profiles,
  onRefresh,
}: Props) {
  return (
    <div className="sticky top-0 z-20 bg-background border border-border rounded-lg p-2 mb-2 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

        {/* Operator */}
        <Select value={operatorFilter || '__all__'} onValueChange={setOperatorFilter}>
          <SelectTrigger className="h-7 w-36 text-xs">
            <SelectValue placeholder="Сотрудник" />
          </SelectTrigger>
          <SelectContent className="z-50">
            <SelectItem value="__all__">Все</SelectItem>
            {profiles.map(p => (
              <SelectItem key={p.user_id} value={p.full_name || p.user_id}>
                {p.full_name || p.user_id.slice(0, 8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category */}
        <Select value={categoryFilter || '__all__'} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-7 w-36 text-xs">
            <SelectValue placeholder="Категория" />
          </SelectTrigger>
          <SelectContent className="z-50">
            {CATEGORIES.map(c => (
              <SelectItem key={c.value || '__all__'} value={c.value || '__all__'}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Action dropdown with Russian labels */}
        <Select value={actionFilter || '__all__'} onValueChange={setActionFilter}>
          <SelectTrigger className="h-7 w-36 text-xs">
            <SelectValue placeholder="Действие" />
          </SelectTrigger>
          <SelectContent className="z-50">
            {ACTIONS.map(a => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range */}
        <Input
          type="date"
          className="h-7 w-32 text-xs"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">—</span>
        <Input
          type="date"
          className="h-7 w-32 text-xs"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
        />

        {/* Quick date buttons */}
        {QUICK_DATES.map(qd => (
          <Button
            key={qd.label}
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => { setDateFrom(qd.from); setDateTo(qd.to); }}
          >
            {qd.label}
          </Button>
        ))}

        {/* Refresh button */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs px-2 gap-1"
          onClick={onRefresh}
        >
          <RefreshCw className="h-3 w-3" />
          Обновить
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          className="h-7 pl-7 text-xs"
          placeholder="Поиск по ФИО, госномеру, № полиса..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>
    </div>
  );
}
