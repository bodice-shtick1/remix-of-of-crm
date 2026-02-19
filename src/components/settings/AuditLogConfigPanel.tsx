import { useState } from 'react';
import { Shield, ShieldAlert, Zap, UserX, X, Loader2, Lock, Eye, Clock, CalendarIcon, Droplets } from 'lucide-react';
import { format } from 'date-fns';
import { logEventDirect, invalidateAuditConfigCache } from '@/hooks/useEventLog';
import { invalidateScreenshotLogCache } from '@/components/security/ScreenProtection';
import { invalidateTabSwitchLogCache } from '@/components/security/SuspiciousActivityDetection';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useAuditLogConfig, ACTION_TYPES, ACTION_LABELS } from '@/hooks/useAuditLogConfig';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWatermarkSetting } from '@/hooks/useWatermarkSetting';

const ROLES = [
  { key: 'admin', label: 'Админ' },
  { key: 'agent', label: 'Операторы' },
];

const ACTION_ICONS: Record<string, string> = {
  login: '🔑',
  create: '➕',
  update: '✏️',
  delete: '🗑️',
  view_contact: '👁️',
  print: '🖨️',
  screenshot_logging: '📸',
  tab_switch_logging: '🔄',
};

const BYPASS_OPTIONS = [
  { value: '1h', label: 'На 1 час' },
  { value: '4h', label: 'На 4 часа' },
  { value: '8h', label: 'На 8 часов (рабочая смена)' },
  { value: '24h', label: 'На 24 часа' },
  { value: 'end_of_month', label: 'До конца месяца' },
  { value: 'forever', label: 'Навсегда' },
  { value: 'custom', label: 'Свой вариант...' },
];

function computeBypassUntil(value: string): string | null {
  const now = new Date();
  switch (value) {
    case '1h': return new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString();
    case '4h': return new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
    case '8h': return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();
    case '24h': return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    case 'end_of_month': {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return end.toISOString();
    }
    case 'forever': return null; // null means forever (just disable rule)
    default: return null;
  }
}

function formatBypassLabel(value: string): string {
  const opt = BYPASS_OPTIONS.find(o => o.value === value);
  return opt?.label ?? value;
}

