import { useCallback, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, Wallet, Bell, Settings,
  Shield, LogOut, ShoppingCart, History, Package, ClipboardList,
  Clock, FileSpreadsheet, MessageCircle,
  BarChart3, PanelLeftClose, PanelLeftOpen, UsersRound, Eye,
  CarFront,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { TabType } from '@/types/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUnreadEmailCount } from '@/hooks/useUnreadEmailCount';

const SIDEBAR_STORAGE_KEY = 'sidebar-collapsed';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tabType: TabType;
  adminOnly?: boolean;
  permissionKey?: string | string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navigationGroups: NavGroup[] = [
  {
    label: 'Главное',
    items: [
      { name: 'Рабочий стол', href: '/', icon: LayoutDashboard, tabType: 'dashboard', permissionKey: ['dash_stats_view', 'dash_debts_view', 'dash_income_view', 'dash_expiring_view', 'dash_events_view', 'dash_actions_access', 'dash_shift_manage'] },
      { name: 'Клиенты', href: '/clients', icon: Users, tabType: 'client', permissionKey: 'clients_view' },
      { name: 'Каталог', href: '/catalog', icon: Package, tabType: 'catalog', permissionKey: ['cat_products_view', 'cat_services_view', 'cat_companies_view', 'cat_cars_view', 'cat_registry_view'] },
    ],
  },
  {
    label: 'Продажи',
    items: [
      { name: 'Новая продажа', href: '/sales', icon: ShoppingCart, tabType: 'sale', permissionKey: 'sale_process' },
      { name: 'Европротокол', href: '/europrotocol', icon: CarFront, tabType: 'europrotocol', permissionKey: 'europrotocol_view' },
      { name: 'История продаж', href: '/sales-history', icon: History, tabType: 'history', permissionKey: 'sales_history_view' },
      { name: 'Полисы', href: '/policies', icon: FileText, tabType: 'policy', permissionKey: 'sales_history_view' },
    ],
  },
  {
    label: 'Коммуникации',
    items: [
      { name: 'Центр связи', href: '/communication', icon: MessageCircle, tabType: 'communication', permissionKey: 'comm_center_view' },
      { name: 'Уведомления', href: '/notifications', icon: Bell, tabType: 'report', permissionKey: ['notify_queue_view', 'notify_templates_manage', 'notify_manual_send', 'notify_automation_config', 'notify_mass_bulk'] },
    ],
  },
  {
    label: 'Контроль',
    items: [
      { name: 'Касса', href: '/finances', icon: Wallet, tabType: 'report', permissionKey: 'finance_view' },
      { name: 'Аналитика', href: '/analytics', icon: BarChart3, tabType: 'analytics', permissionKey: 'analytics_view' },
      { name: 'Смены', href: '/shift-reports', icon: Clock, tabType: 'report', permissionKey: 'reports_shifts_view' },
      { name: 'Отчёты по кассе', href: '/reports', icon: ClipboardList, tabType: 'report', permissionKey: 'reports_cash_view' },
      { name: 'Пролонгация', href: '/prolongation-report', icon: FileSpreadsheet, tabType: 'report', permissionKey: 'reports_prolongation_view' },
      { name: 'Журнал событий', href: '/event-log', icon: Eye, tabType: 'report', permissionKey: 'audit_log_view' },
    ],
  },
  {
    label: 'Система',
    items: [
      { name: 'Команда', href: '/team', icon: UsersRound, tabType: 'settings', permissionKey: 'team_manage' },
      { name: 'Настройки', href: '/settings', icon: Settings, tabType: 'settings', permissionKey: ['settings_edit', 'settings_profile_view', 'settings_sales_view', 'settings_company_view', 'settings_notifications_view', 'settings_channels_view', 'settings_security_view'] },
      { name: 'Матрица доступа', href: '/settings/permissions', icon: Shield, tabType: 'settings', permissionKey: 'settings_matrix_view' },
      { name: 'Журнал безопасности', href: '/access-logs', icon: Eye, tabType: 'report', adminOnly: true },
    ],
  },
];

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  }, []);
  return { collapsed, toggle };
}

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userRole, customRoleName, signOut } = useAuth();
  const { can } = usePermissions();
  const { toast } = useToast();
  const unreadEmailCount = useUnreadEmailCount();
  const effectiveRole = customRoleName || userRole;
  const isAdmin = effectiveRole === 'admin';
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.full_name) setProfileName(data.full_name);
      });
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut();
      toast({ title: 'Вы вышли из системы' });
      navigate('/auth');
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось выйти', variant: 'destructive' });
    }
  };

  const handleNavClick = useCallback((e: React.MouseEvent, href: string) => {
    e.preventDefault();
    navigate(href);
  }, [navigate]);

  const roleLabel = effectiveRole === 'admin' ? 'Администратор' : effectiveRole === 'viewer' ? 'Наблюдатель' : effectiveRole || 'Оператор';

  return (
    <aside className={cn(
      'fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col',
      collapsed ? 'w-[68px]' : 'w-60'
    )}>
      {/* Logo */}
      <div className={cn(
        'flex h-14 items-center gap-2.5 border-b border-sidebar-border shrink-0 transition-all duration-200',
        collapsed ? 'justify-center px-2' : 'px-5'
      )}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
          <Shield className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-semibold text-sidebar-foreground whitespace-nowrap tracking-tight">СтрахБрокер</h1>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2.5">
        {navigationGroups.map((group, gi) => {
          const visibleItems = group.items.filter(item => {
            if (item.adminOnly && !isAdmin) return false;
            if (item.permissionKey) {
              const keys = Array.isArray(item.permissionKey) ? item.permissionKey : [item.permissionKey];
              if (!keys.some(k => can(k))) return false;
            }
            return true;
          });
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className={cn(gi > 0 && 'mt-5')}>
              {!collapsed && (
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/40 select-none">
                  {group.label}
                </p>
              )}
              {collapsed && gi > 0 && <div className="my-2 mx-2 border-t border-sidebar-border" />}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  const badgeCount = item.href === '/communication' ? unreadEmailCount : 0;

                  const link = (
                    <a
                      key={item.name}
                      href={item.href}
                      onClick={(e) => handleNavClick(e, item.href)}
                      className={cn(
                        'sidebar-item group',
                        isActive && 'active',
                        collapsed && 'justify-center px-0'
                      )}
                    >
                      <item.icon className={cn(
                        'h-[18px] w-[18px] shrink-0 transition-colors duration-200',
                        isActive ? 'text-primary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'
                      )} />
                      {!collapsed && (
                        <span className="flex-1 truncate">{item.name}</span>
                      )}
                      {badgeCount > 0 && !collapsed && (
                        <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold leading-none">
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}
                      {badgeCount > 0 && collapsed && (
                        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-sidebar" />
                      )}
                    </a>
                  );

                  if (collapsed) {
                    return (
                      <Tooltip key={item.name}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                          {item.name}
                          {badgeCount > 0 && ` (${badgeCount})`}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return <div key={item.name}>{link}</div>;
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Toggle */}
      <div className="px-2.5 py-1.5 border-t border-sidebar-border shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggle}
              className={cn(
                'w-full flex items-center gap-2 rounded-lg p-2 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200 text-[13px]',
                collapsed && 'justify-center'
              )}
            >
              {collapsed
                ? <PanelLeftOpen className="h-[18px] w-[18px]" />
                : <><PanelLeftClose className="h-[18px] w-[18px]" /><span>Свернуть</span></>
              }
            </button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right" className="text-xs">Развернуть</TooltipContent>}
        </Tooltip>
      </div>

      {/* User profile */}
      <div className="border-t border-sidebar-border p-2.5 shrink-0">
        <div className={cn(
          'flex items-center gap-2.5 rounded-lg p-2 transition-all duration-200',
          collapsed ? 'justify-center' : 'hover:bg-sidebar-accent'
        )}>
          <div className="avatar-initials h-8 w-8 text-xs shrink-0 rounded-lg">
            {user?.email?.slice(0, 2).toUpperCase() || 'АГ'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-sidebar-foreground truncate leading-tight">
                {profileName || user?.email || 'Агент'}
              </p>
              <Badge variant="secondary" className="mt-0.5 h-4 px-1.5 text-[9px] font-medium rounded">
                {roleLabel}
              </Badge>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/40 hover:text-destructive transition-all duration-200 shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">Выйти</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}
