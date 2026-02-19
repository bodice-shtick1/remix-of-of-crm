import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Building2, FileText, Loader2, Upload, X, Image } from 'lucide-react';
import { useInsuranceCompanies, InsuranceCompany, InsuranceContract } from '@/hooks/useInsuranceCompanies';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { ru } from 'date-fns/locale';

export function InsuranceCompaniesTab({ canManage = true }: { canManage?: boolean }) {
  const { toast } = useToast();
  const {
    companies,
    contracts,
    isLoading,
    createCompany,
    updateCompany,
    deleteCompany,
    createContract,
    updateContract,
    deleteContract,
    getActiveContractsForCompany,
  } = useInsuranceCompanies();

  const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState(false);
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<InsuranceCompany | null>(null);
  const [editingContract, setEditingContract] = useState<InsuranceContract | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [companyForm, setCompanyForm] = useState({
    name: '',
    logo_url: '',
    is_active: true,
  });

  const [contractForm, setContractForm] = useState({
    company_id: '',
    contract_number: '',
    commission_rate: 15,
    start_date: '',
    end_date: '',
    is_active: true,
  });

  const resetCompanyForm = () => {
    setCompanyForm({ name: '', logo_url: '', is_active: true });
    setEditingCompany(null);
  };

  const resetContractForm = () => {
    setContractForm({
      company_id: selectedCompanyId,
      contract_number: '',
      commission_rate: 15,
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), 'yyyy-MM-dd'),
      is_active: true,
    });
    setEditingContract(null);
  };

  const openEditCompany = (company: InsuranceCompany) => {
    setEditingCompany(company);
    setCompanyForm({
      name: company.name,
      logo_url: company.logo_url || '',
      is_active: company.is_active,
    });
    setIsCompanyDialogOpen(true);
  };

  const openEditContract = (contract: InsuranceContract) => {
    setEditingContract(contract);
    setContractForm({
      company_id: contract.company_id,
      contract_number: contract.contract_number,
      commission_rate: contract.commission_rate,
      start_date: contract.start_date,
      end_date: contract.end_date,
      is_active: contract.is_active,
    });
    setIsContractDialogOpen(true);
  };

  const openAddContract = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setContractForm({
      company_id: companyId,
      contract_number: '',
      commission_rate: 15,
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), 'yyyy-MM-dd'),
      is_active: true,
    });
    setIsContractDialogOpen(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Ошибка', description: 'Выберите файл изображения', variant: 'destructive' });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Ошибка', description: 'Размер файла не должен превышать 2МБ', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('insurance-logos')
        .upload(filePath, file);

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('insurance-logos')
        .getPublicUrl(filePath);

      setCompanyForm(prev => ({ ...prev, logo_url: publicUrl }));
      toast({ title: 'Логотип загружен' });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({ title: 'Ошибка загрузки логотипа', variant: 'destructive' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeLogo = () => {
    setCompanyForm(prev => ({ ...prev, logo_url: '' }));
  };

  const handleSaveCompany = async () => {
    if (!companyForm.name.trim()) return;

    if (editingCompany) {
      await updateCompany(editingCompany.id, {
        name: companyForm.name,
        logo_url: companyForm.logo_url || null,
        is_active: companyForm.is_active,
      });
    } else {
      await createCompany({
        name: companyForm.name,
        logo_url: companyForm.logo_url || null,
        is_active: companyForm.is_active,
      });
    }

    setIsCompanyDialogOpen(false);
    resetCompanyForm();
  };

  const handleSaveContract = async () => {
    if (!contractForm.contract_number.trim() || !contractForm.company_id) return;

    if (editingContract) {
      await updateContract(editingContract.id, {
        contract_number: contractForm.contract_number,
        commission_rate: contractForm.commission_rate,
        start_date: contractForm.start_date,
        end_date: contractForm.end_date,
        is_active: contractForm.is_active,
      });
    } else {
      await createContract({
        company_id: contractForm.company_id,
        contract_number: contractForm.contract_number,
        commission_rate: contractForm.commission_rate,
        start_date: contractForm.start_date,
        end_date: contractForm.end_date,
        is_active: contractForm.is_active,
      });
    }

    setIsContractDialogOpen(false);
    resetContractForm();
  };

  const handleDeleteCompany = async (id: string) => {
    if (!confirm('Удалить компанию и все её договоры?')) return;
    await deleteCompany(id);
  };

  const handleDeleteContract = async (id: string) => {
    if (!confirm('Удалить договор?')) return;
    await deleteContract(id);
  };

  const getCompanyContracts = (companyId: string) => {
    return contracts.filter(c => c.company_id === companyId);
  };

  const getContractStatus = (contract: InsuranceContract) => {
    const today = new Date();
    const startDate = parseISO(contract.start_date);
    const endDate = parseISO(contract.end_date);

    if (!contract.is_active) {
      return { label: 'Неактивен', variant: 'secondary' as const };
    }
    if (isBefore(endDate, today)) {
      return { label: 'Истёк', variant: 'destructive' as const };
    }
    if (isAfter(startDate, today)) {
      return { label: 'Будущий', variant: 'outline' as const };
    }
    return { label: 'Активен', variant: 'default' as const };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Companies List */}
      <div className="card-elevated p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Страховые компании</h3>
          </div>
          <Dialog open={isCompanyDialogOpen} onOpenChange={(open) => {
            setIsCompanyDialogOpen(open);
            if (!open) resetCompanyForm();
          }}>
            <DialogTrigger asChild>
              {canManage && (
                <Button size="sm" className="gap-1">
                  <Plus className="h-4 w-4" />
                  Добавить СК
                </Button>
              )}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCompany ? 'Редактирование' : 'Добавление'} страховой компании
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Название *</Label>
                  <Input
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    placeholder="Росгосстрах"
                  />
                </div>
                <div>
                  <Label>Логотип</Label>
                  <div className="mt-2 space-y-3">
                    {companyForm.logo_url ? (
                      <div className="relative inline-block">
                        <img 
                          src={companyForm.logo_url} 
                          alt="Logo preview" 
                          className="h-16 w-auto rounded border bg-white p-1"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={removeLogo}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="gap-2"
                        >
                          {isUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          Загрузить логотип
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          PNG, JPG до 2МБ
                        </span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Или укажите URL:
                    </div>
                    <Input
                      value={companyForm.logo_url}
                      onChange={(e) => setCompanyForm({ ...companyForm, logo_url: e.target.value })}
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={companyForm.is_active}
                    onCheckedChange={(checked) => setCompanyForm({ ...companyForm, is_active: checked })}
                  />
                  <Label>Активна</Label>
                </div>
                <Button onClick={handleSaveCompany} className="w-full" disabled={!companyForm.name.trim()}>
                  {editingCompany ? 'Сохранить' : 'Добавить'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {companies.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed rounded-lg">
            <Building2 className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground">Нет страховых компаний</p>
            <p className="text-xs text-muted-foreground mt-1">Добавьте первую компанию</p>
          </div>
        ) : (
          <Accordion type="multiple" className="w-full">
            {companies.map((company) => {
              const companyContracts = getCompanyContracts(company.id);
              const activeContracts = getActiveContractsForCompany(company.id);
              
              return (
                <AccordionItem key={company.id} value={company.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 flex-1 mr-4">
                      {company.logo_url ? (
                        <img 
                          src={company.logo_url} 
                          alt={company.name} 
                          className="h-8 w-8 object-contain rounded bg-white p-0.5"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 text-left">
                        <div className="font-medium">{company.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {activeContracts.length} активных договоров
                        </div>
                      </div>
                      <Badge variant={company.is_active ? 'default' : 'secondary'}>
                        {company.is_active ? 'Активна' : 'Неактивна'}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-2 space-y-4">
                      {/* Company actions */}
                      {canManage && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditCompany(company)}
                            className="gap-1"
                          >
                            <Pencil className="h-3 w-3" />
                            Редактировать
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAddContract(company.id)}
                            className="gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            Добавить договор
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCompany(company.id)}
                            className="gap-1 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                            Удалить
                          </Button>
                        </div>
                      )}

                      {/* Contracts table */}
                      {companyContracts.length === 0 ? (
                        <div className="py-6 text-center border rounded-lg bg-muted/30">
                          <FileText className="h-6 w-6 mx-auto text-muted-foreground/50 mb-2" />
                          <p className="text-sm text-muted-foreground">Нет договоров</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Номер договора</TableHead>
                              <TableHead className="text-right">Комиссия</TableHead>
                              <TableHead>Начало</TableHead>
                              <TableHead>Окончание</TableHead>
                              <TableHead>Статус</TableHead>
                              <TableHead className="w-[100px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {companyContracts.map((contract) => {
                              const status = getContractStatus(contract);
                              return (
                                <TableRow key={contract.id}>
                                  <TableCell className="font-medium">{contract.contract_number}</TableCell>
                                  <TableCell className="text-right">{contract.commission_rate}%</TableCell>
                                  <TableCell>{format(parseISO(contract.start_date), 'dd.MM.yyyy')}</TableCell>
                                  <TableCell>{format(parseISO(contract.end_date), 'dd.MM.yyyy')}</TableCell>
                                  <TableCell>
                                    <Badge variant={status.variant}>{status.label}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    {canManage && (
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => openEditContract(contract)}
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-destructive"
                                          onClick={() => handleDeleteContract(contract.id)}
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
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>

      {/* Contract Dialog */}
      <Dialog open={isContractDialogOpen} onOpenChange={(open) => {
        setIsContractDialogOpen(open);
        if (!open) resetContractForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingContract ? 'Редактирование' : 'Добавление'} договора
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Номер договора *</Label>
              <Input
                value={contractForm.contract_number}
                onChange={(e) => setContractForm({ ...contractForm, contract_number: e.target.value })}
                placeholder="ДГ-2024/001"
              />
            </div>
            <div>
              <Label>Комиссия (%)</Label>
              <Input
                type="number"
                value={contractForm.commission_rate}
                onChange={(e) => setContractForm({ ...contractForm, commission_rate: parseFloat(e.target.value) || 0 })}
                min={0}
                max={100}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Дата начала</Label>
                <Input
                  type="date"
                  value={contractForm.start_date}
                  onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Дата окончания</Label>
                <Input
                  type="date"
                  value={contractForm.end_date}
                  onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={contractForm.is_active}
                onCheckedChange={(checked) => setContractForm({ ...contractForm, is_active: checked })}
              />
              <Label>Активен</Label>
            </div>
            <Button onClick={handleSaveContract} className="w-full" disabled={!contractForm.contract_number.trim()}>
              {editingContract ? 'Сохранить' : 'Добавить'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