export function AuditLogConfigPanel() {
  const {
    blacklistRules,
    isLoading,
    isActionEnabled,
    toggleAction,
    addBlacklist,
    removeBlacklist,
    setPreset,
    isTogglingPreset,
    isProlongationRuleEnabled,
    toggleProlongationRule,
    getContactViewLimit,
    isContactViewLimitEnabled,
    updateContactViewLimit,
    getBypassUntil,
    isBypassActive,
    setBypassUntil,
  } = useAuditLogConfig();

  const { enabled: watermarksEnabled, toggle: watermarkToggle } = useWatermarkSetting();
  const [selectedBlacklistUser, setSelectedBlacklistUser] = useState('');
  const [bypassPeriod, setBypassPeriod] = useState('');
  const [customDate, setCustomDate] = useState<Date | undefined>();
  const [customTime, setCustomTime] = useState('18:00');

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-audit'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
  });

  const blacklistedUserIds = blacklistRules.map(r => r.target_user_id);
  const availableProfiles = profiles.filter(p => !blacklistedUserIds.includes(p.user_id));

  const handleBypassApply = () => {
    if (bypassPeriod === 'custom') {
      if (!customDate) return;
      const [hours, minutes] = customTime.split(':').map(Number);
      const target = new Date(customDate);
      target.setHours(hours, minutes, 0, 0);
      setBypassUntil(target.toISOString());
      logEventDirect({
        action: 'settings_change',
        category: 'service',
        entityType: 'audit_config',
        fieldAccessed: 'restriction_bypass',
        oldValue: 'Включено',
        newValue: 'Отключено временно',
        details: { message: `Админ открыл полный доступ к контактам до ${format(target, 'dd.MM.yyyy HH:mm')}` },
      });
    } else if (bypassPeriod === 'forever') {
      toggleProlongationRule(false);
      setBypassUntil(null);
      logEventDirect({
        action: 'settings_change',
        category: 'service',
        entityType: 'audit_config',
        fieldAccessed: 'restriction_bypass',
        oldValue: 'Включено',
        newValue: 'Отключено навсегда',
        details: { message: `Админ отключил правило 30 дней навсегда` },
      });
    } else if (bypassPeriod) {
      const until = computeBypassUntil(bypassPeriod);
      if (until) {
        setBypassUntil(until);
        logEventDirect({
          action: 'settings_change',
          category: 'service',
          entityType: 'audit_config',
          fieldAccessed: 'restriction_bypass',
          oldValue: 'Включено',
          newValue: 'Отключено временно',
          details: { message: `Админ открыл полный доступ к контактам ${formatBypassLabel(bypassPeriod)} до ${format(new Date(until), 'dd.MM.yyyy HH:mm')}` },
        });
      }
    }
    setBypassPeriod('');
    setCustomDate(undefined);
  };

  const handleCancelBypass = () => {
    setBypassUntil(null);
    toggleProlongationRule(true);
    logEventDirect({
      action: 'settings_change',
      category: 'service',
      entityType: 'audit_config',
      fieldAccessed: 'restriction_bypass',
      oldValue: 'Отключено временно',
      newValue: 'Включено',
      details: { message: `Админ вернул правило 30 дней вручную (досрочно)` },
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const bypassActive = isBypassActive();
  const bypassUntilValue = getBypassUntil();

  return (
    <div className="space-y-6">
      {/* Header + Matrix */}
      <div className="card-elevated p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Управление логированием
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Настройте, какие действия записываются в журнал событий
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => setPreset('all')}
              disabled={isTogglingPreset}
            >
              <Zap className="h-3.5 w-3.5" />
              Включить всё
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => setPreset('critical')}
              disabled={isTogglingPreset}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Только критические
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Действие</th>
                {ROLES.map(role => (
                  <th key={role.key} className="text-center py-2 px-4 font-medium text-muted-foreground whitespace-nowrap">
                    {role.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACTION_TYPES.map(action => (
                <tr key={action} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 pr-4 font-medium text-foreground whitespace-nowrap">
                    <span className="mr-1.5">{ACTION_ICONS[action] || '📋'}</span>
                    {ACTION_LABELS[action]}
                  </td>
                  {ROLES.map(role => {
                    const enabled = isActionEnabled(role.key, action);
                    return (
                      <td key={role.key} className="text-center py-2.5 px-4">
                        <Checkbox
                          checked={enabled}
                          onCheckedChange={(checked) => {
                            toggleAction({ role: role.key, action, enabled: !!checked });
                            // Instantly invalidate all runtime caches
                            invalidateAuditConfigCache();
                            invalidateScreenshotLogCache();
                            invalidateTabSwitchLogCache();
                            logEventDirect({
                              action: 'settings_change',
                              category: 'service',
                              entityType: 'audit_config',
                              fieldAccessed: action,
                              oldValue: checked ? 'Выключено' : 'Включено',
                              newValue: checked ? 'Включено' : 'Выключено',
                              details: { message: `Админ изменил правила аудита: ${ACTION_LABELS[action]} для роли ${role.label} — ${checked ? 'Вкл' : 'Выкл'}` },
                            });
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Watermark toggle */}
      <div className="card-elevated p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Droplets className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground">Защитные водяные знаки</h3>
              <p className="text-xs text-muted-foreground">
                Отображение полупрозрачных меток с ФИО, ID и IP сотрудника для предотвращения несанкционированного фотографирования или копирования экрана
              </p>
            </div>
          </div>
          <Switch
            checked={watermarksEnabled}
            onCheckedChange={(v) => {
              watermarkToggle.mutate(v);
              logEventDirect({
                action: 'settings_change',
                category: 'service',
                entityType: 'audit_config',
                fieldAccessed: 'enable_watermarks',
                oldValue: v ? 'Выключено' : 'Включено',
                newValue: v ? 'Включено' : 'Выключено',
                details: { message: `Админ ${v ? 'включил' : 'выключил'} защитные водяные знаки` },
              });
            }}
            disabled={watermarkToggle.isPending}
          />
        </div>
      </div>

      {/* Access Rules */}
      <div className="card-elevated p-6">
        <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
          <Lock className="h-5 w-5 text-amber-600" />
          Правила доступа к контактам
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Ограничение доступа к телефонам и email клиентов на основе полисов
        </p>

        {/* 30-day rule + bypass — single grouped block */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between p-3 bg-muted/30">
            <div>
              <p className="text-sm font-medium text-foreground">
                Применять правило 30 дней для всех сотрудников (кроме Админа)
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Операторы смогут просматривать контакты клиента только если у него есть полис, истекающий в ближайшие 30 дней.
              </p>
            </div>
            <Switch
              checked={isProlongationRuleEnabled() && !bypassActive}
              onCheckedChange={(checked) => {
                if (checked && bypassActive) {
                  handleCancelBypass();
                } else {
                  toggleProlongationRule(checked);
                  logEventDirect({
                    action: 'settings_change',
                    category: 'service',
                    entityType: 'audit_config',
                    fieldAccessed: 'prolongation_30d',
                    oldValue: checked ? 'Выключено' : 'Включено',
                    newValue: checked ? 'Включено' : 'Выключено',
                    details: { message: `Админ изменил глобальное правило доступа: Ограничение 30 дней [${checked ? 'Включено' : 'Выключено'}]` },
                  });
                }
              }}
            />
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-foreground">Отключить на период</p>
            </div>

            {bypassActive && bypassUntilValue ? (
              <div className="flex items-center justify-between p-2 rounded bg-amber-500/10 border border-amber-500/20">
                <span className="text-xs font-medium text-foreground">
                  🔓 База открыта до {format(new Date(bypassUntilValue), 'dd.MM.yyyy HH:mm')}
                </span>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleCancelBypass}>
                  Вернуть защиту
                </Button>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Select value={bypassPeriod} onValueChange={setBypassPeriod}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Выберите период..." />
                    </SelectTrigger>
                    <SelectContent>
                      {BYPASS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {bypassPeriod === 'custom' && (
                  <div className="flex items-center gap-1.5">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1", !customDate && "text-muted-foreground")}>
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {customDate ? format(customDate, 'dd.MM.yyyy') : 'Дата'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={customDate}
                          onSelect={setCustomDate}
                          disabled={(date) => date < new Date()}
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="h-8 w-24 text-xs"
                    />
                  </div>
                )}

                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={!bypassPeriod || (bypassPeriod === 'custom' && !customDate)}
                  onClick={handleBypassApply}
                >
                  Применить
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Rate Limit */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-border mt-3">
          <div>
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Лимит просмотров контактов (в час)
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Максимальное количество раскрытий телефонов/email за 60 минут. Администратор не ограничен.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={isContactViewLimitEnabled()}
              onCheckedChange={(checked) => {
                updateContactViewLimit({ enabled: checked });
                logEventDirect({
                  action: 'settings_change',
                  category: 'service',
                  entityType: 'audit_config',
                  fieldAccessed: 'contact_view_limit_enabled',
                  oldValue: checked ? 'Выключено' : 'Включено',
                  newValue: checked ? 'Включено' : 'Выключено',
                  details: { message: `Админ изменил лимит просмотров: [${checked ? 'Включено' : 'Выключено'}]` },
                });
              }}
            />
            <Input
              type="number"
              min={1}
              max={999}
              className="w-20 h-8 text-sm text-center"
              value={getContactViewLimit()}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (val > 0 && val <= 999) {
                  updateContactViewLimit({ limit: val });
                }
              }}
              disabled={!isContactViewLimitEnabled()}
            />
          </div>
        </div>
      </div>

      {/* Blacklist */}
      <div className="card-elevated p-6">
        <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
          <UserX className="h-5 w-5 text-destructive" />
          Чёрный список (Silence Log)
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Полностью отключить логирование для выбранных пользователей
        </p>

        <div className="flex gap-2 mb-3">
          <Select value={selectedBlacklistUser} onValueChange={setSelectedBlacklistUser}>
            <SelectTrigger className="w-64 h-8 text-xs">
              <SelectValue placeholder="Выберите пользователя..." />
            </SelectTrigger>
            <SelectContent>
              {availableProfiles.map(p => (
                <SelectItem key={p.user_id} value={p.user_id}>
                  {p.full_name || p.user_id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            disabled={!selectedBlacklistUser}
            onClick={() => {
              addBlacklist(selectedBlacklistUser);
              setSelectedBlacklistUser('');
            }}
          >
            Добавить
          </Button>
        </div>

        {blacklistRules.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Чёрный список пуст</p>
        ) : (
          <div className="space-y-1">
            {blacklistRules.map(rule => {
              const profile = profiles.find(p => p.user_id === rule.target_user_id);
              return (
                <div key={rule.id} className="flex items-center justify-between py-1.5 px-3 rounded bg-destructive/5 border border-destructive/10">
                  <span className="text-xs font-medium text-foreground">
                    {profile?.full_name || rule.target_user_id?.slice(0, 8)}
                  </span>
                  <button
                    onClick={() => removeBlacklist(rule.id)}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
