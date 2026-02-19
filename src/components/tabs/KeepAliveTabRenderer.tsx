import { memo, ReactNode, useEffect, useRef, useState, lazy, Suspense, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useTabManager } from '@/hooks/useTabManager';
import { ClientTabView } from '@/components/clients/ClientTabView';
import { ShiftCloseTabView } from '@/components/shifts/ShiftCloseTabView';
import { DkpConstructor } from '@/components/dkp/DkpConstructor';
import { EuroProtocolModule } from '@/components/europrotocol/EuroProtocolModule';
import { Client } from '@/types/crm';
import { Loader2 } from 'lucide-react';
import { DocumentArchive } from '@/hooks/useDocumentArchives';

// Lazy load route components
const Index = lazy(() => import('@/pages/Index'));
const Sales = lazy(() => import('@/pages/Sales'));
const SalesHistory = lazy(() => import('@/pages/SalesHistory'));
const Clients = lazy(() => import('@/pages/Clients'));
const Policies = lazy(() => import('@/pages/Policies'));
const Catalog = lazy(() => import('@/pages/Catalog'));
const Finances = lazy(() => import('@/pages/Finances'));
const CashReports = lazy(() => import('@/pages/CashReports'));
const ShiftReports = lazy(() => import('@/pages/ShiftReports'));
const Settings = lazy(() => import('@/pages/Settings'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const MessengerSettings = lazy(() => import('@/pages/MessengerSettings'));
const ProlongationReport = lazy(() => import('@/pages/ProlongationReport'));
const CommunicationCenter = lazy(() => import('@/pages/CommunicationCenter'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Team = lazy(() => import('@/pages/Team'));
const EventLog = lazy(() => import('@/pages/EventLog'));
const Europrotocol = lazy(() => import('@/pages/Europrotocol'));
const PermissionsSettings = lazy(() => import('@/pages/PermissionsSettings'));
const AccessLogs = lazy(() => import('@/pages/AccessLogs'));

// Map routes to components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ROUTE_COMPONENTS: Record<string, React.LazyExoticComponent<any>> = {
  '/': Index,
  '/sales': Sales,
  '/sales-history': SalesHistory,
  '/clients': Clients,
  '/policies': Policies,
  '/catalog': Catalog,
  '/finances': Finances,
  '/reports': CashReports,
  '/shift-reports': ShiftReports,
  '/settings': Settings,
  '/notifications': Notifications,
  '/messenger-settings': MessengerSettings,
  '/prolongation-report': ProlongationReport,
  '/communication': CommunicationCenter,
  '/analytics': Analytics,
  '/team': Team,
  '/event-log': EventLog,
  '/europrotocol': Europrotocol,
  '/settings/permissions': PermissionsSettings,
  '/access-logs': AccessLogs,
};

// Loading fallback component
const LoadingFallback = memo(() => (
  <div className="flex items-center justify-center h-[60vh]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
));
LoadingFallback.displayName = 'LoadingFallback';

// Single tab panel that uses CSS to hide/show
const TabPanel = memo(({ 
  tabId, 
  isActive, 
  children 
}: { 
  tabId: string; 
  isActive: boolean; 
  children: ReactNode;
}) => {
  return (
    <div
      data-tab-id={tabId}
      className="h-full"
      style={{
        display: isActive ? 'block' : 'none',
        // Keep inactive tabs in flow but hidden for performance
        visibility: isActive ? 'visible' : 'hidden',
        position: isActive ? 'relative' : 'absolute',
        width: '100%',
        height: '100%',
        top: 0,
        left: 0,
      }}
      aria-hidden={!isActive}
    >
      {children}
    </div>
  );
});
TabPanel.displayName = 'TabPanel';

// Render content for a tab based on its type and data
const TabContent = memo(({ tabId, route, type, data }: {
  tabId: string;
  route?: string;
  type: string;
  data?: Record<string, unknown>;
}) => {
  const { addTab, setActiveTab, tabs } = useTabManager();
  // Handle entity tabs (client, policy, etc.)
  if (data?.entityId) {
    switch (type) {
      case 'client': {
        const handleOpenDkpArchive = (archive: DocumentArchive) => {
          const archiveTabId = `dkp-archive-${archive.id}`;
          const existingTab = tabs.find(t => t.data?.entityId === archiveTabId);
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
            data: { entityId: data.entityId, archiveData: archive.document_data },
          });
        };
        return (
          <ClientTabView 
            clientId={data.entityId as string}
            clientData={data.client as Client | undefined}
            onOpenDkpArchive={handleOpenDkpArchive}
          />
        );
      }
      case 'policy':
        return (
          <div className="p-6">
            <div className="card-elevated p-8 text-center">
              <p className="text-muted-foreground">Детальный вид полиса в разработке</p>
            </div>
          </div>
        );
    }
  }

  // Handle special tab types
  if (type === 'shift-close') {
    return <ShiftCloseTabView tabId={tabId} />;
  }

  // Handle DKP tab
  if (type === 'dkp' && data?.entityId) {
    return <DkpConstructor clientId={data.entityId as string} initialArchiveData={data?.archiveData as Record<string, any> | undefined} />;
  }

  // Handle Europrotocol tab
  if (type === 'europrotocol') {
    return <EuroProtocolModule clientId={data?.entityId as string | undefined} initialArchiveData={data?.archiveData as Record<string, any> | undefined} />;
  }

  // Handle route-based tabs
  if (route && ROUTE_COMPONENTS[route]) {
    const RouteComponent = ROUTE_COMPONENTS[route];
    return (
      <Suspense fallback={<LoadingFallback />}>
        <RouteComponent />
      </Suspense>
    );
  }

  // Fallback for unknown routes
  return (
    <div className="p-6">
      <div className="card-elevated p-8 text-center">
        <p className="text-muted-foreground">Страница не найдена</p>
      </div>
    </div>
  );
});
TabContent.displayName = 'TabContent';

// Main Keep-Alive renderer
export function KeepAliveTabRenderer() {
  const { tabs, activeTabId } = useTabManager();
  const location = useLocation();
  
  // Track which tabs have been mounted (for lazy loading)
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set());
  
  // Ensure active tab is always mounted
  useEffect(() => {
    if (activeTabId && !mountedTabs.has(activeTabId)) {
      setMountedTabs(prev => new Set([...prev, activeTabId]));
    }
  }, [activeTabId, mountedTabs]);

  // Clean up unmounted tabs when they're closed
  useEffect(() => {
    const tabIds = new Set(tabs.map(t => t.id));
    setMountedTabs(prev => {
      const next = new Set<string>();
      prev.forEach(id => {
        if (tabIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [tabs]);

  // No tabs - show empty state
  if (tabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Нет открытых вкладок</p>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden">
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId;
        const isMounted = mountedTabs.has(tab.id);
        
        // Don't render tabs that haven't been activated yet (lazy loading)
        if (!isMounted && !isActive) return null;
        
        const route = tab.data?.route as string | undefined;
        
        return (
          <TabPanel key={tab.id} tabId={tab.id} isActive={isActive}>
            <TabContent
              tabId={tab.id}
              route={route}
              type={tab.type}
              data={tab.data}
            />
          </TabPanel>
        );
      })}
    </div>
  );
}
