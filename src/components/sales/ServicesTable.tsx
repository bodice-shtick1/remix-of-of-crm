import { useState, useEffect, useRef, KeyboardEvent, forwardRef, useImperativeHandle } from 'react';
import { Plus, Trash2, Wrench, Check, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';


export interface ServiceCatalog {
  id: string;
  name: string;
  default_price: number;
  category: string;
  is_roundable?: boolean;
}

export interface ServiceItemRow {
  id: string;
  serviceId?: string;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  isAutoLinked?: boolean;
  autoQuantity?: number;
  manualQuantityOverride?: boolean;
  isDeletionProhibited?: boolean;
}

interface ServicesTableProps {
  items: ServiceItemRow[];
  onItemsChange: (items: ServiceItemRow[]) => void;
  services: ServiceCatalog[];
  onServicesUpdated?: (services: ServiceCatalog[]) => void;
  onTabToPayment?: () => void;
}

export interface ServicesTableRef {
  addRow: () => void;
  focus: () => void;
}

export const ServicesTable = forwardRef<ServicesTableRef, ServicesTableProps>(({
  items,
  onItemsChange,
  services,
  onServicesUpdated,
  onTabToPayment,
}, ref) => {
  const { toast } = useToast();
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [openCombobox, setOpenCombobox] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const formatAmount = (value: number): string => {
    if (value === 0) return '0,00';
    return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const addNewRow = () => {
    const newId = `srv-${Date.now()}`;
    
    const newItem: ServiceItemRow = {
      id: newId,
      serviceName: '',
      quantity: 1,
      unitPrice: 0,
      totalAmount: 0,
    };
    
    onItemsChange([...items, newItem]);
    
    setTimeout(() => {
      setOpenCombobox(newId);
    }, 50);
  };

  useImperativeHandle(ref, () => ({
    addRow: addNewRow,
    focus: () => {
      if (items.length > 0) {
        setOpenCombobox(items[0].id);
      } else {
        addNewRow();
      }
    },
  }));

  const updateItem = (id: string, updates: Partial<ServiceItemRow>) => {
    onItemsChange(items.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, ...updates };

      // If user manually changes quantity on an auto-linked item, mark override
      if (item.isAutoLinked && updates.quantity !== undefined && updates.quantity !== item.autoQuantity) {
        updated.manualQuantityOverride = true;
      }

      // Auto-calculate total
      if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
        updated.totalAmount = (updated.quantity || 1) * (updated.unitPrice || 0);
      }
      return updated;
    }));
  };

  const removeItem = (id: string) => {
    const item = items.find(i => i.id === id);
    if (item?.isDeletionProhibited) return;
    onItemsChange(items.filter(item => item.id !== id));
  };

  const handleServiceSelect = (rowId: string, service: ServiceCatalog) => {
    updateItem(rowId, {
      serviceId: service.id,
      serviceName: service.name,
      unitPrice: service.default_price,
      totalAmount: (items.find(i => i.id === rowId)?.quantity || 1) * service.default_price,
    });
    setOpenCombobox(null);
    setSearchValue('');
    setTimeout(() => setEditingCell({ rowId, field: 'quantity' }), 50);
  };

  const handleCreateService = async (rowId: string, name: string) => {
    if (!name.trim() || isCreating) return;
    
    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('services_catalog')
        .insert({
          name: name.trim(),
          default_price: 0,
          category: 'other',
          is_active: true,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      if (onServicesUpdated && data) {
        onServicesUpdated([...services, data as ServiceCatalog]);
      }
      
      updateItem(rowId, {
        serviceId: data.id,
        serviceName: data.name,
        unitPrice: 0,
        totalAmount: 0,
      });
      
      toast({
        title: 'Услуга создана',
        description: `"${data.name}" добавлена в каталог`,
      });
      
      setOpenCombobox(null);
      setSearchValue('');
      setTimeout(() => setEditingCell({ rowId, field: 'unitPrice' }), 50);
    } catch (error) {
      console.error('Error creating service:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать услугу',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, rowId: string, field: string, rowIndex: number) => {
    const fields = ['quantity', 'unitPrice'];
    const currentIndex = fields.indexOf(field);

    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (field === 'unitPrice') {
        const isLastRow = rowIndex === items.length - 1;
        if (isLastRow) {
          onTabToPayment?.();
        } else if (rowIndex < items.length - 1) {
          const nextItem = items[rowIndex + 1];
          setOpenCombobox(nextItem.id);
        }
        return;
      }
      
      if (currentIndex < fields.length - 1) {
        setEditingCell({ rowId, field: fields[currentIndex + 1] });
      }
    } else if (e.key === 'Tab' && !e.shiftKey) {
      if (rowIndex === items.length - 1 && currentIndex === fields.length - 1) {
        e.preventDefault();
        onTabToPayment?.();
      }
    }
  };

  const getCellRef = (rowId: string, field: string) => (el: HTMLInputElement | null) => {
    inputRefs.current[`${rowId}-${field}`] = el;
  };

  useEffect(() => {
    if (editingCell) {
      const input = inputRefs.current[`${editingCell.rowId}-${editingCell.field}`];
      if (input) {
        input.focus();
        input.select();
      }
    }
  }, [editingCell]);

  const getFilteredServices = () => {
    if (!searchValue.trim()) return services;
    const search = searchValue.toLowerCase();
    return services.filter(s => s.name.toLowerCase().includes(search));
  };

  const showCreateOption = () => {
    if (!searchValue.trim()) return false;
    const search = searchValue.toLowerCase();
    return !services.some(s => s.name.toLowerCase() === search);
  };

  return (
    <TooltipProvider>
      <div className="card-elevated p-1.5 w-full">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="flex items-center gap-1.5">
            <Wrench className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Дополнительные услуги</h3>
          </div>
          
          <Button size="sm" variant="outline" onClick={addNewRow} className="gap-1 h-7 text-xs px-2">
            <Plus className="h-3 w-3" />
            Добавить
          </Button>
        </div>

        {items.length === 0 ? (
          <div 
            className="py-4 text-center border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors mx-1"
            onClick={addNewRow}
          >
            <Wrench className="h-5 w-5 mx-auto text-muted-foreground/50 mb-1" />
            <p className="text-muted-foreground text-xs">Нажмите чтобы добавить услугу</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table className="text-xs w-full">
              <TableHeader>
                <TableRow className="h-7">
                  <TableHead className="min-w-[200px] py-1 px-1 text-xs">Наименование</TableHead>
                  <TableHead className="w-[80px] min-w-[80px] py-1 px-1 text-xs text-center">Кол-во</TableHead>
                  <TableHead className="w-[100px] min-w-[100px] py-1 px-1 text-xs text-right">Цена</TableHead>
                  <TableHead className="w-[120px] min-w-[120px] py-1 px-1 text-xs text-right">Итого</TableHead>
                  <TableHead className="w-[32px] py-1 px-1"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, rowIndex) => (
                  <TableRow key={item.id} className={cn("group h-8 align-middle", item.isAutoLinked && "bg-muted/20")}>
                    <TableCell className="p-0.5 align-middle">
                      <div className="flex items-center gap-1">
                        {item.isAutoLinked && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link2 className="h-3 w-3 text-primary shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              Привязана к продукту (авто)
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {item.isAutoLinked ? (
                          <span className="text-xs truncate">{item.serviceName}</span>
                        ) : (
                          <Popover 
                            open={openCombobox === item.id} 
                            onOpenChange={(open) => {
                              setOpenCombobox(open ? item.id : null);
                              if (!open) setSearchValue('');
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openCombobox === item.id}
                                className="w-full justify-start h-7 text-xs px-2 font-normal"
                              >
                                {item.serviceName || 'Выберите услугу...'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <Command>
                                <CommandInput 
                                  placeholder="Поиск услуги..." 
                                  value={searchValue}
                                  onValueChange={setSearchValue}
                                />
                                <CommandList>
                                  <CommandEmpty>
                                    {showCreateOption() ? null : 'Услуги не найдены'}
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {getFilteredServices().map((service) => (
                                      <CommandItem
                                        key={service.id}
                                        value={service.name}
                                        onSelect={() => handleServiceSelect(item.id, service)}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            item.serviceId === service.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <div className="flex-1 flex justify-between items-center">
                                          <span>{service.name}</span>
                                          <span className="text-muted-foreground text-xs">{formatAmount(service.default_price)} ₽</span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                    {showCreateOption() && (
                                      <CommandItem
                                        onSelect={() => handleCreateService(item.id, searchValue)}
                                        className="text-primary"
                                        disabled={isCreating}
                                      >
                                        <Plus className="mr-2 h-4 w-4" />
                                        <span>+ Создать: "{searchValue}"</span>
                                      </CommandItem>
                                    )}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-0.5 align-middle">
                      <Input
                        ref={getCellRef(item.id, 'quantity')}
                        type="number"
                        value={item.quantity || 1}
                        onChange={(e) => updateItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                        onKeyDown={(e) => handleKeyDown(e, item.id, 'quantity', rowIndex)}
                        className="h-7 text-xs text-center px-1 tabular-nums"
                        min={1}
                      />
                    </TableCell>
                    <TableCell className="p-0.5 align-middle">
                        <Input
                          ref={getCellRef(item.id, 'unitPrice')}
                          type="number"
                          value={item.unitPrice || ''}
                          onChange={(e) => updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                          onKeyDown={(e) => handleKeyDown(e, item.id, 'unitPrice', rowIndex)}
                          className="h-7 text-xs text-right px-1.5 tabular-nums"
                          placeholder="0,00"
                        />
                    </TableCell>
                    <TableCell className="p-0.5 w-[120px] min-w-[120px] align-middle">
                      <div className="h-7 flex items-center justify-end text-xs font-semibold tabular-nums pr-1.5">
                        {formatAmount(item.totalAmount)}&nbsp;₽
                      </div>
                    </TableCell>
                    <TableCell className="p-0.5 align-middle">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
});

ServicesTable.displayName = 'ServicesTable';
