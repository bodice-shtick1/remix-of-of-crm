import { ReactNode, useState, useCallback } from 'react';
import { Sidebar, useSidebarCollapsed } from './Sidebar';
import { TabProvider } from '@/hooks/useTabManager';
import { TabBar } from '@/components/tabs/TabBar';
import { QuickOpenDialog } from '@/components/tabs/QuickOpenDialog';
import { UnsavedChangesDialog } from '@/components/tabs/UnsavedChangesDialog';

import { KeepAliveTabRenderer } from '@/components/tabs/KeepAliveTabRenderer';
import { FloatingCommPanel } from '@/components/communication/FloatingCommPanel';
import { BypassStatusBanner } from '@/components/dashboard/BypassStatusBanner';
import { WatermarkOverlay } from '@/components/security/WatermarkOverlay';
import { useScreenshotDetection } from '@/components/security/ScreenProtection';
import { useSuspiciousActivityDetection } from '@/components/security/SuspiciousActivityDetection';
import { useWatermarkSetting } from '@/hooks/useWatermarkSetting';
import { Tab } from '@/types/tabs';
import { useAutoTab } from '@/hooks/useAutoTab';
import { cn } from '@/lib/utils';
import { Menu, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logEventDirect } from '@/hooks/useEventLog';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface MainLayoutProps {
  children?: ReactNode;
}

function MainLayoutInner({ collapsed, onToggle, watermarksEnabled }: { collapsed: boolean; onToggle: () => void; watermarksEnabled: boolean }) {
  useAutoTab();
  useScreenshotDetection();
  useSuspiciousActivityDetection();
  const { toast } = useToast();

  const handleEmergencyLock = async () => {
    // 1. Логирование (await — чтобы запись улетела до разрыва)
    try {
      await logEventDirect({
        action: 'emergency_lock',
        category: 'access',
        entityType: 'session',
        newValue: 'Экстренная блокировка: сессия прервана, кэш очищен',
        details: { section: 'Header', reason: 'panic_button' },
      });
    } catch (e) {
      console.error('Failed to log emergency lock:', e);
    }

    // 2-5. Разрыв, очистка, редирект — выполняются всегда
    try { await supabase.auth.signOut(); } catch (_) {}
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  };

  return (
    <div 
      className="min-h-screen bg-background"
      style={{ '--sidebar-width': collapsed ? '68px' : '16rem' } as React.CSSProperties}
    >
      <Sidebar collapsed={collapsed} onToggle={onToggle} />
      <main className={cn(
        'h-screen flex flex-col overflow-hidden transition-[padding-left] duration-200',
        'max-md:pl-0',
        collapsed ? 'md:pl-[68px]' : 'md:pl-64'
      )}>
        {/* Tab bar - sticky at top, with menu button when collapsed */}
        <div className="shrink-0 flex items-center bg-muted/40 border-b border-border">
          {collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-1 shrink-0"
              onClick={onToggle}
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div className="flex-1 min-w-0">
            <TabBar />
          </div>
          <BypassStatusBanner />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="mr-2 shrink-0 inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={handleEmergencyLock}
                >
                  <ShieldAlert className="h-4 w-4" />
                  <span className="hidden sm:inline">Блокировка</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>Мгновенно выйти из системы и очистить данные на этом устройстве</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {/* Quick open dialog */}
        <QuickOpenDialog />
        
        
        {/* Keep-Alive Tab content area - all tabs stay mounted */}
        <div className="flex-1 overflow-auto">
          <KeepAliveTabRenderer />
        </div>
        
        {/* Floating inbox widget */}
        <FloatingCommPanel />
        
        {/* Security watermark */}
        <WatermarkOverlay enabled={watermarksEnabled} />
      </main>
    </div>
  );
}

export function MainLayout() {
  const { collapsed, toggle } = useSidebarCollapsed();
  const { enabled: watermarksEnabled } = useWatermarkSetting();
  const [pendingCloseTab, setPendingCloseTab] = useState<Tab | null>(null);
  const [closeResolver, setCloseResolver] = useState<((canClose: boolean) => void) | null>(null);

  const handleBeforeClose = useCallback(async (tab: Tab): Promise<boolean> => {
    if (!tab.isDirty) return true;

    return new Promise((resolve) => {
      setPendingCloseTab(tab);
      setCloseResolver(() => resolve);
    });
  }, []);

  const handleCloseDialog = () => {
    closeResolver?.(false);
    setPendingCloseTab(null);
    setCloseResolver(null);
  };

  const handleDiscard = () => {
    closeResolver?.(true);
    setPendingCloseTab(null);
    setCloseResolver(null);
  };

  const handleSave = () => {
    if (pendingCloseTab) {
      window.dispatchEvent(new CustomEvent('tab-save', { detail: { tabId: pendingCloseTab.id } }));
    }
    closeResolver?.(true);
    setPendingCloseTab(null);
    setCloseResolver(null);
  };

  return (
    <TabProvider onBeforeClose={handleBeforeClose}>
      <MainLayoutInner collapsed={collapsed} onToggle={toggle} watermarksEnabled={watermarksEnabled} />
      
      <UnsavedChangesDialog
        open={!!pendingCloseTab}
        tab={pendingCloseTab}
        onClose={handleCloseDialog}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
    </TabProvider>
  );
}
