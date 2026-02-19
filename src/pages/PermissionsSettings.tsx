import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Save, LayoutDashboard, Users, ShoppingCart,
  BarChart3, Bell, Settings, Shield, Loader2,
  StickyNote, Plus, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import PermissionCategoryCard, { type PermCategoryDef } from '@/components/permissions/PermissionCategoryCard';

/* ───────── Category definitions with sub-groups ───────── */

const PERMISSION_CATEGORIES: PermCategoryDef[] = [
  {
    label: 'Рабочий стол',
    icon: LayoutDashboard,
    subGroups: [{
      items: [
        { key: 'dash_stats_view', label: 'Статистика (клиенты / полисы)' },
        { key: 'dash_debts_view', label: 'Виджет долгов' },
        { key: 'dash_income_view', label: 'Отображение: Доход / мес.' },
        { key: 'dash_expiring_view', label: 'Истекающие полисы' },
        { key: 'dash_events_view', label: 'Дни рождения / задачи' },
        { key: 'dash_actions_access', label: 'Кнопки быстрых действий' },
        { key: 'dash_shift_manage', label: 'Управление сменой' },
      ],
    }],
  },
  {
    label: 'Клиенты и Карточка',
    icon: Users,
    subGroups: [
      {
        title: 'Список',
        items: [
          { key: 'clients_view', label: 'Просмотр списка клиентов' },
          { key: 'clients_import', label: 'Импорт клиентов' },
          { key: 'clients_export', label: 'Экспорт клиентов' },
          { key: 'clients_create', label: 'Создание клиента' },
        ],
      },
      {
        title: 'Карточка клиента',
        items: [
          { key: 'client_contacts_view', label: 'Просмотр контактов' },
          { key: 'client_passport_view', label: 'Паспортные данные' },
          { key: 'client_info_edit', label: 'Редактирование карточки' },
          { key: 'client_comm_actions', label: 'Действия: звонок / сообщение' },
          { key: 'client_dkp_generate', label: 'Генерация ДКП' },
          { key: 'client_history_view', label: 'История продаж клиента' },
          { key: 'client_installments_view', label: 'Рассрочки клиента' },
        ],
      },
      {
        title: 'Справочники транспорта',
        isDirectory: true,
        items: [
          { key: 'cat_registry_view', label: 'Справочник: Реестр ТС — просмотр' },
          { key: 'cat_registry_manage', label: 'Справочник: Реестр ТС — управление' },
          { key: 'cat_cars_view', label: 'Справочник: Марки и модели — просмотр' },
          { key: 'cat_cars_manage', label: 'Справочник: Марки и модели — управление' },
        ],
      },
    ],
  },
  {
    label: 'Контент и Документы',
    icon: StickyNote,
    subGroups: [
      {
        title: 'Заметки',
        items: [
          { key: 'notes_view', label: 'Просмотр заметок' },
          { key: 'notes_manage', label: 'Создание / удаление заметок' },
        ],
      },
      {
        title: 'Документы',
        items: [
          { key: 'docs_view', label: 'Просмотр документов' },
          { key: 'docs_archive_print', label: 'Печать архивных документов' },
          { key: 'docs_archive_delete', label: 'Удаление документов' },
        ],
      },
    ],
  },
  {
    label: 'Продажи и Касса',
    icon: ShoppingCart,
    subGroups: [
      {
        items: [
          { key: 'sale_process', label: 'Оформление продажи' },
        ],
      },
      {
        title: 'Способы оплаты',
        items: [
          { key: 'pay_cash', label: 'Наличные' },
          { key: 'pay_card', label: 'Карта' },
          { key: 'pay_sbp', label: 'СБП' },
          { key: 'pay_transfer', label: 'Перевод' },
          { key: 'pay_debt', label: 'Долг' },
        ],
      },
      {
        title: 'Чеки',
        items: [
          { key: 'receipt_none', label: 'Без сдачи' },
          { key: 'receipt_cash', label: 'Кассовый чек' },
          { key: 'receipt_bill', label: 'Товарный чек' },
        ],
      },
      {
        title: 'Прочее',
        items: [
          { key: 'europrotocol_view', label: 'Европротокол — доступ' },
          { key: 'sale_legal', label: 'Юридические документы' },
          { key: 'sale_finalize', label: 'Завершение / удаление продажи' },
          { key: 'sales_history_view', label: 'История продаж' },
          { key: 'finance_view', label: 'Просмотр кассы' },
        ],
      },
      {
        title: 'Справочники продаж',
        isDirectory: true,
        items: [
          { key: 'settings_sales_view', label: 'Настройка: Параметры продаж' },
          { key: 'cat_products_view', label: 'Справочник: Страховые продукты — просмотр' },
          { key: 'cat_products_manage', label: 'Справочник: Страховые продукты — управление' },
          { key: 'cat_services_view', label: 'Справочник: Услуги — просмотр' },
          { key: 'cat_services_manage', label: 'Справочник: Услуги — управление' },
          { key: 'cat_companies_view', label: 'Справочник: СК и договоры — просмотр' },
          { key: 'cat_companies_manage', label: 'Справочник: СК и договоры — управление' },
        ],
      },
    ],
  },
  {
    label: 'Отчеты и Аналитика',
    icon: BarChart3,
    subGroups: [{
      items: [
        { key: 'reports_shifts_view', label: 'Отчёты по сменам' },
        { key: 'reports_cash_view', label: 'Отчёты по кассе' },
        { key: 'reports_prolongation_view', label: 'Пролонгация' },
        { key: 'analytics_view', label: 'Аналитика' },
        { key: 'audit_log_view', label: 'Журнал событий' },
      ],
    }],
  },
  {
    label: 'Уведомления',
    icon: Bell,
    subGroups: [
      {
        title: 'Действия',
        items: [
          { key: 'notify_queue_view', label: 'Очередь уведомлений' },
          { key: 'notify_templates_manage', label: 'Шаблоны' },
          { key: 'notify_manual_send', label: 'Ручная отправка' },
          { key: 'notify_automation_config', label: 'Автоматизация' },
          { key: 'notify_mass_bulk', label: 'Массовая рассылка' },
        ],
      },
      {
        title: 'Настройки',
        items: [
          { key: 'settings_notifications_view', label: 'Настройка: Уведомления' },
          { key: 'settings_channels_view', label: 'Настройка: Каналы связи' },
        ],
      },
    ],
  },
  {
    label: 'Система',
    icon: Shield,
    subGroups: [
      {
        title: 'Команда',
        items: [
          { key: 'team_manage', label: 'Управление командой' },
          { key: 'team_password_reset', label: 'Сброс паролей' },
        ],
      },
      {
        title: 'Модули',
        items: [
          { key: 'directory_manage', label: 'Справочники (каталог)' },
          { key: 'comm_center_view', label: 'Центр связи' },
          { key: 'settings_edit', label: 'Настройки системы' },
          { key: 'role_delete', label: 'Удаление ролей' },
        ],
      },
      {
        title: 'Настройка: Вкладки',
        items: [
          { key: 'settings_profile_view', label: 'Настройка: Профиль' },
          { key: 'settings_company_view', label: 'Настройка: Компания' },
          { key: 'settings_security_view', label: 'Настройка: Безопасность' },
          { key: 'settings_matrix_view', label: 'Настройка: Матрица доступа' },
        ],
      },
    ],
  },
];

