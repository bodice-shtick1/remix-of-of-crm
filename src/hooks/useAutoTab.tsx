import { useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTabManager } from '@/hooks/useTabManager';
import { TabType } from '@/types/tabs';
import { Tab } from '@/types/tabs';

interface RouteTabConfig {
  type: TabType;
  title: string;
  isClosable: boolean;
}

const ROUTE_TAB_MAP: Record<string, RouteTabConfig> = {
  '/': { type: 'dashboard', title: 'Рабочий стол', isClosable: false },
  '/sales': { type: 'sale', title: 'Новая продажа', isClosable: true },
  '/sales-history': { type: 'history', title: 'История продаж', isClosable: true },
  '/clients': { type: 'client', title: 'Клиенты', isClosable: true },
  '/policies': { type: 'policy', title: 'Полисы', isClosable: true },
  '/catalog': { type: 'catalog', title: 'Каталог', isClosable: true },
  '/finances': { type: 'report', title: 'Касса', isClosable: true },
  '/reports': { type: 'report', title: 'Отчёты', isClosable: true },
  '/shift-reports': { type: 'report', title: 'Смены', isClosable: true },
  '/settings': { type: 'settings', title: 'Настройки', isClosable: true },
  '/notifications': { type: 'report', title: 'Уведомления', isClosable: true },
  '/messenger-settings': { type: 'messenger-settings', title: 'Настройка мессенджеров', isClosable: true },
  '/prolongation-report': { type: 'report', title: 'Отчёт по пролонгации', isClosable: true },
  '/communication': { type: 'communication', title: 'Центр связи', isClosable: true },
  '/analytics': { type: 'analytics', title: 'Аналитика', isClosable: true },
  '/team': { type: 'settings', title: 'Команда', isClosable: true },
  '/event-log': { type: 'report', title: 'Журнал событий', isClosable: true },
  '/europrotocol': { type: 'europrotocol', title: 'Европротокол', isClosable: true },
  '/settings/permissions': { type: 'settings', title: 'Матрица доступа', isClosable: true },
};

export function useAutoTab() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tabs, addTab, setActiveTab, activeTabId } = useTabManager();

  // Keep refs to avoid stale closures and prevent deps from causing re-triggers
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  const addTabRef = useRef(addTab);
  addTabRef.current = addTab;

  const setActiveTabRef = useRef(setActiveTab);
  setActiveTabRef.current = setActiveTab;

  // Remember last seen path to avoid stealing focus when URL did not change
  const lastPathRef = useRef<string | null>(null);

  // Sync route -> tabs (only depends on pathname)
  useEffect(() => {
    const config = ROUTE_TAB_MAP[location.pathname];
    if (!config) return;

    const prevPath = lastPathRef.current;
    const pathChanged = prevPath !== null && prevPath !== location.pathname;
    lastPathRef.current = location.pathname;

    const currentTabs = tabsRef.current;
    const currentActiveId = activeTabIdRef.current;

    // Check if tab for this route already exists
    const existingTab = currentTabs.find(t =>
      t.data?.route === location.pathname ||
      (t.type === config.type && t.title === config.title && !t.data?.entityId)
    );

    if (existingTab) {
      // Only activate if not already active
      if (currentActiveId !== existingTab.id) {
        // Only auto-activate when:
        // - there is no active tab yet (initial load), OR
        // - the user actually navigated to a different path.
        if (!currentActiveId || pathChanged) {
          setActiveTabRef.current(existingTab.id);
        }
      }
    } else {
      // Add new tab
      addTabRef.current({
        title: config.title,
        type: config.type,
        isPinned: !config.isClosable,
        isDirty: false,
        isClosable: config.isClosable,
        data: { route: location.pathname },
      });
    }
  }, [location.pathname]); // Only re-run when pathname changes

  // Sync active tab -> route (when user clicks tab)
  useEffect(() => {
    const currentActiveId = activeTabIdRef.current;
    if (!currentActiveId) return;

    const activeTab = tabsRef.current.find(t => t.id === currentActiveId);
    if (!activeTab) return;

    const tabRoute = activeTab.data?.route as string | undefined;
    if (tabRoute && tabRoute !== location.pathname) {
      lastPathRef.current = tabRoute; // prevent re-trigger
      navigate(tabRoute, { replace: true });
    }
  }, [activeTabId, navigate, location.pathname]);
}
