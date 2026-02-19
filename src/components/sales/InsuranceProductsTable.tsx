import { useState, useEffect, useRef, KeyboardEvent, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Plus, Trash2, Shield, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { format, addYears, subDays } from 'date-fns';
import { TooltipProvider } from '@/components/ui/tooltip';
import { VehiclePlateInput, VehiclePlateInputRef } from './VehiclePlateInput';
import { VehicleBrandModelCombobox } from './VehicleBrandModelCombobox';
import { InsuranceDateRangePicker } from './InsuranceDateRangePicker';
import { useVehicleCatalog } from '@/hooks/useVehicleCatalog';
import { useVehicleRegistry } from '@/hooks/useVehicleRegistry';
import { validateSeriesChar, validateNumberChar, validateVinChar, triggerShake } from '@/lib/inputValidation';

export interface InsuranceProductCatalog {
  id: string;
  name: string;
  code: string;
  default_commission_percent: number;
  round_to: number;
  default_series: string | null;
  number_length?: number;
  requires_vehicle?: boolean;
  series_mask?: string | null;
  number_mask?: string | null;
  is_roundable?: boolean;
}

export interface InsuranceCompanyData {
  id: string;
  name: string;
  logo_url: string | null;
  is_active: boolean;
}

export interface InsuranceContractData {
  id: string;
  company_id: string;
  contract_number: string;
  commission_rate: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface InsuranceItemRow {
  id: string;
  productId?: string;
  productName?: string;
  series?: string;
  number?: string;
  numberLength?: number;
  requiresVehicle?: boolean;
  seriesMask?: string;
  numberMask?: string;
  insuranceCompany?: string;
  insuranceCompanyId?: string;
  insuranceContractId?: string;
  startDate?: string;
  endDate?: string;
  premiumAmount: number;
  commissionPercent?: number;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleNumber?: string;
  vinCode?: string;
}

interface InsuranceProductsTableProps {
  items: InsuranceItemRow[];
  onItemsChange: (items: InsuranceItemRow[]) => void;
  insuranceProducts: InsuranceProductCatalog[];
  insuranceCompanies: InsuranceCompanyData[];
  insuranceContracts: InsuranceContractData[];
  lastOsagoSeries?: string;
  showCommission: boolean;
  onPremiumEntered?: () => void;
  onTabToServices?: () => void;
  getActiveContractsForCompany?: (companyId: string) => InsuranceContractData[];
}

export interface InsuranceProductsTableRef {
  addRow: () => void;
  focus: () => void;
}

// Amount input component
interface AmountInputProps {
  inputRef: (el: HTMLInputElement | null) => void;
  value: number;
  onChange: (value: number) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  className?: string;
}

const AmountInput = ({ inputRef, value, onChange, onKeyDown, onBlur, className }: AmountInputProps) => {
  const [localValue, setLocalValue] = useState(() => {
    return value === 0 ? '' : value.toFixed(2).replace('.', ',');
  });
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value === 0 ? '' : value.toFixed(2).replace('.', ','));
    }
  }, [value, isFocused]);

  const parseAmount = (val: string): number => {
    const cleaned = val.replace(/[^\d,.-]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
  };

  return (
    <Input
      ref={inputRef}
      value={localValue}
      onChange={(e) => {
        setLocalValue(e.target.value);
        onChange(parseAmount(e.target.value));
      }}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        setIsFocused(false);
        const parsed = parseAmount(e.target.value);
        setLocalValue(parsed === 0 ? '' : parsed.toFixed(2).replace('.', ','));
        onBlur();
      }}
      onKeyDown={onKeyDown}
      className={cn("h-7 text-xs text-right px-1.5", className)}
      placeholder="0,00"
    />
  );
};

