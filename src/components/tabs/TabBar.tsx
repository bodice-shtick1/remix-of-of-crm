import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTabManager } from '@/hooks/useTabManager';
import { Tab } from '@/types/tabs';
import { cn } from '@/lib/utils';
import { 
  X, 
  Pin, 
  PinOff, 
  ChevronLeft, 
  ChevronRight, 
  MoreHorizontal,
  FileText,
  Users,
  FileCheck,
  BarChart3,
  Settings,
  LayoutDashboard,
  Package,
  History
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sale: FileText,
  client: Users,
  policy: FileCheck,
  report: BarChart3,
  settings: Settings,
  dashboard: LayoutDashboard,
  catalog: Package,
  history: History,
  'shift-close': BarChart3,
};

interface TabBarProps {
  className?: string;
}

export function TabBar({ className }: TabBarProps) {
  const navigate = useNavigate();
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    pinTab,
    unpinTab,
    reorderTabs,
  } = useTabManager();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);
  const [overflowTabs, setOverflowTabs] = useState<Tab[]>([]);
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Check scroll state
  const checkScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setShowLeftScroll(container.scrollLeft > 0);
    setShowRightScroll(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 1
    );

    // Calculate overflow tabs
    const tabElements = container.querySelectorAll('[data-tab-id]');
    const containerRect = container.getBoundingClientRect();
    const overflow: Tab[] = [];

    tabElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.right > containerRect.right) {
        const tabId = el.getAttribute('data-tab-id');
        const tab = tabs.find(t => t.id === tabId);
        if (tab) overflow.push(tab);
      }
    });

    setOverflowTabs(overflow);
  }, [tabs]);

  useEffect(() => {
    checkScroll();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScroll);
      const resizeObserver = new ResizeObserver(checkScroll);
      resizeObserver.observe(container);
      return () => {
        container.removeEventListener('scroll', checkScroll);
        resizeObserver.disconnect();
      };
    }
  }, [checkScroll, tabs]);

  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -200, behavior: 'smooth' });
  };

  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 200, behavior: 'smooth' });
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTab(tabId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedTab !== null && dragOverIndex !== null) {
      const fromIndex = tabs.findIndex(t => t.id === draggedTab);
      if (fromIndex !== -1 && fromIndex !== dragOverIndex) {
        reorderTabs(fromIndex, dragOverIndex);
      }
    }
    setDraggedTab(null);
    setDragOverIndex(null);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const getTabIcon = (tab: Tab) => {
    const Icon = TAB_ICONS[tab.type] || FileText;
    return <Icon className="h-3.5 w-3.5" />;
  };

  if (tabs.length === 0) return null;

  return (
    <div className={cn(
      'flex items-center',
      'sticky top-0 z-10 min-h-[44px]',
      className
    )}>
      {/* Left scroll button */}
      {showLeftScroll && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-none border-r"
          onClick={scrollLeft}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Tabs container with horizontal scroll */}
      <div
        ref={scrollContainerRef}
        className="flex-1 flex items-end overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tabs.map((tab, index) => (
          <ContextMenu key={tab.id}>
            <ContextMenuTrigger asChild>
              <div
                data-tab-id={tab.id}
                draggable={!tab.isPinned}
                onDragStart={(e) => handleDragStart(e, tab.id)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onDragLeave={handleDragLeave}
                onClick={() => {
                  setActiveTab(tab.id);
                  // Navigate to tab's route if it has one
                  const tabRoute = tab.data?.route as string | undefined;
                  if (tabRoute) {
                    navigate(tabRoute, { replace: true });
                  }
                }}
                className={cn(
                  'group relative flex items-center gap-1.5 px-3 py-2 text-sm cursor-pointer select-none',
                  'border-r border-b-2 transition-colors min-w-[120px] max-w-[200px]',
                  activeTabId === tab.id
                    ? 'bg-background border-b-primary text-foreground'
                    : 'bg-muted/50 border-b-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                  draggedTab === tab.id && 'opacity-50',
                  dragOverIndex === index && 'border-l-2 border-l-primary',
                  tab.isPinned && 'min-w-[40px] max-w-[40px] justify-center'
                )}
              >
                {/* Tab icon */}
                <span className="shrink-0">{getTabIcon(tab)}</span>

                {/* Tab title (hidden for pinned tabs) */}
                {!tab.isPinned && (
                  <span className="truncate flex-1">{tab.title}</span>
                )}

                {/* Dirty indicator */}
                {tab.isDirty && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="h-2 w-2 rounded-full bg-orange-500 shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent>Несохранённые изменения</TooltipContent>
                  </Tooltip>
                )}

                {/* Pin indicator for pinned tabs */}
                {tab.isPinned && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>{tab.title}</TooltipContent>
                  </Tooltip>
                )}

                {/* Close button (hidden for pinned tabs) */}
                {tab.isClosable && !tab.isPinned && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className={cn(
                      'shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-accent',
                      'transition-opacity'
                    )}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </ContextMenuTrigger>

            <ContextMenuContent>
              {tab.isClosable && (
                <>
                  <ContextMenuItem onClick={() => closeTab(tab.id)}>
                    <X className="h-4 w-4 mr-2" />
                    Закрыть
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => closeOtherTabs(tab.id)}>
                    Закрыть другие
                  </ContextMenuItem>
                  <ContextMenuItem onClick={closeAllTabs}>
                    Закрыть все
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                </>
              )}
              {tab.isPinned ? (
                <ContextMenuItem onClick={() => unpinTab(tab.id)}>
                  <PinOff className="h-4 w-4 mr-2" />
                  Открепить
                </ContextMenuItem>
              ) : (
                <ContextMenuItem onClick={() => pinTab(tab.id)}>
                  <Pin className="h-4 w-4 mr-2" />
                  Закрепить
                </ContextMenuItem>
              )}
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>

      {/* Right scroll button */}
      {showRightScroll && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-none border-l"
          onClick={scrollRight}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {/* Overflow menu */}
      {overflowTabs.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-none border-l"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {overflowTabs.map((tab) => (
              <DropdownMenuItem
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2"
              >
                {getTabIcon(tab)}
                <span className="truncate">{tab.title}</span>
                {tab.isDirty && (
                  <span className="h-2 w-2 rounded-full bg-orange-500 ml-auto" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={closeAllTabs} className="text-destructive">
              Закрыть все
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