/* ───────── Dependency map: parent → children to disable ───────── */

const DEPENDENCY_MAP: Record<string, string[]> = {
  clients_view: [
    'clients_import', 'clients_export', 'clients_create',
    'client_contacts_view', 'client_passport_view', 'client_info_edit',
    'client_comm_actions', 'client_dkp_generate', 'client_history_view',
    'client_installments_view',
    'cat_registry_view', 'cat_registry_manage',
    'cat_cars_view', 'cat_cars_manage',
  ],
  sale_process: [
    'pay_cash', 'pay_card', 'pay_sbp', 'pay_transfer', 'pay_debt',
    'receipt_none', 'receipt_cash', 'receipt_bill',
    'settings_sales_view',
    'cat_products_view', 'cat_products_manage',
    'cat_services_view', 'cat_services_manage',
    'cat_companies_view', 'cat_companies_manage',
  ],
  settings_edit: [
    'settings_profile_view', 'settings_company_view',
    'settings_security_view', 'settings_matrix_view',
    'settings_notifications_view', 'settings_channels_view',
    'settings_sales_view',
  ],
};

/* Build a label lookup for parent keys */
const PARENT_LABELS: Record<string, string> = {};
for (const cat of PERMISSION_CATEGORIES) {
  for (const sg of cat.subGroups) {
    for (const item of sg.items) {
      PARENT_LABELS[item.key] = item.label;
    }
  }
}

