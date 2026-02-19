import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getClientDisplayName } from '@/lib/mappers';

interface VehicleOwnerChangeDialogProps {
  vehicleId: string;
  currentOwner: string | null;
  onConfirm: (clientId: string) => Promise<void>;
  onClose: () => void;
}

interface ClientOption {
  id: string;
  name: string;
  phone: string;
}

export function VehicleOwnerChangeDialog({
  vehicleId, currentOwner, onConfirm, onClose,
}: VehicleOwnerChangeDialogProps) {
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (search.length < 2) { setClients([]); return; }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const q = search.trim();
        const { data } = await supabase
          .from('clients')
          .select('id, first_name, last_name, company_name, is_company, phone')
          .or(`last_name.ilike.%${q}%,first_name.ilike.%${q}%,phone.ilike.%${q}%,company_name.ilike.%${q}%`)
          .eq('is_archived', false)
          .limit(10);

        setClients((data || []).map((c: any) => ({
          id: c.id,
          name: getClientDisplayName(c),
          phone: c.phone,
        })));
      } catch {
        setClients([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const handleSelect = async (clientId: string) => {
    setSaving(true);
    await onConfirm(clientId);
    setSaving(false);
  };

  return (
    <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-10 flex flex-col p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Смена владельца</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {currentOwner && (
        <p className="text-xs text-muted-foreground mb-2">
          Текущий: <span className="font-medium text-foreground">{currentOwner}</span>
        </p>
      )}

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск клиента по ФИО или телефону…"
          className="pl-8 h-9 text-sm"
        />
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : clients.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            {search.length < 2 ? 'Введите минимум 2 символа' : 'Клиенты не найдены'}
          </p>
        ) : (
          <div className="space-y-1">
            {clients.map(c => (
              <button
                key={c.id}
                onClick={() => handleSelect(c.id)}
                disabled={saving}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm flex items-center justify-between"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.phone}</span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
