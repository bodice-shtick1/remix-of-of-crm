import { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Truck, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPlateNumber } from '@/hooks/useVehicleCatalog';
import { useVehicleRegistryData } from '@/hooks/useVehicleRegistryData';
import { VehicleDetailCard } from './VehicleDetailCard';

export function VehicleRegistryTab({ canManage = true }: { canManage?: boolean }) {
  const data = useVehicleRegistryData();
  const [showFilters, setShowFilters] = useState(false);

  if (data.isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)]">
      {/* Left panel — Vehicle list */}
      <div className="w-[40%] min-w-[300px] flex flex-col border rounded-lg bg-card">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Реестр ТС</h3>
              <span className="text-xs text-muted-foreground">({data.filtered.length})</span>
            </div>
            <Button
              variant={showFilters ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={data.search}
              onChange={(e) => data.setSearch(e.target.value)}
              placeholder="Госномер, VIN, ФИО владельца…"
              className="pl-8 h-8 text-sm"
            />
            {data.search && (
              <button
                onClick={() => data.setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {showFilters && (
            <div className="flex items-center gap-2">
              <Select value={data.filterBrand || '__all__'} onValueChange={(v) => data.setFilterBrand(v === '__all__' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Все марки" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Все марки</SelectItem>
                  {data.brands.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-1">
            {data.filtered.length === 0 ? (
              <div className="py-12 text-center">
                <Truck className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {data.search ? 'Ничего не найдено' : 'Реестр пуст'}
                </p>
              </div>
            ) : (
              data.filtered.map((item) => (
                <div
                  key={item.id}
                  onClick={() => data.setSelectedId(item.id)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors border border-transparent',
                    data.selectedId === item.id
                      ? 'bg-primary/10 border-primary/20'
                      : 'hover:bg-muted'
                  )}
                >
                  {/* Plate number styled */}
                  <div className="shrink-0">
                    {item.plate_number ? (
                      <div className="bg-background border-2 border-foreground/20 rounded px-2 py-0.5 font-mono text-xs font-bold tracking-wider min-w-[90px] text-center">
                        {formatPlateNumber(item.plate_number)}
                      </div>
                    ) : (
                      <div className="bg-muted rounded px-2 py-0.5 text-xs text-muted-foreground min-w-[90px] text-center">
                        Нет номера
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {item.brand_name} {item.model_name || ''}
                    </div>
                    {item.client_name && (
                      <div className="text-xs text-muted-foreground truncate">{item.client_name}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right panel — Detail card */}
      <div className="flex-1 flex flex-col border rounded-lg bg-card overflow-hidden">
        {!data.selected ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            ← Выберите автомобиль из списка
          </div>
        ) : (
          <VehicleDetailCard
            vehicle={data.selected}
            policies={data.policies}
            policiesLoading={data.policiesLoading}
            onChangeOwner={canManage ? data.changeOwner : async () => {}}
            onUpdate={canManage ? data.updateVehicle : async () => {}}
            onDelete={canManage ? data.deleteVehicle : async () => {}}
            canManage={canManage}
          />
        )}
      </div>
    </div>
  );
}
