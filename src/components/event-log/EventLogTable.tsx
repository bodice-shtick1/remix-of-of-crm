import { useState } from 'react';
import { ChevronRight, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const ACTION_BADGE_MAP: Record<string, { label: string; className: string }> = {
  delete: { label: 'Удаление', className: 'bg-destructive text-destructive-foreground' },
  cleanup: { label: 'Очистка', className: 'bg-destructive text-destructive-foreground' },
  create: { label: 'Создание', className: 'bg-green-600 text-white' },
  update: { label: 'Изменение', className: 'bg-blue-600 text-white' },
  settings_change: { label: 'Настройки', className: 'bg-blue-600 text-white' },
  view_contact_phone: { label: '📱 Телефон', className: 'bg-purple-600 text-white' },
  view_contact_email: { label: '📧 Email', className: 'bg-purple-600 text-white' },
  view_contact: { label: '👁️ Просмотр', className: 'bg-purple-600 text-white' },
  open_card: { label: '📂 Карточка', className: 'bg-indigo-600 text-white' },
  access_denied: { label: '⚠️ Отказ доступа', className: 'bg-amber-600 text-white' },
  print: { label: 'Печать', className: 'bg-muted text-muted-foreground' },
  login: { label: 'Вход', className: 'bg-muted text-muted-foreground' },
  login_failed: { label: '⚠️ Неуд. вход', className: 'bg-amber-600 text-white' },
  logout: { label: 'Выход', className: 'bg-muted text-muted-foreground' },
  import: { label: 'Импорт', className: 'bg-blue-600 text-white' },
};

function getActionBadge(action: string) {
  const match = ACTION_BADGE_MAP[action] ||
    Object.entries(ACTION_BADGE_MAP).find(([k]) => action.toLowerCase().includes(k))?.[1];
  if (match) return match;
  return { label: action, className: 'bg-muted text-muted-foreground' };
}

const CATEGORY_LABELS: Record<string, string> = {
  sales: 'Продажи',
  clients: 'Клиенты',
  finance: 'Финансы',
  service: 'Сервис',
  access: 'Доступ',
  auth: 'Авторизация',
};

interface Props {
  logs: any[];
  getOperatorName: (userId: string) => string;
  onOperatorClick?: (userId: string) => void;
  tableRef?: React.RefObject<HTMLDivElement>;
}

export function EventLogTable({ logs, getOperatorName, onOperatorClick, tableRef }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div ref={tableRef} className="overflow-auto max-h-[calc(100vh-300px)]">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
            <TableRow className="border-b border-border">
              <TableHead className="h-8 px-2 text-xs font-semibold w-[140px]">Время</TableHead>
              <TableHead className="h-8 px-2 text-xs font-semibold w-[120px]">Оператор</TableHead>
              <TableHead className="h-8 px-2 text-xs font-semibold w-[80px]">Категория</TableHead>
              <TableHead className="h-8 px-2 text-xs font-semibold w-[100px]">Действие</TableHead>
              <TableHead className="h-8 px-2 text-xs font-semibold">Объект</TableHead>
              <TableHead className="h-8 px-2 text-xs font-semibold w-[40px]">Детали</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log: any, idx: number) => {
              const badge = getActionBadge(log.action);
              const hasDiff = log.old_value || log.new_value || log.details;
              const isExpanded = expandedId === log.id;
              const clientName = log.clients
                ? `${log.clients.last_name || ''} ${log.clients.first_name || ''}`.trim()
                : '';

              return (
                <>
                  <TableRow
                    key={log.id}
                    className={cn(
                      'border-b border-border/50',
                      idx % 2 === 0 ? 'bg-background' : 'bg-muted/30',
                    )}
                  >
                    <TableCell className="py-1 px-2 text-xs text-foreground/80 whitespace-nowrap font-mono">
                      {new Date(log.created_at).toLocaleString('ru-RU', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="py-1 px-2 text-xs font-medium text-foreground truncate max-w-[120px]">
                      <button
                        className="hover:underline hover:text-primary transition-colors text-left truncate block w-full"
                        onClick={() => onOperatorClick?.(log.user_id)}
                        title="Фильтровать по сотруднику"
                      >
                        {getOperatorName(log.user_id)}
                      </button>
                    </TableCell>
                    <TableCell className="py-1 px-2">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {CATEGORY_LABELS[log.category] || log.category || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="py-1 px-2">
                      <Badge className={cn('text-[10px] px-1.5 py-0 rounded-sm font-medium border-0', badge.className)}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1 px-2 text-xs text-foreground">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{log.field_accessed || log.action}</span>
                        {clientName && (
                          <span className="text-[10px] text-muted-foreground">{clientName}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-1 px-2">
                      {hasDiff ? (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          className="p-0.5 rounded hover:bg-muted transition-colors"
                        >
                          <ChevronRight className={cn(
                            'h-3.5 w-3.5 text-muted-foreground transition-transform',
                            isExpanded && 'rotate-90'
                          )} />
                        </button>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && hasDiff && (
                    <TableRow key={`${log.id}-diff`} className="bg-muted/40">
                      <TableCell colSpan={6} className="py-1.5 px-3 text-xs">
                        {log.old_value && log.new_value ? (
                          <div className="flex items-center gap-2">
                            <span className="line-through text-destructive/80">{log.old_value}</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="font-medium text-foreground">{log.new_value}</span>
                          </div>
                        ) : log.new_value ? (
                          <span className="text-foreground">{log.new_value}</span>
                        ) : log.old_value ? (
                          <span className="line-through text-destructive/80">{log.old_value}</span>
                        ) : null}
                        {log.details && (
                          <pre className="mt-1 text-[10px] text-muted-foreground whitespace-pre-wrap">
                            {typeof log.details === 'string'
                              ? log.details
                              : JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-xs">
                  Нет записей
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
