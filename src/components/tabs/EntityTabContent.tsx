import { ReactNode } from 'react';
import { useTabManager } from '@/hooks/useTabManager';
import { ClientTabView } from '@/components/clients/ClientTabView';
import { ShiftCloseTabView } from '@/components/shifts/ShiftCloseTabView';
import { DkpConstructor } from '@/components/dkp/DkpConstructor';
import { EuroProtocolModule } from '@/components/europrotocol/EuroProtocolModule';
import { Client } from '@/types/crm';
import { DocumentArchive } from '@/hooks/useDocumentArchives';

interface EntityTabContentProps {
  children: ReactNode;
}

export function EntityTabContent({ children }: EntityTabContentProps) {
  const { tabs, activeTabId, addTab, setActiveTab } = useTabManager();
  
  const activeTab = tabs.find(t => t.id === activeTabId);
  
  // If no active tab yet, show children (initial load)
  if (!activeTab) {
    return <>{children}</>;
  }

  // Handle shift-close tab type
  if (activeTab?.type === 'shift-close') {
    return <ShiftCloseTabView tabId={activeTab.id} />;
  }

  // Handle DKP tab type
  if (activeTab?.type === 'dkp' && activeTab.data?.entityId) {
    return <DkpConstructor clientId={activeTab.data.entityId as string} initialArchiveData={activeTab.data?.archiveData as Record<string, any> | undefined} />;
  }

  // Handle Europrotocol tab type
  if (activeTab?.type === 'europrotocol') {
    return <EuroProtocolModule clientId={activeTab.data?.entityId as string | undefined} initialArchiveData={activeTab.data?.archiveData as Record<string, any> | undefined} />;
  }
  
  // Check if active tab is an entity tab (has entityId in data)
  if (activeTab?.data?.entityId) {
    // Render entity-specific view based on tab type
    switch (activeTab.type) {
      case 'client': {
        const handleOpenDkpArchive = (archive: DocumentArchive) => {
          const existingTab = tabs.find(t => t.data?.entityId === `dkp-archive-${archive.id}`);
          if (existingTab) {
            setActiveTab(existingTab.id);
            return;
          }
          addTab({
            title: `📄 ДКП (архив)`,
            type: 'dkp' as any,
            isPinned: false,
            isDirty: false,
            isClosable: true,
            data: { entityId: activeTab.data.entityId, archiveData: archive.document_data },
          });
        };
        return (
          <ClientTabView 
            clientId={activeTab.data.entityId as string}
            clientData={activeTab.data.client as Client | undefined}
            onOpenDkpArchive={handleOpenDkpArchive}
          />
        );
      }
      case 'policy':
        // TODO: Add PolicyTabView when needed
        return (
          <div className="p-6">
            <div className="card-elevated p-8 text-center">
              <p className="text-muted-foreground">Детальный вид полиса в разработке</p>
            </div>
          </div>
        );
      default:
        return <>{children}</>;
    }
  }
  
  // Default: render regular route content (for tabs with routes)
  return <>{children}</>;
}