/* Flatten all dependent keys for quick lookup */
const DEPENDENT_KEYS = new Set(Object.values(DEPENDENCY_MAP).flat());

const pkFn = (role: string, key: string) => `${role}::${key}`;

/** Find which parent key disables a given child key */
const findParentKey = (childKey: string): string | null => {
  for (const [parent, children] of Object.entries(DEPENDENCY_MAP)) {
    if (children.includes(childKey)) return parent;
  }
  return null;
};

/* ═══════════════════ Main component ═══════════════════ */

export default function PermissionsSettings() {
  const { userRole, customRoleName } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [permMap, setPermMap] = useState<Record<string, boolean>>({});
  const [originalMap, setOriginalMap] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<string | null>(null);
  const [deleteRoleError, setDeleteRoleError] = useState<string | null>(null);
  const [isDeletingRole, setIsDeletingRole] = useState(false);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

  const SYSTEM_ROLES = ['admin', 'agent', 'viewer'];
  const effectiveRole = customRoleName || userRole;
  const isAdmin = effectiveRole === 'admin';

  const { data: roles = [] } = useQuery({
    queryKey: ['user_roles_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles_list')
        .select('role_name, description')
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map(r => r.role_name);
    },
    enabled: isAdmin,
  });

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Админ',
    agent: 'Агент',
    viewer: 'Наблюдатель',
  };
  const getRoleLabel = (role: string) => ROLE_LABELS[role] || role;

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('role, permission_key, is_enabled');
      if (error) {
        console.error('Error loading permissions:', error);
        setIsLoading(false);
        return;
      }
      const map: Record<string, boolean> = {};
      for (const row of data ?? []) {
        map[pkFn(row.role, row.permission_key)] = row.is_enabled;
      }
      setPermMap({ ...map });
      setOriginalMap({ ...map });
      setIsLoading(false);
    };
    load();
  }, []);

  const hasChanges = useMemo(
    () => Object.keys(permMap).some(k => permMap[k] !== originalMap[k]),
    [permMap, originalMap]
  );
  const changedCount = useMemo(
    () => Object.keys(permMap).filter(k => permMap[k] !== originalMap[k]).length,
    [permMap, originalMap]
  );

  /* ─── Dependency logic ─── */
  const isPermDisabled = useCallback(
    (role: string, key: string): boolean => {
      if (role === 'admin') return true;
      // Check if any parent gates this key
      for (const [parent, children] of Object.entries(DEPENDENCY_MAP)) {
        if (children.includes(key)) {
          const parentEnabled = permMap[pkFn(role, parent)] ?? false;
          if (!parentEnabled) return true;
        }
      }
      return false;
    },
    [permMap]
  );

  const togglePerm = useCallback(
    (role: string, key: string) => {
      if (role === 'admin') return;
      if (isPermDisabled(role, key)) return;
      const k = pkFn(role, key);
      setPermMap(prev => {
        const next = { ...prev, [k]: !prev[k] };
        // If turning OFF a parent, turn off all its children
        if (prev[k] && DEPENDENCY_MAP[key]) {
          for (const child of DEPENDENCY_MAP[key]) {
            next[pkFn(role, child)] = false;
          }
        }
        return next;
      });
    },
    [isPermDisabled]
  );

  const handleDisabledClick = useCallback(
    (role: string, key: string) => {
      if (role === 'admin') return;
      const parentKey = findParentKey(key);
      if (!parentKey) return;
      const parentLabel = PARENT_LABELS[parentKey] || parentKey;
      toast({
        title: 'Действие заблокировано',
        description: `Сначала включите «${parentLabel}», чтобы управлять этой функцией.`,
      });
      // Highlight the parent switch for 2 seconds
      const hk = pkFn(role, parentKey);
      setHighlightedKey(hk);
      setTimeout(() => setHighlightedKey(prev => prev === hk ? null : prev), 2000);
    },
    [toast]
  );

  const bulkToggle = useCallback(
    (role: string, keys: string[], value: boolean) => {
      if (role === 'admin') return;
      setPermMap(prev => {
        const next = { ...prev };
        for (const key of keys) {
          if (isPermDisabled(role, key) && value) continue;
          next[pkFn(role, key)] = value;
          // If turning off a parent, cascade
          if (!value && DEPENDENCY_MAP[key]) {
            for (const child of DEPENDENCY_MAP[key]) {
              next[pkFn(role, child)] = false;
            }
          }
        }
        return next;
      });
    },
    [isPermDisabled]
  );

  /* ─── Save ─── */
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const changes: { role: string; permission_key: string; is_enabled: boolean }[] = [];
      for (const [compositeKey, enabled] of Object.entries(permMap)) {
        if (enabled !== originalMap[compositeKey]) {
          const [role, ...rest] = compositeKey.split('::');
          const permission_key = rest.join('::');
          changes.push({ role, permission_key, is_enabled: enabled });
        }
      }
      if (changes.length === 0) return;

      const { error } = await supabase
        .from('role_permissions')
        .upsert(
          changes.map(c => ({ role: c.role, permission_key: c.permission_key, is_enabled: c.is_enabled })),
          { onConflict: 'role,permission_key' }
        );
      if (error) throw error;

      setOriginalMap({ ...permMap });
      toast({ title: 'Права сохранены', description: `Обновлено ${changes.length} разрешений` });
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast({ title: 'Ошибка', description: 'Не удалось сохранить', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  /* ─── Add role ─── */
  const handleAddRole = async () => {
    const trimmed = newRoleName.trim().toLowerCase();
    if (!trimmed || roles.includes(trimmed)) {
      if (roles.includes(trimmed)) toast({ title: 'Ошибка', description: 'Роль уже существует', variant: 'destructive' });
      return;
    }
    setIsCreatingRole(true);
    try {
      const { error } = await supabase.from('user_roles_list').insert({ role_name: trimmed });
      if (error) throw error;

      const allKeys = PERMISSION_CATEGORIES.flatMap(c => c.subGroups.flatMap(sg => sg.items.map(i => i.key)));
      const rows = allKeys.map(key => ({ role: trimmed, permission_key: key, is_enabled: false }));
      await supabase.from('role_permissions').upsert(rows, { onConflict: 'role,permission_key' });

      const newMap = { ...permMap };
      const newOriginal = { ...originalMap };
      for (const key of allKeys) {
        newMap[pkFn(trimmed, key)] = false;
        newOriginal[pkFn(trimmed, key)] = false;
      }
      setPermMap(newMap);
      setOriginalMap(newOriginal);

      queryClient.invalidateQueries({ queryKey: ['user_roles_list'] });
      toast({ title: 'Роль создана', description: `Роль "${trimmed}" добавлена` });
      setAddRoleOpen(false);
      setNewRoleName('');
    } catch (error) {
      console.error('Error creating role:', error);
      toast({ title: 'Ошибка', description: 'Не удалось создать роль', variant: 'destructive' });
    } finally {
      setIsCreatingRole(false);
    }
  };

  /* ─── Delete role ─── */
  const handleDeleteRole = async () => {
    if (!deleteRoleTarget) return;
    setIsDeletingRole(true);
    setDeleteRoleError(null);
    try {
      const { data: assignedUsers, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('custom_role_name', deleteRoleTarget);
      if (checkError) throw checkError;

      if (assignedUsers && assignedUsers.length > 0) {
        setDeleteRoleError(`Невозможно удалить роль — она назначена ${assignedUsers.length} пользователям. Сначала переназначьте их.`);
        setIsDeletingRole(false);
        return;
      }

      await supabase.from('role_permissions').delete().eq('role', deleteRoleTarget);
      await supabase.from('user_roles_list').delete().eq('role_name', deleteRoleTarget);

      const newMap = { ...permMap };
      const newOriginal = { ...originalMap };
      for (const key of Object.keys(newMap)) {
        if (key.startsWith(`${deleteRoleTarget}::`)) {
          delete newMap[key];
          delete newOriginal[key];
        }
      }
      setPermMap(newMap);
      setOriginalMap(newOriginal);

      queryClient.invalidateQueries({ queryKey: ['user_roles_list'] });
      toast({ title: 'Роль удалена', description: `Роль "${deleteRoleTarget}" удалена` });
      setDeleteRoleTarget(null);
    } catch (error) {
      console.error('Error deleting role:', error);
      toast({ title: 'Ошибка', description: 'Не удалось удалить роль', variant: 'destructive' });
    } finally {
      setIsDeletingRole(false);
    }
  };

  /* ═══════════════════ Render ═══════════════════ */

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive">
          <Shield className="h-5 w-5" />
          <p className="text-sm font-medium">Доступ запрещён. Только администратор может управлять правами.</p>
        </div>
      </div>
    );
  }

  const colWidth = roles.length <= 3 ? '100px' : '90px';
  const gridCols = `1fr ${roles.map(() => colWidth).join(' ')}`;

  return (
    <div className="p-4 lg:p-6 h-full overflow-y-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Матрица доступа
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Настройка разрешений для каждой роли</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setAddRoleOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Добавить роль
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Сохранить{hasChanges && ` (${changedCount})`}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Sticky role header */}
          <div className="sticky top-0 z-10 bg-background pb-2">
            <div
              className="grid gap-2 px-4 py-2 rounded-lg bg-muted/50"
              style={{ gridTemplateColumns: gridCols }}
            >
              <div className="text-xs font-semibold uppercase text-muted-foreground">Разрешение</div>
              {roles.map(role => (
                <div key={role} className="text-center flex items-center justify-center gap-1">
                  <Badge
                    variant={role === 'admin' ? 'default' : role === 'agent' ? 'secondary' : 'outline'}
                    className="text-xs"
                  >
                    {getRoleLabel(role)}
                  </Badge>
                  {!SYSTEM_ROLES.includes(role) && (
                    <button
                      onClick={() => { setDeleteRoleError(null); setDeleteRoleTarget(role); }}
                      className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Удалить роль"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Permission cards */}
          {PERMISSION_CATEGORIES.map(cat => (
            <PermissionCategoryCard
              key={cat.label}
              category={cat}
              roles={roles}
              permMap={permMap}
              originalMap={originalMap}
              onToggle={togglePerm}
              onBulkToggle={bulkToggle}
              isPermDisabled={isPermDisabled}
              getRoleLabel={getRoleLabel}
              onDisabledClick={handleDisabledClick}
              highlightedKey={highlightedKey}
            />
          ))}
        </div>
      )}

      {/* Delete Role Confirmation */}
      <AlertDialog open={!!deleteRoleTarget} onOpenChange={(open) => { if (!open) setDeleteRoleTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить роль «{deleteRoleTarget}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Все разрешения этой роли будут удалены. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteRoleError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <Shield className="h-4 w-4 shrink-0" />
              {deleteRoleError}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingRole}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteRole(); }}
              disabled={isDeletingRole}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingRole ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Role Dialog */}
      <Dialog open={addRoleOpen} onOpenChange={setAddRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить новую роль</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Название роли</Label>
              <Input
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Например: senior_agent"
                onKeyDown={(e) => e.key === 'Enter' && handleAddRole()}
              />
              <p className="text-xs text-muted-foreground">
                Латиница, нижний регистр. Будет использоваться как системный идентификатор.
              </p>
            </div>
            <Button onClick={handleAddRole} disabled={!newRoleName.trim() || isCreatingRole} className="w-full gap-2">
              {isCreatingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Создать роль
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
