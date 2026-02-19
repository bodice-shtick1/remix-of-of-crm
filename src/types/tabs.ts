// Tab system types for ERP multi-tab interface

export interface Tab {
  id: string;
  title: string;
  type: TabType;
  icon?: string;
  isPinned: boolean;
  isDirty: boolean;
  isClosable: boolean;
  createdAt: Date;
  data?: Record<string, unknown>;
}

export type TabType = 
  | 'sale'
  | 'client'
  | 'policy'
  | 'report'
  | 'settings'
  | 'dashboard'
  | 'catalog'
  | 'history'
  | 'shift-close'
  | 'messenger-settings'
  | 'communication'
  | 'analytics'
  | 'dkp'
  | 'europrotocol';

export interface TabContextValue {
  tabs: Tab[];
  activeTabId: string | null;
  addTab: (tab: Omit<Tab, 'id' | 'createdAt'>) => string;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  setTabDirty: (id: string, isDirty: boolean) => void;
  pinTab: (id: string) => void;
  unpinTab: (id: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  getTabById: (id: string) => Tab | undefined;
}

export interface QuickOpenItem {
  id: string;
  title: string;
  subtitle?: string;
  type: TabType;
  icon?: string;
  action: () => void;
}
