import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Loader2, AlertCircle, ExternalLink, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logEventDirect } from '@/hooks/useEventLog';
import { parseClientData } from '@/lib/clientDataParser';

interface AddClientDialogProps {
  onClientCreated?: () => void;
}

const normalizePhone = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

interface DuplicateClient {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
  isCompany: boolean;
}

export function AddClientDialog({ onClientCreated }: AddClientDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [duplicateClient, setDuplicateClient] = useState<DuplicateClient | null>(null);
  const [phoneError, setPhoneError] = useState<string>('');
  
  const [smartInput, setSmartInput] = useState('');
  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    phone: '',
    email: '',
    birthDate: '',
    address: '',
    isCompany: false,
    companyName: '',
    inn: '',
    notes: '',
    passportSeries: '',
    passportNumber: '',
    passportIssueDate: '',
    passportIssuedBy: '',
    passportUnitCode: '',
  });

  const resetForm = () => {
    setSmartInput('');
    setFormData({
      lastName: '', firstName: '', middleName: '',
      phone: '', email: '', birthDate: '', address: '',
      isCompany: false, companyName: '', inn: '', notes: '',
      passportSeries: '', passportNumber: '', passportIssueDate: '',
      passportIssuedBy: '', passportUnitCode: '',
    });
    setDuplicateClient(null);
    setPhoneError('');
  };

  const handleSmartInput = async (value: string) => {
    setSmartInput(value);
    if (!value.trim()) return;

    const parsed = parseClientData(value);
    const updates: Partial<typeof formData> = {};

    if (parsed.lastName) updates.lastName = parsed.lastName;
    if (parsed.firstName) updates.firstName = parsed.firstName;
    if (parsed.middleName) updates.middleName = parsed.middleName;
    if (parsed.birthDate) updates.birthDate = parsed.birthDate;
    if (parsed.address) updates.address = parsed.address;
    if (parsed.email) updates.email = parsed.email;
    if (parsed.passportSeries) updates.passportSeries = parsed.passportSeries;
    if (parsed.passportNumber) updates.passportNumber = parsed.passportNumber;
    if (parsed.passportIssueDate) updates.passportIssueDate = parsed.passportIssueDate;
    if (parsed.passportIssuedBy) updates.passportIssuedBy = parsed.passportIssuedBy;
    if (parsed.passportUnitCode) updates.passportUnitCode = parsed.passportUnitCode;
    if (parsed.phone) {
      updates.phone = parsed.phone;
      setPhoneError('');
      setDuplicateClient(null);
      const duplicate = await checkPhoneDuplicate(parsed.phone);
      if (duplicate) {
        setDuplicateClient(duplicate);
        setPhoneError('Клиент с таким номером телефона уже зарегистрирован');
      }
    }

    setFormData(prev => ({ ...prev, ...updates }));
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.length <= 1) return `+7`;
    if (digits.length <= 4) return `+7 (${digits.slice(1)}`;
    if (digits.length <= 7) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4)}`;
    if (digits.length <= 9) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  };

  const checkPhoneDuplicate = async (phone: string): Promise<DuplicateClient | null> => {
    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone.length < 10) return null;

    setIsCheckingPhone(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, first_name, last_name, company_name, is_company, phone');
      if (error) throw error;

      const duplicate = data?.find(client => 
        normalizePhone(client.phone) === normalizedPhone
      );

      if (duplicate) {
        return {
          id: duplicate.id,
          firstName: duplicate.first_name,
          lastName: duplicate.last_name,
          companyName: duplicate.company_name,
          isCompany: duplicate.is_company,
        };
      }
      return null;
    } catch (error) {
      console.error('Error checking phone duplicate:', error);
      return null;
    } finally {
      setIsCheckingPhone(false);
    }
  };

  const handlePhoneChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData({ ...formData, phone: formatted });
    setPhoneError('');
    setDuplicateClient(null);
  };

  const handlePhoneBlur = async () => {
    if (formData.phone) {
      const duplicate = await checkPhoneDuplicate(formData.phone);
      if (duplicate) {
        setDuplicateClient(duplicate);
        setPhoneError('Клиент с таким номером телефона уже зарегистрирован');
      }
    }
  };

  const goToExistingClient = () => {
    if (duplicateClient) {
      setIsOpen(false);
      navigate('/clients');
      toast({
        title: 'Переход к клиенту',
        description: duplicateClient.isCompany 
          ? `${duplicateClient.companyName}` 
          : `${duplicateClient.lastName} ${duplicateClient.firstName}`,
      });
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: 'Ошибка', description: 'Необходимо авторизоваться', variant: 'destructive' });
      return;
    }

    if (!formData.phone) {
      toast({ title: 'Ошибка', description: 'Укажите телефон', variant: 'destructive' });
      return;
    }

    if (formData.isCompany && !formData.companyName) {
      toast({ title: 'Ошибка', description: 'Укажите название компании', variant: 'destructive' });
      return;
    }

    if (!formData.isCompany && (!formData.lastName || !formData.firstName)) {
      toast({ title: 'Ошибка', description: 'Укажите фамилию и имя', variant: 'destructive' });
      return;
    }

    const duplicate = await checkPhoneDuplicate(formData.phone);
    if (duplicate) {
      setDuplicateClient(duplicate);
      setPhoneError('Клиент с таким номером телефона уже зарегистрирован');
      toast({ title: 'Дубликат найден', description: 'Клиент с таким номером телефона уже существует', variant: 'destructive' });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('clients')
        .insert({
          first_name: formData.firstName || '',
          last_name: formData.lastName || '',
          middle_name: formData.middleName || null,
          phone: formData.phone,
          email: formData.email || null,
          birth_date: formData.birthDate || null,
          address: formData.address || null,
          is_company: formData.isCompany,
          company_name: formData.companyName || null,
          inn: formData.inn || null,
          notes: formData.notes || null,
          agent_id: user.id,
          passport_series: formData.passportSeries || null,
          passport_number: formData.passportNumber || null,
          passport_issue_date: formData.passportIssueDate || null,
          passport_issued_by: formData.passportIssuedBy || null,
          passport_unit_code: formData.passportUnitCode || null,
        });

      if (error) {
        if (error.code === '23505' && error.message.includes('phone')) {
          setPhoneError('Клиент с таким номером телефона уже зарегистрирован');
          toast({ title: 'Дубликат найден', description: 'Клиент с таким номером телефона уже существует', variant: 'destructive' });
          return;
        }
        throw error;
      }

      toast({ title: 'Клиент создан', description: 'Новый клиент успешно добавлен в базу' });
      logEventDirect({
        action: 'create',
        category: 'clients',
        entityType: 'client',
        fieldAccessed: formData.isCompany
          ? `Компания: ${formData.companyName}`
          : `${formData.lastName} ${formData.firstName} ${formData.middleName}`.trim(),
        newValue: JSON.stringify({
          phone: formData.phone,
          email: formData.email || undefined,
          birthDate: formData.birthDate || undefined,
          address: formData.address || undefined,
          passport: formData.passportSeries ? `${formData.passportSeries} ******` : undefined,
        }),
      });
      resetForm();
      setIsOpen(false);
      onClientCreated?.();
    } catch (error) {
      console.error('Error creating client:', error);
      toast({ title: 'Ошибка', description: 'Не удалось создать клиента', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const PhoneErrorBlock = () => (
    phoneError ? (
      <div className="mt-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-destructive font-medium">{phoneError}</p>
            {duplicateClient && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-2">
                  {duplicateClient.isCompany 
                    ? duplicateClient.companyName 
                    : `${duplicateClient.lastName} ${duplicateClient.firstName}`}
                </p>
                <Button variant="outline" size="sm" onClick={goToExistingClient} className="gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Перейти к клиенту
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    ) : null
  );

  const hasPassportData = formData.passportSeries || formData.passportNumber || formData.passportIssueDate || formData.passportIssuedBy || formData.passportUnitCode;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button className="btn-gradient gap-2">
          <Plus className="h-4 w-4" />
          Новый клиент
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Добавление клиента</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Smart paste input */}
          <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium text-primary">Умный ввод данных</Label>
            </div>
            <Textarea
              value={smartInput}
              onChange={(e) => handleSmartInput(e.target.value)}
              placeholder={"Вставьте текст с данными клиента (ФИО, телефон, паспорт, дата рождения, адрес) — поля заполнятся автоматически..."}
              rows={3}
              className="text-sm bg-background"
            />
            {smartInput && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Распознано: {[
                  formData.lastName && 'ФИО',
                  formData.phone && 'Телефон',
                  formData.birthDate && 'Дата рождения',
                  formData.email && 'Email',
                  formData.address && 'Адрес',
                  (formData.passportSeries || formData.passportNumber) && 'Паспорт',
                ].filter(Boolean).join(', ') || 'ничего не найдено'}
              </p>
            )}
          </div>

          {/* Client type toggle */}
          <div className="flex items-center gap-3">
            <Switch
              checked={formData.isCompany}
              onCheckedChange={(checked) => setFormData({ ...formData, isCompany: checked })}
            />
            <Label>Юридическое лицо</Label>
          </div>

          {formData.isCompany ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Название компании *</Label>
                  <Input
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder='ООО "Название"'
                  />
                </div>
                <div>
                  <Label>ИНН</Label>
                  <Input
                    value={formData.inn}
                    onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
                    placeholder="1234567890"
                  />
                </div>
                <div>
                  <Label>Телефон *</Label>
                  <Input
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    onBlur={handlePhoneBlur}
                    placeholder="+7 (___) ___-__-__"
                    className={cn(phoneError && "border-destructive focus-visible:ring-destructive")}
                  />
                  {isCheckingPhone && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Проверка...
                    </div>
                  )}
                  <PhoneErrorBlock />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Фамилия *</Label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Иванов"
                  />
                </div>
                <div>
                  <Label>Имя *</Label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="Иван"
                  />
                </div>
                <div>
                  <Label>Отчество</Label>
                  <Input
                    value={formData.middleName}
                    onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                    placeholder="Иванович"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Телефон *</Label>
                  <Input
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    onBlur={handlePhoneBlur}
                    placeholder="+7 (___) ___-__-__"
                    className={cn(phoneError && "border-destructive focus-visible:ring-destructive")}
                  />
                  {isCheckingPhone && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Проверка...
                    </div>
                  )}
                  <PhoneErrorBlock />
                </div>
                <div>
                  <Label>Дата рождения</Label>
                  <Input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          {/* Common fields */}
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@example.com"
            />
          </div>

          <div>
            <Label>Адрес</Label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="г. Москва, ул. Примера, д. 1"
            />
          </div>

          {/* Passport data section */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            <Label className="text-sm font-medium">Паспортные данные</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Серия</Label>
                <Input
                  value={formData.passportSeries}
                  onChange={(e) => setFormData({ ...formData, passportSeries: e.target.value })}
                  placeholder="4510"
                  maxLength={4}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Номер</Label>
                <Input
                  value={formData.passportNumber}
                  onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })}
                  placeholder="123456"
                  maxLength={6}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Дата выдачи</Label>
                <Input
                  type="date"
                  value={formData.passportIssueDate}
                  onChange={(e) => setFormData({ ...formData, passportIssueDate: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Код подразделения</Label>
                <Input
                  value={formData.passportUnitCode}
                  onChange={(e) => setFormData({ ...formData, passportUnitCode: e.target.value })}
                  placeholder="770-001"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Кем выдан</Label>
              <Input
                value={formData.passportIssuedBy}
                onChange={(e) => setFormData({ ...formData, passportIssuedBy: e.target.value })}
                placeholder="ОВД района..."
              />
            </div>
          </div>

          <div>
            <Label>Заметки</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Дополнительная информация о клиенте..."
              rows={2}
            />
          </div>

          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !!phoneError} 
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Сохранение...
              </>
            ) : (
              'Создать клиента'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
