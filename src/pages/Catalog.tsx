import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Shield, Wrench, Loader2, Link2, X, Building2, Car, Truck, Lock } from 'lucide-react';
import { isSystemService } from '@/lib/systemServices';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { InsuranceCompaniesTab } from '@/components/catalog/InsuranceCompaniesTab';
import { CarBrandsModelsTab } from '@/components/catalog/CarBrandsModelsTab';
import { VehicleRegistryTab } from '@/components/catalog/VehicleRegistryTab';
import { ServerPagination } from '@/components/common/ServerPagination';

interface InsuranceProduct {
  id: string;
  name: string;
  code: string;
  default_commission_percent: number;
  round_to: number;
  default_series: string | null;
  number_length: number;
  requires_vehicle: boolean;
  series_mask: string | null;
  number_mask: string | null;
  is_active: boolean;
  is_roundable: boolean;
}

interface ServiceItem {
  id: string;
  name: string;
  default_price: number;
  category: string;
  is_active: boolean;
  is_roundable: boolean;
}

interface ProductServiceLink {
  id: string;
  product_id: string;
  service_id: string;
  inclusion_type: 'auto' | 'manual';
  is_deletion_prohibited: boolean;
  service?: ServiceItem;
}

export default function Catalog() {
  const { toast } = useToast();
  const { user, userRole } = useAuth();
  const { can } = usePermissions();
  const [isLoading, setIsLoading] = useState(true);
  
  const [insuranceProducts, setInsuranceProducts] = useState<InsuranceProduct[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [productServiceLinks, setProductServiceLinks] = useState<ProductServiceLink[]>([]);
  
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InsuranceProduct | null>(null);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);

  const [productForm, setProductForm] = useState({
    name: '',
    code: '',
    default_commission_percent: 15,
    round_to: 100,
    default_series: '',
    number_length: 10,
    requires_vehicle: true,
    series_mask: 'AAA',
    number_mask: '0000000000',
    is_active: true,
    is_roundable: true,
  });

  const [serviceForm, setServiceForm] = useState({
    name: '',
    default_price: 0,
    category: 'other',
    is_active: true,
    is_roundable: true,
  });

  const [linkForm, setLinkForm] = useState({
    service_id: '',
    inclusion_type: 'manual' as 'auto' | 'manual',
    is_deletion_prohibited: false,
  });

  const isAdmin = userRole === 'admin';

  // Pagination for products
  const [prodPage, setProdPage] = useState(0);
  const [prodPageSize, setProdPageSize] = useState(20);
  const prodTableRef = useRef<HTMLDivElement>(null);
  const prodTotalPages = Math.ceil(insuranceProducts.length / prodPageSize);
  const paginatedProducts = useMemo(() => {
    const from = prodPage * prodPageSize;
    return insuranceProducts.slice(from, from + prodPageSize);
  }, [insuranceProducts, prodPage, prodPageSize]);

  // Pagination for services
  const [svcPage, setSvcPage] = useState(0);
  const [svcPageSize, setSvcPageSize] = useState(20);
  const svcTableRef = useRef<HTMLDivElement>(null);
  const svcTotalPages = Math.ceil(services.length / svcPageSize);
  const paginatedServices = useMemo(() => {
    const from = svcPage * svcPageSize;
    return services.slice(from, from + svcPageSize);
  }, [services, svcPage, svcPageSize]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: productsData } = await supabase
        .from('insurance_products')
        .select('*')
        .order('name');
      
      if (productsData) setInsuranceProducts(productsData);

      const { data: servicesData } = await supabase
        .from('services_catalog')
        .select('*')
        .order('name');
      
      if (servicesData) setServices(servicesData);

      const { data: linksData } = await supabase
        .from('product_service_links')
        .select('*');
      
      if (linksData) setProductServiceLinks(linksData as ProductServiceLink[]);
    } catch (error) {
      console.error('Error loading catalog:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProduct = async () => {
    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('insurance_products')
          .update({
            name: productForm.name,
            code: productForm.code,
            default_commission_percent: productForm.default_commission_percent,
            round_to: productForm.round_to,
            default_series: productForm.default_series || null,
            number_length: productForm.number_length,
            requires_vehicle: productForm.requires_vehicle,
            series_mask: productForm.series_mask || 'AAA',
            number_mask: productForm.number_mask || '0000000000',
            is_active: productForm.is_active,
            is_roundable: productForm.is_roundable,
          })
          .eq('id', editingProduct.id);

        if (error) throw error;
        toast({ title: 'Продукт обновлен' });
        setIsProductDialogOpen(false);
        resetProductForm();
      } else {
        const { data: newProduct, error } = await supabase
          .from('insurance_products')
          .insert({
            name: productForm.name,
            code: productForm.code,
            default_commission_percent: productForm.default_commission_percent,
            round_to: productForm.round_to,
            default_series: productForm.default_series || null,
            number_length: productForm.number_length,
            requires_vehicle: productForm.requires_vehicle,
            series_mask: productForm.series_mask || 'AAA',
            number_mask: productForm.number_mask || '0000000000',
            is_active: productForm.is_active,
            is_roundable: productForm.is_roundable,
          })
          .select()
          .single();

        if (error) throw error;
        toast({ title: 'Продукт добавлен', description: 'Теперь вы можете привязать услуги к продукту' });
        // Auto-open edit mode to allow linking services
        if (newProduct) {
          setEditingProduct(newProduct as InsuranceProduct);
          setLinkForm({ service_id: '', inclusion_type: 'manual', is_deletion_prohibited: false });
        }
      }

      loadData();
    } catch (error) {
      console.error('Error saving product:', error);
      toast({ title: 'Ошибка сохранения', variant: 'destructive' });
    }
  };

  const handleSaveService = async () => {
    try {
      if (editingService) {
        const { error } = await supabase
          .from('services_catalog')
          .update({
            name: serviceForm.name,
            default_price: serviceForm.default_price,
            category: serviceForm.category,
            is_active: serviceForm.is_active,
            is_roundable: serviceForm.is_roundable,
          })
          .eq('id', editingService.id);

        if (error) throw error;
        toast({ title: 'Услуга обновлена' });
      } else {
        const { error } = await supabase
          .from('services_catalog')
          .insert({
            name: serviceForm.name,
            default_price: serviceForm.default_price,
            category: serviceForm.category,
            is_active: serviceForm.is_active,
            is_roundable: serviceForm.is_roundable,
          });

        if (error) throw error;
        toast({ title: 'Услуга добавлена' });
      }

      setIsServiceDialogOpen(false);
      resetServiceForm();
      loadData();
    } catch (error) {
      console.error('Error saving service:', error);
      toast({ title: 'Ошибка сохранения', variant: 'destructive' });
    }
  };

  // handleAddLink removed - replaced by handleAddLinkInProduct

  const handleUpdateLink = async (linkId: string, updates: Partial<ProductServiceLink>) => {
    try {
      const { error } = await supabase
        .from('product_service_links')
        .update(updates)
        .eq('id', linkId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating link:', error);
      toast({ title: 'Ошибка обновления', variant: 'destructive' });
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('product_service_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
      toast({ title: 'Связь удалена' });
      loadData();
    } catch (error) {
      console.error('Error deleting link:', error);
      toast({ title: 'Ошибка удаления', variant: 'destructive' });
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Удалить продукт?')) return;
    
    try {
      const { error } = await supabase
        .from('insurance_products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Продукт удален' });
      loadData();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({ title: 'Ошибка удаления', variant: 'destructive' });
    }
  };

  const handleDeleteService = async (id: string) => {
    const service = services.find(s => s.id === id);
    if (service && isSystemService(service.name)) {
      toast({ title: 'Системная услуга', description: 'Эту услугу нельзя удалить', variant: 'destructive' });
      return;
    }
    if (!confirm('Удалить услугу?')) return;
    
    try {
      const { error } = await supabase
        .from('services_catalog')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Услуга удалена' });
      loadData();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast({ title: 'Ошибка удаления', variant: 'destructive' });
    }
  };

  const resetProductForm = () => {
    setProductForm({
      name: '',
      code: '',
      default_commission_percent: 15,
      round_to: 100,
      default_series: '',
      number_length: 10,
      requires_vehicle: true,
      series_mask: 'AAA',
      number_mask: '0000000000',
      is_active: true,
      is_roundable: true,
    });
    setEditingProduct(null);
  };

  const resetServiceForm = () => {
    setServiceForm({
      name: '',
      default_price: 0,
      category: 'other',
      is_active: true,
      is_roundable: true,
    });
    setEditingService(null);
  };

  const openEditProduct = (product: InsuranceProduct) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      code: product.code,
      default_commission_percent: product.default_commission_percent,
      round_to: product.round_to,
      default_series: product.default_series || '',
      number_length: product.number_length ?? 10,
      requires_vehicle: product.requires_vehicle ?? true,
      series_mask: product.series_mask || 'AAA',
      number_mask: product.number_mask || '0000000000',
      is_active: product.is_active,
      is_roundable: product.is_roundable ?? true,
    });
    setIsProductDialogOpen(true);
  };

  const openEditService = (service: ServiceItem) => {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      default_price: service.default_price,
      category: service.category,
      is_active: service.is_active,
      is_roundable: service.is_roundable ?? true,
    });
    setIsServiceDialogOpen(true);
  };

  const handleAddLinkInProduct = async () => {
    if (!editingProduct || !linkForm.service_id) return;

    try {
      const { error } = await supabase
        .from('product_service_links')
        .insert({
          product_id: editingProduct.id,
          service_id: linkForm.service_id,
          inclusion_type: linkForm.inclusion_type,
          is_deletion_prohibited: linkForm.is_deletion_prohibited,
        });

      if (error) throw error;
      toast({ title: 'Услуга привязана' });
      setLinkForm({ service_id: '', inclusion_type: 'manual', is_deletion_prohibited: false });
      loadData();
    } catch (error) {
      console.error('Error adding link:', error);
      toast({ title: 'Ошибка привязки', variant: 'destructive' });
    }
  };

  // Get links for a specific product
  const getProductLinks = (productId: string) => {
    return productServiceLinks
      .filter(link => link.product_id === productId)
      .map(link => ({
        ...link,
        service: services.find(s => s.id === link.service_id),
      }));
  };

  // Get available services (not yet linked to product)
  const getAvailableServices = (productId: string) => {
    const linkedServiceIds = productServiceLinks
      .filter(link => link.product_id === productId)
      .map(link => link.service_id);
    return services.filter(s => !linkedServiceIds.includes(s.id) && s.is_active);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Справочники</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Управление страховыми продуктами и услугами
          </p>
        </div>

        <Tabs defaultValue={can('cat_products_view') ? 'products' : can('cat_services_view') ? 'services' : can('cat_companies_view') ? 'companies' : can('cat_cars_view') ? 'brands' : 'vehicles'}>
          <TabsList className="mb-6">
            {can('cat_products_view') && (
              <TabsTrigger value="products" className="gap-2">
                <Shield className="h-4 w-4" />
                Страховые продукты
              </TabsTrigger>
            )}
            {can('cat_services_view') && (
              <TabsTrigger value="services" className="gap-2">
                <Wrench className="h-4 w-4" />
                Услуги
              </TabsTrigger>
            )}
            {can('cat_companies_view') && (
              <TabsTrigger value="companies" className="gap-2">
                <Building2 className="h-4 w-4" />
                СК и договоры
              </TabsTrigger>
            )}
            {can('cat_cars_view') && (
              <TabsTrigger value="brands" className="gap-2">
                <Car className="h-4 w-4" />
                Марки и Модели
              </TabsTrigger>
            )}
            {can('cat_registry_view') && (
              <TabsTrigger value="vehicles" className="gap-2">
                <Truck className="h-4 w-4" />
                Реестр ТС
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="products">
            <div className="card-elevated p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Страховые продукты</h3>
                <Dialog open={isProductDialogOpen} onOpenChange={(open) => {
                    setIsProductDialogOpen(open);
                    if (!open) resetProductForm();
                  }}>
                    <DialogTrigger asChild>
                      {can('cat_products_manage') && (
                        <Button size="sm" className="gap-1">
                          <Plus className="h-4 w-4" />
                          Добавить
                        </Button>
                      )}
                    </DialogTrigger>
                    <DialogContent className={editingProduct ? "max-w-2xl max-h-[90vh] overflow-y-auto" : ""}>
                      <DialogHeader>
                        <DialogTitle>
                          {editingProduct ? 'Редактирование' : 'Добавление'} продукта
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Название</Label>
                            <Input
                              value={productForm.name}
                              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                              placeholder="ОСАГО"
                            />
                          </div>
                          <div>
                            <Label>Код</Label>
                            <Input
                              value={productForm.code}
                              onChange={(e) => setProductForm({ ...productForm, code: e.target.value.toUpperCase() })}
                              placeholder="OSAGO"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Комиссия по умолчанию (%)</Label>
                            <Input
                              type="number"
                              value={productForm.default_commission_percent}
                              onChange={(e) => setProductForm({ ...productForm, default_commission_percent: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <Label>Округление до</Label>
                            <Input
                              type="number"
                              value={productForm.round_to}
                              onChange={(e) => setProductForm({ ...productForm, round_to: parseInt(e.target.value) || 100 })}
                            />
                          </div>
                        </div>
                        {/* Series mask settings */}
                        <div className="space-y-2 p-3 rounded-lg bg-muted/30 border">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Маска Серии / Номера</Label>
                            <span className="text-[10px] text-muted-foreground">0 — цифра, A — буква, * — любой</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-muted-foreground">Маска серии</Label>
                              <Input
                                value={productForm.series_mask}
                                onChange={(e) => setProductForm({ ...productForm, series_mask: e.target.value.toUpperCase() })}
                                placeholder="AAA"
                                maxLength={10}
                                className="font-mono"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Маска номера</Label>
                              <Input
                                value={productForm.number_mask}
                                onChange={(e) => setProductForm({ ...productForm, number_mask: e.target.value })}
                                placeholder="0000000000"
                                maxLength={20}
                                className="font-mono"
                              />
                            </div>
                          </div>
                          {/* Preview */}
                          <div className="pt-2 border-t">
                            <Label className="text-xs text-muted-foreground">Пример ввода:</Label>
                            <div className="flex items-center gap-2 mt-1 p-2 bg-background rounded border font-mono text-sm">
                              <span className="text-primary">{productForm.default_series || productForm.series_mask.replace(/A/g, 'X').replace(/0/g, '0').replace(/\*/g, '*')}</span>
                              <span className="text-muted-foreground">/</span>
                              <span className="text-foreground">{productForm.number_mask.replace(/0/g, '0').replace(/A/g, 'A').replace(/\*/g, '*')}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Серия по умолчанию</Label>
                            <Input
                              value={productForm.default_series}
                              onChange={(e) => setProductForm({ ...productForm, default_series: e.target.value.toUpperCase() })}
                              placeholder="ХХХ"
                              maxLength={productForm.series_mask.length || 3}
                            />
                          </div>
                          <div>
                            <Label>Длина номера</Label>
                            <Input
                              type="number"
                              value={productForm.number_length}
                              onChange={(e) => {
                                const len = parseInt(e.target.value) || 10;
                                setProductForm({ 
                                  ...productForm, 
                                  number_length: len,
                                  number_mask: '0'.repeat(Math.min(len, 20))
                                });
                              }}
                              min={1}
                              max={20}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-4 pt-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="requires_vehicle"
                              checked={productForm.requires_vehicle}
                              onCheckedChange={(checked) => setProductForm({ ...productForm, requires_vehicle: checked === true })}
                            />
                            <Label htmlFor="requires_vehicle" className="cursor-pointer">Требуется авто (Марка/Модель/Госномер)</Label>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={productForm.is_active}
                            onCheckedChange={(checked) => setProductForm({ ...productForm, is_active: checked })}
                          />
                          <Label>Активен</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={productForm.is_roundable}
                            onCheckedChange={(checked) => setProductForm({ ...productForm, is_roundable: checked })}
                          />
                          <Label>Участвует в округлении «без сдачи»</Label>
                        </div>
                        <Button onClick={handleSaveProduct} className="w-full">
                          {editingProduct ? 'Сохранить' : 'Добавить продукт'}
                        </Button>

                        {/* Service links section - only when editing */}
                        {editingProduct && (
                          <div className="space-y-4 pt-4 border-t">
                            <h4 className="font-semibold flex items-center gap-2">
                              <Link2 className="h-4 w-4" />
                              Привязанные услуги
                            </h4>
                            
                            {/* Add new link */}
                            <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <Label className="text-xs">Услуга</Label>
                                  <Select
                                    value={linkForm.service_id}
                                    onValueChange={(v) => setLinkForm({ ...linkForm, service_id: v })}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue placeholder="Выберите" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {getAvailableServices(editingProduct.id).map(service => (
                                        <SelectItem key={service.id} value={service.id}>
                                          {service.name} ({service.default_price} ₽)
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs">Тип</Label>
                                  <Select
                                    value={linkForm.inclusion_type}
                                    onValueChange={(v: 'auto' | 'manual') => setLinkForm({ ...linkForm, inclusion_type: v })}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="auto">Авто</SelectItem>
                                      <SelectItem value="manual">Вручную</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex items-end">
                                  <Button
                                    size="sm"
                                    onClick={handleAddLinkInProduct}
                                    disabled={!linkForm.service_id}
                                    className="w-full"
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Привязать
                                  </Button>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id="deletion_prohibited_inline"
                                  checked={linkForm.is_deletion_prohibited}
                                  onCheckedChange={(checked) => 
                                    setLinkForm({ ...linkForm, is_deletion_prohibited: !!checked })
                                  }
                                />
                                <Label htmlFor="deletion_prohibited_inline" className="text-xs">
                                  Запретить удаление (обязательная)
                                </Label>
                              </div>
                            </div>

                            {/* Linked services list */}
                            {getProductLinks(editingProduct.id).length === 0 ? (
                              <p className="text-muted-foreground text-xs py-2 text-center">
                                Услуги не привязаны
                              </p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Услуга</TableHead>
                                    <TableHead className="text-xs">Тип</TableHead>
                                    <TableHead className="text-xs">Обяз.</TableHead>
                                    <TableHead className="w-[40px]"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {getProductLinks(editingProduct.id).map(link => (
                                    <TableRow key={link.id}>
                                      <TableCell className="text-sm font-medium py-1">
                                        {link.service?.name || '—'}
                                      </TableCell>
                                      <TableCell className="py-1">
                                        <Select
                                          value={link.inclusion_type}
                                          onValueChange={(v: 'auto' | 'manual') => 
                                            handleUpdateLink(link.id, { inclusion_type: v })
                                          }
                                        >
                                          <SelectTrigger className="h-7 w-[100px] text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="auto">Авто</SelectItem>
                                            <SelectItem value="manual">Вручную</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell className="py-1">
                                        <Checkbox
                                          checked={link.is_deletion_prohibited}
                                          onCheckedChange={(checked) => 
                                            handleUpdateLink(link.id, { is_deletion_prohibited: !!checked })
                                          }
                                        />
                                      </TableCell>
                                      <TableCell className="py-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-destructive"
                                          onClick={() => handleDeleteLink(link.id)}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        )}
                      </div>
                    </DialogContent>
                </Dialog>
              </div>

              <div ref={prodTableRef} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Код</TableHead>
                    <TableHead className="text-right">Комиссия</TableHead>
                    <TableHead className="text-right">Округление</TableHead>
                    <TableHead>Серия</TableHead>
                    <TableHead>Привязанные услуги</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProducts.map((product) => {
                    const links = getProductLinks(product.id);
                    const autoLinks = links.filter(l => l.inclusion_type === 'auto');
                    const manualLinks = links.filter(l => l.inclusion_type === 'manual');
                    
                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-muted-foreground">{product.code}</TableCell>
                        <TableCell className="text-right">{product.default_commission_percent}%</TableCell>
                        <TableCell className="text-right">{product.round_to} ₽</TableCell>
                        <TableCell>{product.default_series || '-'}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-xs">
                            {autoLinks.length > 0 && (
                              <span className="text-primary">
                                Авто: {autoLinks.map(l => l.service?.name).join(', ')}
                              </span>
                            )}
                            {manualLinks.length > 0 && (
                              <span className="text-muted-foreground">
                                Вручную: {manualLinks.map(l => l.service?.name).join(', ')}
                              </span>
                            )}
                            {links.length === 0 && <span className="text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={product.is_active ? 'text-green-600' : 'text-muted-foreground'}>
                            {product.is_active ? 'Активен' : 'Неактивен'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {can('cat_products_manage') && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditProduct(product)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDeleteProduct(product.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {insuranceProducts.length > 0 && (
                <ServerPagination
                  page={prodPage}
                  totalPages={prodTotalPages}
                  totalCount={insuranceProducts.length}
                  pageSize={prodPageSize}
                  onPageChange={(p) => { setProdPage(p); prodTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                  onPageSizeChange={(s) => { setProdPageSize(s); setProdPage(0); }}
                  label="продуктов"
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="services">
            <div className="card-elevated p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Дополнительные услуги</h3>
                <Dialog open={isServiceDialogOpen} onOpenChange={(open) => {
                    setIsServiceDialogOpen(open);
                    if (!open) resetServiceForm();
                  }}>
                    <DialogTrigger asChild>
                      {can('cat_services_manage') && (
                        <Button size="sm" className="gap-1">
                          <Plus className="h-4 w-4" />
                          Добавить
                        </Button>
                      )}
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {editingService ? 'Редактирование' : 'Добавление'} услуги
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Название</Label>
                          <Input
                            value={serviceForm.name}
                            onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                            placeholder="Осмотр ТС"
                          />
                        </div>
                        <div>
                          <Label>Цена по умолчанию (₽)</Label>
                          <Input
                            type="number"
                            value={serviceForm.default_price}
                            onChange={(e) => setServiceForm({ ...serviceForm, default_price: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={serviceForm.is_active}
                            onCheckedChange={(checked) => setServiceForm({ ...serviceForm, is_active: checked })}
                          />
                          <Label>Активна</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={serviceForm.is_roundable}
                            onCheckedChange={(checked) => setServiceForm({ ...serviceForm, is_roundable: checked })}
                          />
                          <Label>Участвует в округлении «без сдачи»</Label>
                        </div>
                        <Button onClick={handleSaveService} className="w-full">
                          {editingService ? 'Сохранить' : 'Добавить'}
                        </Button>
                      </div>
                    </DialogContent>
                </Dialog>
              </div>

              <div ref={svcTableRef} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead className="text-right">Цена</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedServices.map((service) => {
                    const isSystem = isSystemService(service.name);
                    return (
                      <TableRow key={service.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {service.name}
                            {isSystem && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                                <Lock className="h-3 w-3" />
                                Системная
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{service.default_price.toLocaleString('ru-RU')} ₽</TableCell>
                        <TableCell className="text-muted-foreground">{service.category}</TableCell>
                        <TableCell>
                          <span className={service.is_active ? 'text-green-600' : 'text-muted-foreground'}>
                            {service.is_active ? 'Активна' : 'Неактивна'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {can('cat_services_manage') ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditService(service)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {isSystem ? (
                                <Lock className="h-4 w-4 text-muted-foreground ml-2" />
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => handleDeleteService(service.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {services.length > 0 && (
                <ServerPagination
                  page={svcPage}
                  totalPages={svcTotalPages}
                  totalCount={services.length}
                  pageSize={svcPageSize}
                  onPageChange={(p) => { setSvcPage(p); svcTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                  onPageSizeChange={(s) => { setSvcPageSize(s); setSvcPage(0); }}
                  label="услуг"
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="companies">
            <InsuranceCompaniesTab canManage={can('cat_companies_manage')} />
          </TabsContent>

          <TabsContent value="brands">
            <CarBrandsModelsTab canManage={can('cat_cars_manage')} />
          </TabsContent>

          <TabsContent value="vehicles">
            <VehicleRegistryTab canManage={can('cat_registry_manage')} />
          </TabsContent>
        </Tabs>

        {/* Link Services Dialog removed - now embedded in product dialog */}
    </div>
  );
}
