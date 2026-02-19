import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { Tab, TabType, TabContextValue, QuickOpenItem } from '@/types/tabs';

const TabContext = createContext<TabContextValue | null>(null);

interface TabProviderProps {
  children: ReactNode;
  onBeforeClose?: (tab: Tab) => Promise<boolean>;
}

function generateTabId(): string {
  return `tab-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

export function TabProvider({ children, onBeforeClose }: TabProviderProps) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Keep a ref to onBeforeClose so callbacks don't go stale
  const onBeforeCloseRef = useRef(onBeforeClose);
  onBeforeCloseRef.current = onBeforeClose;

  const addTab = useCallback((tabData: Omit<Tab, 'id' | 'createdAt'>): string => {
    const id = generateTabId();
    const newTab: Tab = {
      ...tabData,
      id,
      createdAt: new Date(),
    };
    
    setTabs(prev => {
      // Find position after pinned tabs
      const pinnedCount = prev.filter(t => t.isPinned).length;
      const newTabs = [...prev];
      newTabs.splice(pinnedCount, 0, newTab);
      return newTabs;
    });
    
    setActiveTabId(id);
    return id;
  }, []);

  const closeTab = useCallback(async (id: string) => {
    // Read current state via ref-like pattern to avoid stale closures
    let tabToClose: Tab | undefined;
    
    // We need to read current tabs — use a synchronous read trick
    setTabs(currentTabs => {
      tabToClose = currentTabs.find(t => t.id === id);
      return currentTabs; // no-op update, just reading
    });

    // Wait a tick to let the state settle
    await new Promise(r => setTimeout(r, 0));

    if (!tabToClose) return;

    // Check if tab is dirty and call onBeforeClose
    if (tabToClose.isDirty && onBeforeCloseRef.current) {
      const canClose = await onBeforeCloseRef.current(tabToClose);
      if (!canClose) return;
    }

    setTabs(prev => {
      const index = prev.findIndex(t => t.id === id);
      if (index === -1) return prev;
      const newTabs = prev.filter(t => t.id !== id);
      return newTabs;
    });

    // Update active tab using functional update to read latest state
    setActiveTabId(currentActiveId => {
      if (currentActiveId !== id) return currentActiveId;
      
      // Need to figure out new active tab — we'll do it in a separate setTabs
      return currentActiveId; // temporarily keep, will be fixed below
    });

    // Use setTabs to read the post-removal state and fix activeTabId
    setTabs(currentTabs => {
      setActiveTabId(currentActiveId => {
        if (currentActiveId !== id) return currentActiveId;
        if (currentTabs.length === 0) return null;
        // Find the tab that was adjacent
        const oldIndex = Math.min(
          currentTabs.length - 1,
          // We don't know the exact old index post-removal, pick last or same position
          Math.max(0, currentTabs.length - 1)
        );
        return currentTabs[oldIndex]?.id ?? null;
      });
      return currentTabs; // no-op
    });
  }, []);

  const closeOtherTabs = useCallback(async (keepId: string) => {
    // Collect all tabs to close in one pass
    setTabs(currentTabs => {
      const tabsToClose = currentTabs.filter(t => t.id !== keepId && !t.isPinned && t.isClosable);
      
      // For dirty tabs, we need async confirmation — simplified: close only non-dirty ones synchronously
      const dirtyTabs = tabsToClose.filter(t => t.isDirty);
      const cleanTabs = tabsToClose.filter(t => !t.isDirty);
      
      // Remove clean tabs immediately
      const cleanIds = new Set(cleanTabs.map(t => t.id));
      const remaining = currentTabs.filter(t => !cleanIds.has(t.id));

      // Handle dirty tabs asynchronously
      if (dirtyTabs.length > 0 && onBeforeCloseRef.current) {
        (async () => {
          for (const tab of dirtyTabs) {
            const canClose = await onBeforeCloseRef.current!(tab);
            if (canClose) {
              setTabs(prev => prev.filter(t => t.id !== tab.id));
            }
          }
        })();
      }

      return remaining;
    });
    
    setActiveTabId(keepId);
  }, []);

  const closeAllTabs = useCallback(async () => {
    setTabs(currentTabs => {
      const closable = currentTabs.filter(t => !t.isPinned && t.isClosable);
      const kept = currentTabs.filter(t => t.isPinned || !t.isClosable);
      
      const cleanClosable = closable.filter(t => !t.isDirty);
      const dirtyClosable = closable.filter(t => t.isDirty);
      
      // Remove clean tabs immediately
      const cleanIds = new Set(cleanClosable.map(t => t.id));
      const remaining = currentTabs.filter(t => !cleanIds.has(t.id));

      // Handle dirty tabs asynchronously
      if (dirtyClosable.length > 0 && onBeforeCloseRef.current) {
        (async () => {
          for (const tab of dirtyClosable) {
            const canClose = await onBeforeCloseRef.current!(tab);
            if (canClose) {
              setTabs(prev => prev.filter(t => t.id !== tab.id));
            }
          }
        })();
      }

      // Set active to first remaining tab
      setActiveTabId(kept.length > 0 ? kept[0].id : null);

      return remaining;
    });
  }, []);

  const updateTab = useCallback((id: string, updates: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const setTabDirty = useCallback((id: string, isDirty: boolean) => {
    updateTab(id, { isDirty });
  }, [updateTab]);

  const pinTab = useCallback((id: string) => {
    setTabs(prev => {
      const tabIndex = prev.findIndex(t => t.id === id);
      if (tabIndex === -1) return prev;
      
      const tab = { ...prev[tabIndex], isPinned: true };
      const newTabs = prev.filter(t => t.id !== id);
      
      // Insert at end of pinned tabs
      const lastPinnedIndex = newTabs.filter(t => t.isPinned).length;
      newTabs.splice(lastPinnedIndex, 0, tab);
      
      return newTabs;
    });
  }, []);

  const unpinTab = useCallback((id: string) => {
    setTabs(prev => {
      const tabIndex = prev.findIndex(t => t.id === id);
      if (tabIndex === -1) return prev;
      
      const tab = { ...prev[tabIndex], isPinned: false };
      const newTabs = prev.filter(t => t.id !== id);
      
      // Insert after pinned tabs
      const pinnedCount = newTabs.filter(t => t.isPinned).length;
      newTabs.splice(pinnedCount, 0, tab);
      
      return newTabs;
    });
  }, []);

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    setTabs(prev => {
      const newTabs = [...prev];
      const [movedTab] = newTabs.splice(fromIndex, 1);
      
      // Don't allow moving unpinned tabs before pinned tabs
      const pinnedCount = newTabs.filter(t => t.isPinned).length;
      const adjustedTo = !movedTab.isPinned && toIndex < pinnedCount ? pinnedCount : toIndex;
      
      newTabs.splice(adjustedTo, 0, movedTab);
      return newTabs;
    });
  }, []);

  const getTabById = useCallback((id: string) => {
    return tabs.find(t => t.id === id);
  }, [tabs]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S - Save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        setActiveTabId(currentId => {
          if (currentId) {
            window.dispatchEvent(new CustomEvent('tab-save', { detail: { tabId: currentId } }));
          }
          return currentId;
        });
      }
      
      // Ctrl+F4 or Alt+W - Close tab
      if ((e.ctrlKey && e.key === 'F4') || (e.altKey && e.key === 'w')) {
        e.preventDefault();
        // Read tabs and activeTabId from state via functional update
        setTabs(currentTabs => {
          setActiveTabId(currentActiveId => {
            if (currentActiveId) {
              const activeTab = currentTabs.find(t => t.id === currentActiveId);
              if (activeTab?.isClosable) {
                closeTab(currentActiveId);
              }
            }
            return currentActiveId;
          });
          return currentTabs; // no-op
        });
      }
      
      // Ctrl+Tab - Next tab
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        setTabs(currentTabs => {
          if (currentTabs.length > 1) {
            setActiveTabId(currentActiveId => {
              const currentIndex = currentTabs.findIndex(t => t.id === currentActiveId);
              const nextIndex = (currentIndex + 1) % currentTabs.length;
              return currentTabs[nextIndex].id;
            });
          }
          return currentTabs; // no-op
        });
      }
      
      // Ctrl+Shift+Tab - Previous tab
      if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        setTabs(currentTabs => {
          if (currentTabs.length > 1) {
            setActiveTabId(currentActiveId => {
              const currentIndex = currentTabs.findIndex(t => t.id === currentActiveId);
              const prevIndex = currentIndex === 0 ? currentTabs.length - 1 : currentIndex - 1;
              return currentTabs[prevIndex].id;
            });
          }
          return currentTabs; // no-op
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeTab]);

  return (
    <TabContext.Provider
      value={{
        tabs,
        activeTabId,
        addTab,
        closeTab,
        closeOtherTabs,
        closeAllTabs,
        setActiveTab: setActiveTabId,
        updateTab,
        setTabDirty,
        pinTab,
        unpinTab,
        reorderTabs,
        getTabById,
      }}
    >
      {children}
    </TabContext.Provider>
  );
}

export function useTabManager() {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTabManager must be used within a TabProvider');
  }
  return context;
}

// Quick open items for different tab types
export function useQuickOpenItems(): QuickOpenItem[] {
  return [
    { id: 'new-sale', title: 'Новая продажа', subtitle: 'Создать документ продажи', type: 'sale', icon: '📝', action: () => {} },
    { id: 'clients', title: 'Клиенты', subtitle: 'Список клиентов', type: 'client', icon: '👥', action: () => {} },
    { id: 'policies', title: 'Полисы', subtitle: 'Управление полисами', type: 'policy', icon: '📋', action: () => {} },
    { id: 'catalog', title: 'Каталог', subtitle: 'Продукты и услуги', type: 'catalog', icon: '📦', action: () => {} },
    { id: 'history', title: 'История продаж', subtitle: 'Журнал операций', type: 'history', icon: '📊', action: () => {} },
    { id: 'reports', title: 'Отчёты', subtitle: 'Кассовые отчёты', type: 'report', icon: '📈', action: () => {} },
    { id: 'dashboard', title: 'Дашборд', subtitle: 'Главная панель', type: 'dashboard', icon: '🏠', action: () => {} },
    { id: 'settings', title: 'Настройки', subtitle: 'Параметры системы', type: 'settings', icon: '⚙️', action: () => {} },
  ];
}