// Combobox for insurance product selection
const ProductCombobox = ({ products, value, onChange, triggerRef }: {
  products: InsuranceProductCatalog[];
  value?: string;
  onChange: (id: string) => void;
  triggerRef: (el: HTMLElement | null) => void;
}) => {
  const [open, setOpen] = useState(false);
  const selected = products.find(p => p.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef as any}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-7 w-full justify-between text-xs px-1.5 font-normal"
        >
          <span className="truncate">{selected?.name || 'Тип'}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Поиск продукта…" className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="text-xs py-2 text-center">Не найдено</CommandEmpty>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.name}
                  onSelect={() => { onChange(p.id); setOpen(false); }}
                  className="text-xs"
                >
                  <Check className={cn("mr-1.5 h-3 w-3", value === p.id ? "opacity-100" : "opacity-0")} />
                  {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// Combobox for insurance company selection
const CompanyCombobox = ({ companies, value, onChange, triggerRef }: {
  companies: InsuranceCompanyData[];
  value: string;
  onChange: (id: string) => void;
  triggerRef: (el: HTMLElement | null) => void;
}) => {
  const [open, setOpen] = useState(false);
  const selected = companies.find(c => c.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef as any}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-7 w-full justify-between text-xs px-1.5 font-normal"
        >
          <span className="truncate">{selected?.name || 'СК'}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Поиск СК…" className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="text-xs py-2 text-center">Не найдено</CommandEmpty>
            <CommandGroup>
              {companies.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => { onChange(c.id); setOpen(false); }}
                  className="text-xs"
                >
                  <Check className={cn("mr-1.5 h-3 w-3", value === c.id ? "opacity-100" : "opacity-0")} />
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// Common OSAGO series options
const COMMON_SERIES = ['ХХХ', 'ТТТ', 'РРР', 'ННН', 'МММ', 'ККК', 'ЕЕЕ', 'ВВВ', 'ААС', 'ААВ', 'ААН', 'ААК'];

// Combobox for series selection with free-text input
const SeriesCombobox = ({ value, onChange, mask, placeholder, triggerRef, lastOsagoSeries, defaultSeries, onKeyDown }: {
  value: string;
  onChange: (val: string) => void;
  mask: string;
  placeholder: string;
  triggerRef: (el: HTMLElement | null) => void;
  lastOsagoSeries?: string;
  defaultSeries?: string | null;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Build unique options list
  const options = Array.from(new Set([
    ...(lastOsagoSeries ? [lastOsagoSeries] : []),
    ...(defaultSeries ? [defaultSeries] : []),
    ...COMMON_SERIES,
  ])).filter(s => s.length === mask.length);

  const filtered = search
    ? options.filter(s => s.toUpperCase().includes(search.toUpperCase()))
    : options;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef as any}
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Tab') {
              if (!open) onKeyDown?.(e as any);
            }
          }}
          className="h-full w-[60px] justify-center text-xs uppercase border-0 rounded-none bg-muted/30 hover:bg-muted/50 font-normal px-1"
        >
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[140px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Серия…"
            className="h-8 text-xs"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="text-xs py-2 text-center">
              {search.length > 0 && (
                <button
                  className="w-full text-left px-2 py-1 text-xs hover:bg-accent rounded cursor-pointer"
                  onClick={() => {
                    const upper = search.toUpperCase().slice(0, mask.length);
                    onChange(upper);
                    setSearch('');
                    setOpen(false);
                  }}
                >
                  Ввести «{search.toUpperCase().slice(0, mask.length)}»
                </button>
              )}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((s) => (
                <CommandItem
                  key={s}
                  value={s}
                  onSelect={() => {
                    onChange(s);
                    setSearch('');
                    setOpen(false);
                  }}
                  className="text-xs uppercase"
                >
                  <Check className={cn("mr-1.5 h-3 w-3", value === s ? "opacity-100" : "opacity-0")} />
                  {s}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export const InsuranceProductsTable = forwardRef<InsuranceProductsTableRef, InsuranceProductsTableProps>(({
  items,
  onItemsChange,
  insuranceProducts,
  insuranceCompanies = [],
  insuranceContracts = [],
  lastOsagoSeries,
  showCommission,
  onPremiumEntered,
  onTabToServices,
  getActiveContractsForCompany,
}, ref) => {
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const triggerRefs = useRef<Record<string, HTMLElement | null>>({});
  const plateRefs = useRef<Record<string, VehiclePlateInputRef | null>>({});
  const { lookupByPlateNumber } = useVehicleCatalog();
  const { lookupByPlate, lookupByVin, searchBrands, searchModels } = useVehicleRegistry();

  // fetchLinkedServices removed - reconciliation is now handled by the parent component
  const getContractsForCompany = (companyId: string): InsuranceContractData[] => {
    if (getActiveContractsForCompany) {
      return getActiveContractsForCompany(companyId);
    }
    const today = new Date().toISOString().split('T')[0];
    return insuranceContracts.filter(c => 
      c.company_id === companyId && 
      c.is_active && 
      c.start_date <= today && 
      c.end_date >= today
    );
  };

  const formatAmount = (value: number): string => {
    if (value === 0) return '0,00';
    return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const validateByMask = (value: string, mask: string): string => {
    let result = '';
    const upperValue = value.toUpperCase();
    
    for (let i = 0; i < Math.min(upperValue.length, mask.length); i++) {
      const char = upperValue[i];
      const maskChar = mask[i];
      
      if (maskChar === '0') {
        if (/\d/.test(char)) result += char;
      } else if (maskChar === 'A') {
        if (/[A-ZА-ЯЁ]/i.test(char)) result += char.toUpperCase();
      } else if (maskChar === '*') {
        result += char.toUpperCase();
      }
    }
    
    return result;
  };

  const getMaskPlaceholder = (mask: string): string => {
    return mask.replace(/A/g, 'X').replace(/0/g, '0').replace(/\*/g, '*');
  };

  const addNewRow = () => {
    const newId = `ins-${Date.now()}`;
    const today = format(new Date(), 'yyyy-MM-dd');
    const endDate = format(subDays(addYears(new Date(), 1), 1), 'yyyy-MM-dd');
    
    const defaultProduct = insuranceProducts.find(p => p.code === 'OSAGO');
    const defaultSeries = lastOsagoSeries || defaultProduct?.default_series || '';
    
    const newItem: InsuranceItemRow = {
      id: newId,
      productId: defaultProduct?.id,
      productName: defaultProduct?.name || 'ОСАГО',
      series: defaultSeries,
      number: '',
      numberLength: defaultProduct?.number_length ?? 10,
      requiresVehicle: defaultProduct?.requires_vehicle ?? true,
      seriesMask: defaultProduct?.series_mask || 'AAA',
      numberMask: defaultProduct?.number_mask || '0000000000',
      insuranceCompany: '',
      startDate: today,
      endDate: endDate,
      premiumAmount: 0,
      commissionPercent: defaultProduct?.default_commission_percent || 15,
    };
    
    onItemsChange([...items, newItem]);
    
    setTimeout(() => {
      setEditingCell({ rowId: newId, field: 'product' });
    }, 50);
  };

  useImperativeHandle(ref, () => ({
    addRow: addNewRow,
    focus: () => {
      if (items.length > 0) {
        setEditingCell({ rowId: items[0].id, field: 'product' });
      }
    },
  }));

  const updateItem = (id: string, updates: Partial<InsuranceItemRow>) => {
    onItemsChange(items.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeItem = (id: string) => {
    onItemsChange(items.filter(item => item.id !== id));
  };

  const focusField = useCallback((rowId: string, field: string) => {
    setTimeout(() => setEditingCell({ rowId, field }), 50);
  }, []);

  const handleProductChange = async (id: string, productId: string) => {
    const product = insuranceProducts.find(p => p.id === productId);
    if (product) {
      const isOsago = product.code === 'OSAGO';
      const defaultSeries = isOsago 
        ? (lastOsagoSeries || product.default_series || '') 
        : (product.default_series || '');
      
      updateItem(id, {
        productId,
        productName: product.name,
        series: defaultSeries,
        number: '',
        numberLength: product.number_length ?? 10,
        requiresVehicle: product.requires_vehicle ?? true,
        seriesMask: product.series_mask || 'AAA',
        numberMask: product.number_mask || '0000000000',
        commissionPercent: product.default_commission_percent,
        vehicleBrand: product.requires_vehicle ? undefined : undefined,
        vehicleModel: product.requires_vehicle ? undefined : undefined,
        vehicleNumber: product.requires_vehicle ? undefined : undefined,
      });
      
      // Linked services reconciliation handled by parent
      focusField(id, 'insuranceCompany');
    }
  };

  const getFieldOrder = (item: InsuranceItemRow) => {
    return item.requiresVehicle !== false
      ? ['product', 'insuranceCompany', 'series', 'number', 'dateRange', 'vehicleBrand', 'vehicleNumber', 'vinCode', 'premiumAmount']
      : ['product', 'insuranceCompany', 'series', 'number', 'dateRange', 'premiumAmount'];
  };

  const advanceToNextField = useCallback((rowId: string, currentField: string, rowIndex: number) => {
    const item = items.find(i => i.id === rowId);
    if (!item) return;
    const fields = getFieldOrder(item);
    const currentIndex = fields.indexOf(currentField);
    if (currentIndex < fields.length - 1) {
      focusField(rowId, fields[currentIndex + 1]);
    }
  }, [items, focusField]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, rowId: string, field: string, rowIndex: number) => {
    const item = items.find(i => i.id === rowId);
    if (!item) return;

    const fields = getFieldOrder(item);
    const currentIndex = fields.indexOf(field);

    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (field === 'premiumAmount') {
        // If premium has value, add a new row
        if (item.premiumAmount > 0) {
          onPremiumEntered?.();
          addNewRow();
        }
        return;
      }
      
      if (currentIndex < fields.length - 1) {
        setEditingCell({ rowId, field: fields[currentIndex + 1] });
      }
    } else if (e.key === 'Tab' && !e.shiftKey) {
      if (rowIndex === items.length - 1 && currentIndex === fields.length - 1) {
        e.preventDefault();
        onTabToServices?.();
      }
    }
  };

  const getTriggerRef = (rowId: string, field: string) => (el: HTMLElement | null) => {
    triggerRefs.current[`${rowId}-${field}`] = el;
  };

  const getCellRef = (rowId: string, field: string) => (el: HTMLInputElement | null) => {
    inputRefs.current[`${rowId}-${field}`] = el;
  };

  useEffect(() => {
    if (editingCell) {
      const key = `${editingCell.rowId}-${editingCell.field}`;
      const input = inputRefs.current[key];
      if (input) {
        input.focus();
        input.select();
      } else {
        // For VehiclePlateInput
        const plateRef = plateRefs.current[key];
        if (plateRef) {
          plateRef.focus();
        } else {
          // For non-input fields (Select, Combobox, DatePicker), click the trigger
          const trigger = triggerRefs.current[key];
          if (trigger) {
            trigger.click();
          }
        }
      }
    }
  }, [editingCell]);

  return (
    <TooltipProvider>
      <div className="card-elevated p-1.5 w-full overflow-hidden">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Страховые продукты</h3>
          </div>
          
          <Button size="sm" onClick={addNewRow} className="gap-1 h-7 text-xs px-2">
            <Plus className="h-3 w-3" />
            Добавить
          </Button>
        </div>

        {items.length === 0 ? (
          <div 
            className="py-6 text-center border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors mx-1"
            onClick={addNewRow}
          >
            <Shield className="h-6 w-6 mx-auto text-muted-foreground/50 mb-1" />
            <p className="text-muted-foreground text-sm">Нажмите чтобы добавить страховку</p>
          </div>
        ) : (
          <div className="w-full overflow-hidden">
            <Table className="text-xs w-full table-fixed">
              <colgroup>
                <col className="w-[9%]" />
                <col className="w-[10%]" />
                <col className="w-[14%]" />
                <col className="w-[16%]" />
                <col className="w-[18%]" />
                <col className="w-[11%]" />
                <col className="w-[12%]" />
                <col className="w-[7%]" />
                <col className="w-[3%]" />
              </colgroup>
              <TableHeader>
                <TableRow className="h-7">
                  <TableHead className="py-1 px-1 text-xs truncate">Продукт</TableHead>
                  <TableHead className="py-1 px-1 text-xs truncate">СК</TableHead>
                  <TableHead className="py-1 px-1 text-xs truncate">Серия / Номер</TableHead>
                  <TableHead className="py-1 px-1 text-xs truncate">Срок действия</TableHead>
                  <TableHead className="py-1 px-1 text-xs truncate">Марка и Модель</TableHead>
                  <TableHead className="py-1 px-1 text-xs truncate">Гос.номер</TableHead>
                  <TableHead className="py-1 px-1 text-xs truncate">VIN</TableHead>
                  <TableHead className="py-1 px-1 text-xs text-right truncate">Премия</TableHead>
                  <TableHead className="py-1 px-1"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, rowIndex) => (
                  <TableRow key={item.id} className="group h-8">
                    <TableCell className="p-0.5">
                      <ProductCombobox
                        products={insuranceProducts}
                        value={item.productId}
                        onChange={(v) => handleProductChange(item.id, v)}
                        triggerRef={getTriggerRef(item.id, 'product')}
                      />
                    </TableCell>
                    <TableCell className="p-0.5">
                      <div className="space-y-0.5">
                        <CompanyCombobox
                          companies={insuranceCompanies.filter(c => c.is_active)}
                          value={item.insuranceCompanyId || ''}
                          onChange={(companyId) => {
                            const company = insuranceCompanies.find(c => c.id === companyId);
                            const activeContracts = getContractsForCompany(companyId);
                            const defaultContract = activeContracts.length === 1 ? activeContracts[0] : null;
                            updateItem(item.id, { 
                              insuranceCompanyId: companyId,
                              insuranceCompany: company?.name || '',
                              insuranceContractId: defaultContract?.id || '',
                              commissionPercent: defaultContract?.commission_rate ?? item.commissionPercent,
                            });
                            const fields = getFieldOrder(item);
                            const nextField = fields[fields.indexOf('insuranceCompany') + 1];
                            if (nextField) focusField(item.id, nextField);
                          }}
                          triggerRef={getTriggerRef(item.id, 'insuranceCompany')}
                        />
                        {item.insuranceCompanyId && getContractsForCompany(item.insuranceCompanyId).length > 0 && (
                          <Select
                            value={item.insuranceContractId || ''}
                            onValueChange={(contractId) => {
                              const contract = insuranceContracts.find(c => c.id === contractId);
                              updateItem(item.id, { 
                                insuranceContractId: contractId,
                                commissionPercent: contract?.commission_rate ?? item.commissionPercent,
                              });
                              const fields = getFieldOrder(item);
                              const nextField = fields[fields.indexOf('insuranceCompany') + 1];
                              if (nextField) focusField(item.id, nextField);
                            }}
                          >
                            <SelectTrigger className="h-6 text-[10px] px-1">
                              <SelectValue placeholder="Договор" />
                            </SelectTrigger>
                            <SelectContent>
                              {getContractsForCompany(item.insuranceCompanyId).map((contract) => (
                                <SelectItem key={contract.id} value={contract.id}>
                                  {contract.contract_number} ({contract.commission_rate}%)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-0.5">
                      <div className="flex items-center border rounded-md bg-background overflow-hidden h-7">
                        <SeriesCombobox
                          value={item.series || ''}
                          onChange={(val) => updateItem(item.id, { series: val })}
                          mask={item.seriesMask || 'AAA'}
                          placeholder={getMaskPlaceholder(item.seriesMask || 'AAA')}
                          triggerRef={getTriggerRef(item.id, 'series')}
                          lastOsagoSeries={lastOsagoSeries}
                          defaultSeries={insuranceProducts.find(p => p.id === item.productId)?.default_series}
                          onKeyDown={(e) => handleKeyDown(e as any, item.id, 'series', rowIndex)}
                        />
                        <Input
                          ref={getCellRef(item.id, 'number')}
                          value={item.number || ''}
                          onChange={(e) => {
                            const mask = item.numberMask || '0000000000';
                            const validated = validateByMask(e.target.value, mask);
                            updateItem(item.id, { number: validated });
                          }}
                          onKeyDown={(e) => {
                            if (!['ArrowLeft','ArrowRight','Backspace','Delete','Tab','Enter'].includes(e.key)) {
                              const mask = item.numberMask || '0000000000';
                              if (!validateNumberChar(e.key, mask, (item.number || '').length, e.currentTarget.parentElement)) {
                                e.preventDefault();
                                return;
                              }
                            }
                            handleKeyDown(e, item.id, 'number', rowIndex);
                          }}
                          className="h-full flex-1 text-xs border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 px-2"
                          placeholder={getMaskPlaceholder(item.numberMask || '0000000000')}
                          maxLength={(item.numberMask || '0000000000').length}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="p-0.5">
                      <InsuranceDateRangePicker
                        startDate={item.startDate}
                        endDate={item.endDate}
                        onDateChange={(s, e) => updateItem(item.id, { startDate: s, endDate: e })}
                        onComplete={() => advanceToNextField(item.id, 'dateRange', rowIndex)}
                        triggerRef={getTriggerRef(item.id, 'dateRange') as any}
                      />
                    </TableCell>
                    {item.requiresVehicle !== false ? (
                      <>
                     <TableCell className="p-0.5">
                           <VehicleBrandModelCombobox
                             brandValue={item.vehicleBrand || ''}
                             modelValue={item.vehicleModel || ''}
                             onSelect={(brand, model) => {
                               updateItem(item.id, { vehicleBrand: brand, vehicleModel: model });
                               advanceToNextField(item.id, 'vehicleBrand', rowIndex);
                             }}
                           />
                         </TableCell>
                        <TableCell className="p-0.5">
                          <VehiclePlateInput
                            ref={(r) => { plateRefs.current[`${item.id}-vehicleNumber`] = r; }}
                            value={item.vehicleNumber || ''}
                            onChange={(value) => updateItem(item.id, { vehicleNumber: value })}
                            onValidPlate={async (plateNumber) => {
                              const regVehicle = await lookupByPlate(plateNumber);
                              if (regVehicle) {
                                updateItem(item.id, {
                                  vehicleBrand: regVehicle.brand_name,
                                  vehicleModel: regVehicle.model_name || '',
                                  vinCode: regVehicle.vin_code || item.vinCode,
                                });
                                return;
                              }
                              const vehicle = await lookupByPlateNumber(plateNumber);
                              if (vehicle) {
                                updateItem(item.id, {
                                  vehicleBrand: vehicle.brand,
                                  vehicleModel: vehicle.model || '',
                                });
                              }
                            }}
                            onEnter={() => advanceToNextField(item.id, 'vehicleNumber', rowIndex)}
                            className="w-full"
                          />
                        </TableCell>
                        <TableCell className="p-0.5">
                          <Input
                            ref={getCellRef(item.id, 'vinCode')}
                            value={item.vinCode || ''}
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17);
                              updateItem(item.id, { vinCode: val });
                            }}
                            onKeyDown={(e) => {
                              if (!['ArrowLeft','ArrowRight','Backspace','Delete','Tab','Enter'].includes(e.key)) {
                                if (!validateVinChar(e.key, e.currentTarget)) {
                                  e.preventDefault();
                                  return;
                                }
                              }
                              handleKeyDown(e, item.id, 'vinCode', rowIndex);
                            }}
                            onBlur={async () => {
                              if (item.vinCode && item.vinCode.length === 17) {
                                const vehicle = await lookupByVin(item.vinCode);
                                if (vehicle && !item.vehicleBrand) {
                                  updateItem(item.id, {
                                    vehicleBrand: vehicle.brand_name,
                                    vehicleModel: vehicle.model_name || '',
                                    vehicleNumber: vehicle.plate_number || item.vehicleNumber,
                                  });
                                }
                              }
                            }}
                            className="h-7 text-xs uppercase font-mono tracking-wider px-1"
                            placeholder="VIN"
                            maxLength={17}
                          />
                        </TableCell>
                      </>
                    ) : (
                      <TableCell className="p-0.5 text-center text-muted-foreground text-[10px]" colSpan={3}>
                        <span className="italic">Авто не требуется</span>
                      </TableCell>
                    )}
                    <TableCell className="p-0.5">
                      <AmountInput
                        inputRef={getCellRef(item.id, 'premiumAmount')}
                        value={item.premiumAmount}
                        onChange={(value) => updateItem(item.id, { premiumAmount: value })}
                        onKeyDown={(e) => handleKeyDown(e, item.id, 'premiumAmount', rowIndex)}
                        onBlur={() => setEditingCell(null)}
                        className="font-medium h-7 px-1.5"
                      />
                    </TableCell>
                    <TableCell className="p-0.5">
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

InsuranceProductsTable.displayName = 'InsuranceProductsTable';
