import { useState } from 'react';
import { Plus, Pencil, Trash2, Lightbulb, Shield, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { SaleItem, InsuranceProduct, AdditionalService, InsuranceType } from '@/types/crm';
import { insuranceCompanies, insuranceTypes, serviceCatalog, upsellSuggestions } from '@/data/mockData';
import { cn } from '@/lib/utils';

interface SaleItemsTableProps {
  items: SaleItem[];
  onAddItem: (item: SaleItem) => void;
  onUpdateItem: (id: string, item: SaleItem) => void;
  onRemoveItem: (id: string) => void;
  onAddRoundingService: (amount: number) => void;
}

type AddMode = 'insurance' | 'service';

export function SaleItemsTable({ 
  items, 
  onAddItem, 
  onUpdateItem, 
  onRemoveItem,
  onAddRoundingService,
}: SaleItemsTableProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('insurance');
  const [editingItem, setEditingItem] = useState<SaleItem | null>(null);
  
  const [insuranceForm, setInsuranceForm] = useState<Partial<InsuranceProduct>>({
    type: 'ОСАГО',
    series: '',
    number: '',
    insuranceCompany: '',
    startDate: '',
    endDate: '',
    premiumAmount: 0,
    commissionPercent: 15,
  });
  
  const [serviceForm, setServiceForm] = useState<Partial<AdditionalService>>({
    name: '',
    quantity: 1,
    price: 0,
  });

  const hasInsuranceProducts = items.some(item => item.type === 'insurance');
  const currentInsuranceTypes = items
    .filter(item => item.type === 'insurance')
    .map(item => item.insuranceProduct?.type);
  
  const upsellSuggestion = currentInsuranceTypes
    .map(type => type ? upsellSuggestions[type] : null)
    .find(s => s !== null);

  const resetForms = () => {
    setInsuranceForm({
      type: 'ОСАГО',
      series: '',
      number: '',
      insuranceCompany: '',
      startDate: '',
      endDate: '',
      premiumAmount: 0,
      commissionPercent: 15,
    });
    setServiceForm({ name: '', quantity: 1, price: 0 });
    setEditingItem(null);
  };

  const handleAddInsurance = () => {
    if (!insuranceForm.series || !insuranceForm.number || !insuranceForm.premiumAmount) return;
    
    const newItem: SaleItem = {
      id: `ins-${Date.now()}`,
      type: 'insurance',
      insuranceProduct: {
        id: `prod-${Date.now()}`,
        type: insuranceForm.type as InsuranceType,
        series: insuranceForm.series!,
        number: insuranceForm.number!,
        insuranceCompany: insuranceForm.insuranceCompany!,
        startDate: insuranceForm.startDate!,
        endDate: insuranceForm.endDate!,
        premiumAmount: insuranceForm.premiumAmount!,
        commissionPercent: insuranceForm.commissionPercent!,
      },
      amount: insuranceForm.premiumAmount!,
    };
    
    if (editingItem) {
      onUpdateItem(editingItem.id, newItem);
    } else {
      onAddItem(newItem);
    }
    
    setIsAddDialogOpen(false);
    resetForms();
  };

  const handleAddService = () => {
    if (!serviceForm.name || !serviceForm.quantity) return;
    
    const amount = (serviceForm.price || 0) * (serviceForm.quantity || 1);
    
    const newItem: SaleItem = {
      id: `svc-${Date.now()}`,
      type: 'service',
      service: {
        id: `svc-${Date.now()}`,
        name: serviceForm.name!,
        quantity: serviceForm.quantity!,
        price: serviceForm.price!,
        amount,
      },
      amount,
    };
    
    if (editingItem) {
      onUpdateItem(editingItem.id, newItem);
    } else {
      onAddItem(newItem);
    }
    
    setIsAddDialogOpen(false);
    resetForms();
  };

  const handleEdit = (item: SaleItem) => {
    setEditingItem(item);
    if (item.type === 'insurance' && item.insuranceProduct) {
      setAddMode('insurance');
      setInsuranceForm(item.insuranceProduct);
    } else if (item.type === 'service' && item.service) {
      setAddMode('service');
      setServiceForm(item.service);
    }
    setIsAddDialogOpen(true);
  };

  const handleServiceSelect = (serviceId: string) => {
    const service = serviceCatalog.find(s => s.id === serviceId);
    if (service) {
      setServiceForm({
        ...serviceForm,
        name: service.name,
        price: service.defaultPrice,
      });
    }
  };

  const handleAcceptUpsell = () => {
    if (!upsellSuggestion) return;
    
    const newItem: SaleItem = {
      id: `ins-${Date.now()}`,
      type: 'insurance',
      insuranceProduct: {
        id: `prod-${Date.now()}`,
        type: upsellSuggestion.product as InsuranceType,
        series: 'НС',
        number: '',
        insuranceCompany: '',
        startDate: '',
        endDate: '',
        premiumAmount: upsellSuggestion.price,
        commissionPercent: 20,
      },
      amount: upsellSuggestion.price,
    };
    
    onAddItem(newItem);
  };

  return (
    <div className="card-elevated p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Услуги и продукты</h3>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForms();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Добавить
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Редактирование' : 'Добавление'} позиции
              </DialogTitle>
            </DialogHeader>
            
            {/* Переключатель типа */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={addMode === 'insurance' ? 'default' : 'outline'}
                onClick={() => setAddMode('insurance')}
                className="flex-1 gap-2"
              >
                <Shield className="h-4 w-4" />
                Страховой продукт
              </Button>
              <Button
                variant={addMode === 'service' ? 'default' : 'outline'}
                onClick={() => setAddMode('service')}
                className="flex-1 gap-2"
              >
                <Wrench className="h-4 w-4" />
                Доп. услуга
              </Button>
            </div>

            {addMode === 'insurance' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Тип страхования</Label>
                    <Select
                      value={insuranceForm.type}
                      onValueChange={(v) => setInsuranceForm({ ...insuranceForm, type: v as InsuranceType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {insuranceTypes.map((type) => (
                          <SelectItem key={type.id} value={type.name}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Страховая компания</Label>
                    <Select
                      value={insuranceForm.insuranceCompany}
                      onValueChange={(v) => setInsuranceForm({ ...insuranceForm, insuranceCompany: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите СК" />
                      </SelectTrigger>
                      <SelectContent>
                        {insuranceCompanies.map((company) => (
                          <SelectItem key={company} value={company}>
                            {company}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Серия</Label>
                    <Input
                      value={insuranceForm.series}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, series: e.target.value })}
                      placeholder="ХХХ"
                    />
                  </div>
                  <div>
                    <Label>Номер</Label>
                    <Input
                      value={insuranceForm.number}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, number: e.target.value })}
                      placeholder="1234567890"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Начало страхования</Label>
                    <Input
                      type="date"
                      value={insuranceForm.startDate}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Окончание страхования</Label>
                    <Input
                      type="date"
                      value={insuranceForm.endDate}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, endDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Сумма премии (₽)</Label>
                    <Input
                      type="number"
                      value={insuranceForm.premiumAmount || ''}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, premiumAmount: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>Комиссия (%)</Label>
                    <Input
                      type="number"
                      value={insuranceForm.commissionPercent || ''}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, commissionPercent: parseFloat(e.target.value) || 0 })}
                      placeholder="15"
                    />
                  </div>
                </div>

                <Button onClick={handleAddInsurance} className="w-full">
                  {editingItem ? 'Сохранить' : 'Добавить'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Услуга из справочника</Label>
                  <Select onValueChange={handleServiceSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите услугу" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceCatalog.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} ({service.defaultPrice} ₽)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Наименование</Label>
                  <Input
                    value={serviceForm.name}
                    onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                    placeholder="Название услуги"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Количество</Label>
                    <Input
                      type="number"
                      value={serviceForm.quantity || ''}
                      onChange={(e) => setServiceForm({ ...serviceForm, quantity: parseInt(e.target.value) || 1 })}
                      min={1}
                    />
                  </div>
                  <div>
                    <Label>Цена (₽)</Label>
                    <Input
                      type="number"
                      value={serviceForm.price || ''}
                      onChange={(e) => setServiceForm({ ...serviceForm, price: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Сумма:</p>
                  <p className="text-lg font-semibold">
                    {((serviceForm.price || 0) * (serviceForm.quantity || 1)).toLocaleString('ru-RU')} ₽
                  </p>
                </div>

                <Button onClick={handleAddService} className="w-full">
                  {editingItem ? 'Сохранить' : 'Добавить'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Таблица позиций */}
      {items.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed rounded-lg">
          <Shield className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-muted-foreground">Добавьте страховые продукты или услуги</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Наименование</TableHead>
              <TableHead>Детали</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {item.type === 'insurance' ? (
                      <Shield className="h-4 w-4 text-primary" />
                    ) : (
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">
                      {item.type === 'insurance' 
                        ? item.insuranceProduct?.type 
                        : item.service?.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {item.type === 'insurance' ? (
                    <span>
                      {item.insuranceProduct?.series} {item.insuranceProduct?.number}
                      {item.insuranceProduct?.insuranceCompany && ` • ${item.insuranceProduct.insuranceCompany}`}
                    </span>
                  ) : (
                    <span>
                      {item.service?.quantity} × {item.service?.price?.toLocaleString('ru-RU')} ₽
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {item.amount.toLocaleString('ru-RU')} ₽
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => handleEdit(item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => onRemoveItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Подсказка для допродажи */}
      {hasInsuranceProducts && upsellSuggestion && (
        <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-full">
            <Lightbulb className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm">{upsellSuggestion.message}</p>
          </div>
          <Button size="sm" variant="outline" onClick={handleAcceptUpsell}>
            Добавить
          </Button>
        </div>
      )}
    </div>
  );
}
