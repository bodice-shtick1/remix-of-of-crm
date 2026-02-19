import { useCallback } from 'react';
import { useTabManager } from './useTabManager';
import { TabType } from '@/types/tabs';

interface EntityTabOptions {
  id: string;
  title: string;
  type: TabType;
  data?: Record<string, unknown>;
}

export function useEntityTab() {
  const { tabs, addTab, setActiveTab } = useTabManager();

  const openEntityTab = useCallback((options: EntityTabOptions) => {
    const { id, title, type, data } = options;
    
    // Check if tab for this entity already exists
    const existingTab = tabs.find(t => 
      t.type === type && 
      t.data?.entityId === id
    );

    if (existingTab) {
      setActiveTab(existingTab.id);
      return existingTab.id;
    }

    // Add new tab
    return addTab({
      title,
      type,
      isPinned: false,
      isDirty: false,
      isClosable: true,
      data: { entityId: id, ...data },
    });
  }, [tabs, addTab, setActiveTab]);

  const openClientTab = useCallback((client: {
    id: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    companyName?: string;
    isCompany: boolean;
  }) => {
    const displayName = client.isCompany 
      ? client.companyName 
      : `${client.lastName} ${client.firstName}`;
    
    return openEntityTab({
      id: client.id,
      title: displayName || 'Клиент',
      type: 'client',
      data: { client },
    });
  }, [openEntityTab]);

  const openPolicyTab = useCallback((policy: {
    id: string;
    policyNumber: string;
    policyType: string;
    insuranceCompany: string;
  }) => {
    return openEntityTab({
      id: policy.id,
      title: `${policy.policyType} ${policy.policyNumber}`,
      type: 'policy',
      data: { policy },
    });
  }, [openEntityTab]);

  const openDkpTab = useCallback((client: {
    id: string;
    firstName: string;
    lastName: string;
    middleName?: string;
  }) => {
    const displayName = `${client.lastName} ${client.firstName}`.trim();
    // Use a unique key per client so each client gets its own DKP tab
    return openEntityTab({
      id: `dkp-${client.id}`,
      title: `📄 ДКП: ${displayName}`,
      type: 'dkp',
      data: { entityId: client.id },
    });
  }, [openEntityTab]);

  return {
    openEntityTab,
    openClientTab,
    openPolicyTab,
    openDkpTab,
  };
}
