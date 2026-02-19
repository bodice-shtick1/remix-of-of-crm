import { useState, useEffect, useRef, KeyboardEvent, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Plus, Trash2, Shield, Wrench, Link2, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { VehiclePlateInput } from './VehiclePlateInput';
import { useVehicleCatalog } from '@/hooks/useVehicleCatalog';
import { validateSeriesChar, validateNumberChar, validateVinChar } from '@/lib/inputValidation';

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

export interface ServiceCatalog {
  id: string;
  name: string;
  default_price: number;
  category: string;
  is_roundable?: boolean;
}

export interface ProductServiceLink {
  id: string;
  product_id: string;
  service_id: string;
  inclusion_type: 'auto' | 'manual';
  is_deletion_prohibited: boolean;
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

export interface SaleItemRow {
  id: string;
  type: 'insurance' | 'service' | 'rounding';
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
  serviceName?: string;
  quantity?: number;
  unitPrice?: number;
  isAutoLinked?: boolean;
  isDeletionProhibited?: boolean;
  linkedFromProductId?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleNumber?: string;
  vinCode?: string;
  isRoundable?: boolean;
}

interface SaleItemsTableInlineProps {
  items: SaleItemRow[];
  onItemsChange: (items: SaleItemRow[]) => void;
  insuranceProducts: InsuranceProductCatalog[];
  services: ServiceCatalog[];
  insuranceCompanies: InsuranceCompanyData[];
  insuranceContracts: InsuranceContractData[];
  lastOsagoSeries?: string;
  showCommission: boolean;
  onPremiumEntered?: () => void;
  onTabToPayment?: () => void;
  productServiceLinks?: ProductServiceLink[];
  getActiveContractsForCompany?: (companyId: string) => InsuranceContractData[];
}

export interface SaleItemsTableInlineRef {
  addInsuranceRow: () => void;
  addServiceRow: () => void;
}

// Separate component for amount input to prevent cursor jumping
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

  // Sync external value when not focused
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

export const SaleItemsTableInline = forwardRef<SaleItemsTableInlineRef, SaleItemsTableInlineProps>(({
  items,
  onItemsChange,
  insuranceProducts,
  services,
  insuranceCompanies = [],
  insuranceContracts = [],
  lastOsagoSeries,
  showCommission,
  onPremiumEntered,
  onTabToPayment,
  productServiceLinks = [],
  getActiveContractsForCompany,
}, ref) => {
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const lastRowRef = useRef<HTMLTableRowElement | null>(null);
  
  // Vehicle catalog hook for auto-fill
  const { lookupByPlateNumber, saveVehicle } = useVehicleCatalog();

  // Get active contracts for a selected company
  const getContractsForCompany = (companyId: string): InsuranceContractData[] => {
    if (getActiveContractsForCompany) {
      return getActiveContractsForCompany(companyId);
    }
    // Fallback: filter by company_id and check dates
    const today = new Date().toISOString().split('T')[0];
    return insuranceContracts.filter(c => 
      c.company_id === companyId && 
      c.is_active && 
      c.start_date <= today && 
      c.end_date >= today
    );
  };

  // Format amount for display (with kopecks)
  const formatAmount = (value: number): string => {
    if (value === 0) return '';
    return value.toFixed(2).replace('.', ',');
  };

  // Parse amount from input - handles proper decimal input
  const parseAmount = (value: string): number => {
    // Remove all non-numeric except comma and dot
    const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
  };

  // Validate and filter input based on mask
  // 0 = digit, A = uppercase letter, * = any character
  const validateByMask = (value: string, mask: string): string => {
    let result = '';
    const upperValue = value.toUpperCase();
    
    for (let i = 0; i < Math.min(upperValue.length, mask.length); i++) {
      const char = upperValue[i];
      const maskChar = mask[i];
      
      if (maskChar === '0') {
        // Only digits
        if (/\d/.test(char)) {
          result += char;
        }
      } else if (maskChar === 'A') {
        // Only letters (convert to uppercase)
        if (/[A-ZА-ЯЁ]/i.test(char)) {
          result += char.toUpperCase();
        }
      } else if (maskChar === '*') {
        // Any character
        result += char.toUpperCase();
      }
    }
    
    return result;
  };

  // Get placeholder from mask
  const getMaskPlaceholder = (mask: string): string => {
    return mask.replace(/A/g, 'X').replace(/0/g, '0').replace(/\*/g, '*');
  };

  // Get linked services for a product
  const getLinkedServices = (productId: string) => {
    return productServiceLinks
      .filter(link => link.product_id === productId)
      .map(link => ({
        ...link,
        service: services.find(s => s.id === link.service_id),
      }));
  };

  // Get all linked service IDs from selected products in the sale
  const getAllLinkedServiceIds = useCallback(() => {
    const selectedProductIds = items
      .filter(item => item.type === 'insurance' && item.productId)
      .map(item => item.productId!);
    
    const linkedServiceIds = new Set<string>();
    selectedProductIds.forEach(productId => {
      productServiceLinks
        .filter(link => link.product_id === productId)
        .forEach(link => linkedServiceIds.add(link.service_id));
    });
    
    return linkedServiceIds;
  }, [items, productServiceLinks]);

  // Get available services filtered by linked products
  const getAvailableServicesForSale = useCallback(() => {
    const linkedServiceIds = getAllLinkedServiceIds();
    
    // If no products selected, show all services
    if (linkedServiceIds.size === 0) {
      return services;
    }
    
    // Filter services to only show linked ones
    return services.filter(s => linkedServiceIds.has(s.id));
  }, [services, getAllLinkedServiceIds]);

  // Add auto-linked services when product is selected
  const addAutoLinkedServices = (productId: string, currentItems: SaleItemRow[]): SaleItemRow[] => {
    const autoLinks = getLinkedServices(productId).filter(l => l.inclusion_type === 'auto' && l.service);
    
    // Check which services are already added (to avoid duplicates)
    const existingServiceNames = currentItems
      .filter(item => item.type === 'service')
      .map(item => item.serviceName);
    
    const newServiceItems: SaleItemRow[] = autoLinks
      .filter(link => link.service && !existingServiceNames.includes(link.service.name))
      .map(link => ({
        id: `service-auto-${link.service!.id}-${Date.now()}`,
        type: 'service' as const,
        serviceName: link.service!.name,
        quantity: 1,
        unitPrice: link.service!.default_price,
        premiumAmount: link.service!.default_price,
        isAutoLinked: true,
        isDeletionProhibited: link.is_deletion_prohibited,
        linkedFromProductId: productId,
      }));
    
    return newServiceItems;
  };

  // Validate and remove services that are no longer linked after product change
  const validateServicesAfterProductChange = (currentItems: SaleItemRow[]): SaleItemRow[] => {
    const selectedProductIds = currentItems
      .filter(item => item.type === 'insurance' && item.productId)
      .map(item => item.productId!);
    
    // Get all linked service IDs from selected products
    const linkedServiceIds = new Set<string>();
    selectedProductIds.forEach(productId => {
      productServiceLinks
        .filter(link => link.product_id === productId)
        .forEach(link => linkedServiceIds.add(link.service_id));
    });
    
    // If no products, keep all manually added services
    if (selectedProductIds.length === 0) {
      return currentItems;
    }
    
    // Remove manually added services that are not linked to any selected product
    return currentItems.filter(item => {
      if (item.type !== 'service') return true;
      if (item.isAutoLinked) return true; // Keep auto-linked (they're managed by product selection)
      
      // Find the service by name
      const service = services.find(s => s.name === item.serviceName);
      if (!service) return true; // Keep custom services
      
      // Check if this service is linked to any selected product
      return linkedServiceIds.has(service.id);
    });
  };

  const addNewRow = (type: 'insurance' | 'service' = 'insurance') => {
    const newId = `item-${Date.now()}`;
    const today = format(new Date(), 'yyyy-MM-dd');
    const endDate = format(subDays(addYears(new Date(), 1), 1), 'yyyy-MM-dd');
    
    const defaultProduct = insuranceProducts.find(p => p.code === 'OSAGO');
    const defaultSeries = lastOsagoSeries || defaultProduct?.default_series || '';
    const numberLength = defaultProduct?.number_length ?? 10;
    const requiresVehicle = defaultProduct?.requires_vehicle ?? true;
    const seriesMask = defaultProduct?.series_mask || 'AAA';
    const numberMask = defaultProduct?.number_mask || '0000000000';
    
    let newItems: SaleItemRow[] = [];
    
    if (type === 'insurance') {
      const newItem: SaleItemRow = {
        id: newId,
        type: 'insurance',
        productId: defaultProduct?.id,
        productName: defaultProduct?.name || 'ОСАГО',
        series: defaultSeries,
        number: '',
        numberLength,
        requiresVehicle,
        seriesMask,
        numberMask,
        insuranceCompany: '',
        startDate: today,
        endDate: endDate,
        premiumAmount: 0,
        commissionPercent: defaultProduct?.default_commission_percent || 15,
      };
      
      // Add auto-linked services
      const autoServices = defaultProduct 
        ? addAutoLinkedServices(defaultProduct.id, items) 
        : [];
      
      newItems = [...items, newItem, ...autoServices];
    } else {
      const newItem: SaleItemRow = {
        id: newId,
        type: 'service',
        serviceName: '',
        quantity: 1,
        unitPrice: 0,
        premiumAmount: 0,
      };
      newItems = [...items, newItem];
    }

    onItemsChange(newItems);
    
    // Focus on the first editable field of new row
    setTimeout(() => {
      const firstField = type === 'insurance' ? 'series' : 'serviceName';
      setEditingCell({ rowId: newId, field: firstField });
    }, 50);
  };

  useImperativeHandle(ref, () => ({
    addInsuranceRow: () => addNewRow('insurance'),
    addServiceRow: () => addNewRow('service'),
  }));

  const updateItem = (id: string, updates: Partial<SaleItemRow>) => {
    onItemsChange(items.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, ...updates };
      
      // Auto-calculate for services
      if (updated.type === 'service' && (updates.quantity !== undefined || updates.unitPrice !== undefined)) {
        updated.premiumAmount = (updated.quantity || 1) * (updated.unitPrice || 0);
      }
      
      return updated;
    }));
  };

  const removeItem = (id: string) => {
    const itemToRemove = items.find(item => item.id === id);
    
    // If it's an insurance product, also remove its auto-linked services
    if (itemToRemove?.type === 'insurance' && itemToRemove.productId) {
      const linkedServiceIds = items
        .filter(item => 
          item.type === 'service' && 
          item.linkedFromProductId === itemToRemove.productId
        )
        .map(item => item.id);
      
      onItemsChange(items.filter(item => 
        item.id !== id && !linkedServiceIds.includes(item.id)
      ));
    } else {
      onItemsChange(items.filter(item => item.id !== id));
    }
  };

  const handleProductChange = (id: string, productId: string) => {
    const product = insuranceProducts.find(p => p.id === productId);
    const currentItem = items.find(i => i.id === id);
    
    if (product && currentItem) {
      const previousProductId = currentItem.productId;
      
      // Get default series from product settings (or lastOsagoSeries for OSAGO)
      const isOsago = product.code === 'OSAGO';
      const defaultSeries = isOsago 
        ? (lastOsagoSeries || product.default_series || '') 
        : (product.default_series || '');
      
      // Get masks and settings from product
      const numberLength = product.number_length ?? 10;
      const requiresVehicle = product.requires_vehicle ?? true;
      const seriesMask = product.series_mask || 'AAA';
      const numberMask = product.number_mask || '0000000000';
      
      // First update the insurance item with new product
      let updatedItems = items.map(item => {
        if (item.id !== id) return item;
        return {
          ...item,
          productId,
          productName: product.name,
          series: defaultSeries,
          number: '', // Clear number when product changes
          numberLength,
          requiresVehicle,
          seriesMask,
          numberMask,
          commissionPercent: product.default_commission_percent,
          // Clear vehicle fields if not required
          vehicleBrand: requiresVehicle ? item.vehicleBrand : undefined,
          vehicleModel: requiresVehicle ? item.vehicleModel : undefined,
          vehicleNumber: requiresVehicle ? item.vehicleNumber : undefined,
        };
      });
      
      // Remove old auto-linked services from previous product (using saved previousProductId)
      if (previousProductId) {
        updatedItems = updatedItems.filter(item => 
          item.linkedFromProductId !== previousProductId
        );
      }
      
      // Validate and remove services not linked to any selected product
      updatedItems = validateServicesAfterProductChange(updatedItems);
      
      // Add new auto-linked services
      const autoServices = addAutoLinkedServices(productId, updatedItems);
      
      onItemsChange([...updatedItems, ...autoServices]);
      
      // Focus on series field after product selection
      setTimeout(() => {
        setEditingCell({ rowId: id, field: 'series' });
      }, 50);
    }
  };

  const handleServiceChange = (id: string, serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (service) {
      updateItem(id, {
        serviceName: service.name,
        unitPrice: service.default_price,
        premiumAmount: (items.find(i => i.id === id)?.quantity || 1) * service.default_price,
      });
      setTimeout(() => {
        setEditingCell({ rowId: id, field: 'quantity' });
      }, 50);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, rowId: string, field: string, rowIndex: number) => {
    const item = items.find(i => i.id === rowId);
    if (!item) return;

    // Dynamic fields based on whether vehicle is required
    const insuranceFieldsWithVehicle = ['series', 'number', 'insuranceCompany', 'vehicleBrand', 'vehicleNumber', 'startDate', 'endDate', 'premiumAmount'];
    const insuranceFieldsNoVehicle = ['series', 'number', 'insuranceCompany', 'startDate', 'endDate', 'premiumAmount'];
    const serviceFields = ['quantity', 'unitPrice'];
    
    const fields = item.type === 'insurance' 
      ? (item.requiresVehicle !== false ? insuranceFieldsWithVehicle : insuranceFieldsNoVehicle)
      : serviceFields;
    const currentIndex = fields.indexOf(field);

    if (e.key === 'Enter') {
      e.preventDefault();
      
      // If this is the premium/price field
      if (field === 'premiumAmount' || field === 'unitPrice') {
        const currentItem = items.find(i => i.id === rowId);
        // Only add new row if this is the last row and has a value > 0
        const isLastRow = rowIndex === items.filter(i => i.type !== 'rounding').length - 1;
        if (currentItem && currentItem.premiumAmount > 0 && isLastRow) {
          onPremiumEntered?.();
          addNewRow(item.type === 'insurance' ? 'insurance' : 'service');
        } else if (!isLastRow) {
          // Move to next row's first editable field
          const nextNonRoundingItems = items.filter(i => i.type !== 'rounding');
          if (rowIndex < nextNonRoundingItems.length - 1) {
            const nextItem = nextNonRoundingItems[rowIndex + 1];
            const nextFirstField = nextItem.type === 'insurance' ? 'series' : 'quantity';
            setEditingCell({ rowId: nextItem.id, field: nextFirstField });
          }
        }
        return;
      }
      
      // Move to next field in the same row
      if (currentIndex < fields.length - 1) {
        setEditingCell({ rowId, field: fields[currentIndex + 1] });
      } else {
        // Move to premium/price field (last field)
        const lastField = item.type === 'insurance' ? 'premiumAmount' : 'unitPrice';
        setEditingCell({ rowId, field: lastField });
      }
    } else if (e.key === 'Tab' && !e.shiftKey) {
      // On last field of last row, go to payment
      const nonRoundingItems = items.filter(i => i.type !== 'rounding');
      if (rowIndex === nonRoundingItems.length - 1 && currentIndex === fields.length - 1) {
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

  // Filter out rounding items for display purposes (they are shown separately)
  const displayItems = items.filter(item => item.type !== 'rounding');
  const roundingItem = items.find(item => item.type === 'rounding');

  return (
    <TooltipProvider>
      <div className="card-elevated p-1.5 w-full max-w-none">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Услуги и продукты</h3>
          </div>
          
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => addNewRow('service')} className="gap-1 h-7 text-xs px-2">
              <Wrench className="h-3 w-3" />
              Услуга
            </Button>
            <Button size="sm" onClick={() => addNewRow('insurance')} className="gap-1 h-7 text-xs px-2">
              <Plus className="h-3 w-3" />
              Страховка
            </Button>
          </div>
        </div>

        {displayItems.length === 0 && !roundingItem ? (
          <div 
            className="py-6 text-center border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors mx-1"
            onClick={() => addNewRow('insurance')}
          >
            <Shield className="h-6 w-6 mx-auto text-muted-foreground/50 mb-1" />
            <p className="text-muted-foreground text-sm">Нажмите чтобы добавить продукт</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table className="text-xs w-full">
              <TableHeader>
                <TableRow className="h-7">
                  <TableHead className="w-[90px] min-w-[90px] py-1 px-1 text-xs">Продукт</TableHead>
                  <TableHead className="w-[180px] min-w-[180px] py-1 px-1 text-xs">Серия / Номер</TableHead>
                  <TableHead className="w-[110px] min-w-[110px] py-1 px-1 text-xs">СК</TableHead>
                  <TableHead className="min-w-[160px] py-1 px-1 text-xs">
                    <div className="flex items-center gap-1">
                      <Car className="h-3 w-3" />
                      Марка/Модель
                    </div>
                  </TableHead>
                  <TableHead className="w-[120px] min-w-[120px] py-1 px-1 text-xs">Гос.номер</TableHead>
                  <TableHead className="w-[95px] min-w-[95px] py-1 px-1 text-xs">Начало</TableHead>
                  <TableHead className="w-[95px] min-w-[95px] py-1 px-1 text-xs">Оконч.</TableHead>
                  <TableHead className="w-[85px] min-w-[85px] py-1 px-1 text-xs text-right">Премия</TableHead>
                  <TableHead className="w-[32px] py-1 px-1"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayItems.map((item, rowIndex) => (
                  <TableRow 
                    key={item.id} 
                    ref={rowIndex === displayItems.length - 1 ? lastRowRef : null}
                    className={cn(
                      "group h-8",
                      item.isAutoLinked && "bg-primary/5"
                    )}
                  >
                    {item.type === 'insurance' ? (
                      <>
                        <TableCell className="p-0.5">
                          <Select
                            value={item.productId}
                            onValueChange={(v) => handleProductChange(item.id, v)}
                          >
                            <SelectTrigger className="h-7 text-xs px-1.5">
                              <SelectValue placeholder="Тип" />
                            </SelectTrigger>
                            <SelectContent>
                              {insuranceProducts.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="p-0.5">
                          {/* Combined Series/Number field with dynamic mask */}
                          <div className="flex items-center border rounded-md bg-background overflow-hidden h-7">
                            <Input
                              ref={getCellRef(item.id, 'series')}
                              value={item.series || ''}
                              onChange={(e) => {
                                const mask = item.seriesMask || 'AAA';
                                const validated = validateByMask(e.target.value, mask);
                                updateItem(item.id, { series: validated });
                              }}
                              onKeyDown={(e) => {
                                if (!['ArrowLeft','ArrowRight','Backspace','Delete','Tab','Enter'].includes(e.key)) {
                                  const mask = item.seriesMask || 'AAA';
                                  if (!validateSeriesChar(e.key, mask, (item.series || '').length, e.currentTarget.parentElement)) {
                                    e.preventDefault();
                                    return;
                                  }
                                }
                                handleKeyDown(e, item.id, 'series', rowIndex);
                              }}
                              className="h-full w-[60px] text-xs uppercase text-center border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-muted/30"
                              placeholder={getMaskPlaceholder(item.seriesMask || 'AAA')}
                              maxLength={(item.seriesMask || 'AAA').length}
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
                          <div className="space-y-0.5">
                            <Select
                              value={item.insuranceCompanyId || ''}
                              onValueChange={(companyId) => {
                                const company = insuranceCompanies.find(c => c.id === companyId);
                                const activeContracts = getContractsForCompany(companyId);
                                // Auto-select contract if only one available
                                const defaultContract = activeContracts.length === 1 ? activeContracts[0] : null;
                                updateItem(item.id, { 
                                  insuranceCompanyId: companyId,
                                  insuranceCompany: company?.name || '',
                                  insuranceContractId: defaultContract?.id || '',
                                  // Update commission from contract if available
                                  commissionPercent: defaultContract?.commission_rate ?? item.commissionPercent,
                                });
                                if (!defaultContract && activeContracts.length > 1) {
                                  // Focus on contract selection
                                } else {
                                  setTimeout(() => setEditingCell({ rowId: item.id, field: 'startDate' }), 50);
                                }
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs px-1.5">
                                <SelectValue placeholder="СК" />
                              </SelectTrigger>
                              <SelectContent>
                                {insuranceCompanies.filter(c => c.is_active).map((company) => (
                                  <SelectItem key={company.id} value={company.id}>
                                    {company.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {/* Dependent contracts dropdown */}
                            {item.insuranceCompanyId && getContractsForCompany(item.insuranceCompanyId).length > 0 && (
                              <Select
                                value={item.insuranceContractId || ''}
                                onValueChange={(contractId) => {
                                  const contract = insuranceContracts.find(c => c.id === contractId);
                                  updateItem(item.id, { 
                                    insuranceContractId: contractId,
                                    commissionPercent: contract?.commission_rate ?? item.commissionPercent,
                                  });
                                  setTimeout(() => setEditingCell({ rowId: item.id, field: 'startDate' }), 50);
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
                        {/* Conditionally show vehicle columns based on requiresVehicle */}
                        {item.requiresVehicle !== false ? (
                          <>
                            <TableCell className="p-0.5">
                              {/* Brand/Model combined */}
                              <div className="flex items-center border rounded-md bg-background overflow-hidden h-7">
                                <Input
                                  ref={getCellRef(item.id, 'vehicleBrand')}
                                  value={item.vehicleBrand || ''}
                                  onChange={(e) => updateItem(item.id, { vehicleBrand: e.target.value })}
                                  onKeyDown={(e) => handleKeyDown(e, item.id, 'vehicleBrand', rowIndex)}
                                  className="h-full flex-1 text-xs border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1"
                                  placeholder="Марка"
                                />
                                <Input
                                  value={item.vehicleModel || ''}
                                  onChange={(e) => updateItem(item.id, { vehicleModel: e.target.value })}
                                  className="h-full flex-1 text-xs border-0 border-l rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1 bg-muted/20"
                                  placeholder="Модель"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="p-0.5">
                              <VehiclePlateInput
                                value={item.vehicleNumber || ''}
                                onChange={(value) => updateItem(item.id, { vehicleNumber: value })}
                                onValidPlate={async (plateNumber) => {
                                  // Look up vehicle by plate number
                                  const vehicle = await lookupByPlateNumber(plateNumber);
                                  if (vehicle) {
                                    // Auto-fill brand and model
                                    updateItem(item.id, {
                                      vehicleBrand: vehicle.brand,
                                      vehicleModel: vehicle.model || '',
                                    });
                                  }
                                }}
                                className="w-full"
                              />
                            </TableCell>
                          </>
                        ) : (
                          <>
                            {/* Empty cells when vehicle not required - span remaining space */}
                            <TableCell className="p-0.5 text-center text-muted-foreground text-[10px]" colSpan={2}>
                              <span className="italic">Авто не требуется</span>
                            </TableCell>
                          </>
                        )}
                        <TableCell className="p-0.5">
                          <Input
                            ref={getCellRef(item.id, 'startDate')}
                            type="date"
                            value={item.startDate || ''}
                            onChange={(e) => {
                              const startDate = e.target.value;
                              const endDate = format(subDays(addYears(new Date(startDate), 1), 1), 'yyyy-MM-dd');
                              updateItem(item.id, { startDate, endDate });
                            }}
                            onKeyDown={(e) => handleKeyDown(e, item.id, 'startDate', rowIndex)}
                            className="h-7 text-xs px-1"
                          />
                        </TableCell>
                        <TableCell className="p-0.5">
                          <Input
                            ref={getCellRef(item.id, 'endDate')}
                            type="date"
                            value={item.endDate || ''}
                            onChange={(e) => updateItem(item.id, { endDate: e.target.value })}
                            onKeyDown={(e) => handleKeyDown(e, item.id, 'endDate', rowIndex)}
                            className="h-7 text-xs px-1"
                          />
                        </TableCell>
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
                      </>
                    ) : (
                      <>
                        <TableCell className="p-0.5" colSpan={2}>
                          <div className="flex items-center gap-1">
                            {item.isAutoLinked && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-primary">
                                    <Link2 className="h-3 w-3" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Автоматически добавлено
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <Select
                              value={item.serviceName}
                              onValueChange={(v) => {
                                const availableServices = getAvailableServicesForSale();
                                const service = availableServices.find(s => s.name === v);
                                if (service) {
                                  handleServiceChange(item.id, service.id);
                                } else {
                                  updateItem(item.id, { serviceName: v });
                                }
                              }}
                              disabled={item.isAutoLinked}
                            >
                              <SelectTrigger className={cn("h-7 text-xs px-1.5", item.isAutoLinked && "opacity-70")}>
                                <SelectValue placeholder="Услуга" />
                              </SelectTrigger>
                              <SelectContent>
                                {getAvailableServicesForSale().map((service) => (
                                  <SelectItem key={service.id} value={service.name}>
                                    {service.name} ({service.default_price} ₽)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell className="p-0.5">
                          <Input
                            ref={getCellRef(item.id, 'quantity')}
                            type="number"
                            value={item.quantity || 1}
                            onChange={(e) => updateItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                            onKeyDown={(e) => handleKeyDown(e, item.id, 'quantity', rowIndex)}
                            className="h-7 text-xs text-center px-1"
                            min={1}
                          />
                        </TableCell>
                        <TableCell className="p-0.5" colSpan={3}>
                            <AmountInput
                              inputRef={getCellRef(item.id, 'unitPrice')}
                              value={item.unitPrice || 0}
                              onChange={(value) => updateItem(item.id, { unitPrice: value })}
                              onKeyDown={(e) => handleKeyDown(e, item.id, 'unitPrice', rowIndex)}
                              onBlur={() => setEditingCell(null)}
                              className="h-7 px-1.5"
                            />
                        </TableCell>
                        <TableCell className="p-0.5" colSpan={2}>
                          <div className="h-7 flex items-center justify-end text-xs font-medium pr-1">
                            {formatAmount(item.premiumAmount)} ₽
                          </div>
                        </TableCell>
                        <TableCell className="p-0.5">
                          <div className="h-7 flex items-center justify-end text-xs font-medium pr-1">
                            {formatAmount(item.premiumAmount)} ₽
                          </div>
                        </TableCell>
                        {showCommission && <TableCell className="p-0.5" />}
                      </>
                    )}
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
                {/* Rounding row */}
                {roundingItem && (
                  <TableRow className="bg-primary/5 h-7">
                    <TableCell className="p-1 font-medium text-xs" colSpan={8}>
                      Округление (без сдачи)
                    </TableCell>
                    <TableCell className="p-1 text-right font-medium text-xs text-primary">
                      +{formatAmount(roundingItem.premiumAmount)} ₽
                    </TableCell>
                    {showCommission && <TableCell className="p-0.5" />}
                    <TableCell className="p-0.5" />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
});

SaleItemsTableInline.displayName = 'SaleItemsTableInline';
