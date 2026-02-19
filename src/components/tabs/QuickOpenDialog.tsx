import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useTabManager, useQuickOpenItems } from '@/hooks/useTabManager';
import { TabType } from '@/types/tabs';
import { 
  FileText, 
  Users, 
  FileCheck, 
  BarChart3, 
  Settings, 
  LayoutDashboard,
  Package,
  History,
  Plus,
  Search,
  MessageCircle
} from 'lucide-react';

const TYPE_ICONS: Record<TabType, React.ComponentType<{ className?: string }>> = {
  sale: FileText,
  client: Users,
  policy: FileCheck,
  report: BarChart3,
  settings: Settings,
  dashboard: LayoutDashboard,
  catalog: Package,
  history: History,
  'shift-close': BarChart3,
  'messenger-settings': MessageCircle,
  'communication': MessageCircle,
  'analytics': BarChart3,
  'dkp': FileText,
  'europrotocol': FileText,
};

const ROUTES: Record<string, string> = {
  'new-sale': '/sales',
  'clients': '/clients',
  'policies': '/policies',
  'catalog': '/catalog',
  'history': '/sales-history',
  'reports': '/reports',
  'dashboard': '/',
  'settings': '/settings',
};

export function QuickOpenDialog() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { addTab } = useTabManager();
  const quickOpenItems = useQuickOpenItems();

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelect = useCallback((itemId: string) => {
    const item = quickOpenItems.find(i => i.id === itemId);
    if (!item) return;

    // Navigate to the route
    const route = ROUTES[itemId];
    if (route) {
      navigate(route);
    }

    // Add a new tab for certain types
    if (itemId === 'new-sale') {
      addTab({
        title: 'Новая продажа',
        type: 'sale',
        isPinned: false,
        isDirty: false,
        isClosable: true,
      });
    }

    setOpen(false);
  }, [quickOpenItems, navigate, addTab]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Поиск документов, отчётов, клиентов..." />
      <CommandList>
        <CommandEmpty>Ничего не найдено</CommandEmpty>
        
        <CommandGroup heading="Быстрые действия">
          {quickOpenItems.slice(0, 3).map((item) => {
            const Icon = TYPE_ICONS[item.type];
            return (
              <CommandItem
                key={item.id}
                value={item.title}
                onSelect={() => handleSelect(item.id)}
                className="flex items-center gap-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium">{item.title}</span>
                  <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandGroup heading="Разделы">
          {quickOpenItems.slice(3).map((item) => {
            const Icon = TYPE_ICONS[item.type];
            return (
              <CommandItem
                key={item.id}
                value={item.title}
                onSelect={() => handleSelect(item.id)}
                className="flex items-center gap-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span>{item.title}</span>
                  <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
