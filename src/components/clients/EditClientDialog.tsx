import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Client } from '@/types/crm';
import { useQueryClient } from '@tanstack/react-query';
import { logEventDirect } from '@/hooks/useEventLog';

interface EditClientDialogProps {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const normalizePhone = (phone: string): string => {
  return phone.replace(/\D/g, '');
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

export function EditClientDialog({ client, open, onOpenChange }: EditClientDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState('');

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
    passportData: '',
    passportSeries: '',
    passportNumber: '',
    passportIssueDate: '',
    passportIssuedBy: '',
    passportUnitCode: '',
    notes: '',
  });

  // Pre-fill form when dialog opens or client changes
  useEffect(() => {
    if (open && client) {
      setFormData({
        lastName: client.lastName || '',
        firstName: client.firstName || '',
        middleName: client.middleName || '',
        phone: client.phone || '',
        email: client.email || '',
        birthDate: client.birthDate || '',
        address: client.address || '',
        isCompany: client.isCompany,
        companyName: client.companyName || '',
        inn: client.inn || '',
        passportData: client.passportData || '',
        passportSeries: client.passportSeries || '',
        passportNumber: client.passportNumber || '',
        passportIssueDate: client.passportIssueDate || '',
        passportIssuedBy: client.passportIssuedBy || '',
        passportUnitCode: client.passportUnitCode || '',
        notes: client.notes || '',
      });
      setPhoneError('');
    }
  }, [open, client]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData(prev => ({ ...prev, phone: formatted }));
    setPhoneError('');
  };

  const checkPhoneDuplicate = async (phone: string): Promise<boolean> => {
    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone.length < 10) return false;

    setIsCheckingPhone(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, phone');

      if (error) throw error;

      const duplicate = data?.find(c =>
        c.id !== client.id && normalizePhone(c.phone) === normalizedPhone
      );

      return !!duplicate;
    } catch (error) {
      console.error('Error checking phone duplicate:', error);
      return false;
    } finally {
      setIsCheckingPhone(false);
    }
  };

  const handlePhoneBlur = async () => {
    if (formData.phone) {
      const isDuplicate = await checkPhoneDuplicate(formData.phone);
      if (isDuplicate) {
        setPhoneError('Клиент с таким номером телефона уже зарегистрирован');
      }
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
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

    // Check phone uniqueness (excluding current client)
    const isDuplicate = await checkPhoneDuplicate(formData.phone);
    if (isDuplicate) {
      setPhoneError('Клиент с таким номером телефона уже зарегистрирован');
      toast({
        title: 'Дубликат найден',
        description: 'Клиент с таким номером телефона уже существует',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('clients')
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          middle_name: formData.middleName || null,
          phone: formData.phone,
          email: formData.email || null,
          birth_date: formData.birthDate || null,
          address: formData.address || null,
          is_company: formData.isCompany,
          company_name: formData.companyName || null,
          inn: formData.inn || null,
          passport_data: formData.passportData || null,
          passport_series: formData.passportSeries || null,
          passport_number: formData.passportNumber || null,
          passport_issue_date: formData.passportIssueDate || null,
          passport_issued_by: formData.passportIssuedBy || null,
          passport_unit_code: formData.passportUnitCode || null,
          notes: formData.notes || null,
        })
        .eq('id', client.id);

      if (error) {
        if (error.code === '23505' && error.message.includes('phone')) {
          setPhoneError('Клиент с таким номером телефона уже зарегистрирован');
          toast({
            title: 'Дубликат найден',
            description: 'Клиент с таким номером телефона уже существует',
            variant: 'destructive',
          });
          return;
        }
        throw error;
      }

      toast({ title: 'Успешно', description: 'Данные клиента обновлены' });

      // Log changed fields
      const fieldMap: Record<string, [string, string]> = {
        lastName: ['Фамилия', client.lastName],
        firstName: ['Имя', client.firstName],
        phone: ['Телефон', client.phone],
        email: ['Email', client.email || ''],
        address: ['Адрес', client.address || ''],
      };
      for (const [key, [label, oldVal]] of Object.entries(fieldMap)) {
        const newVal = formData[key as keyof typeof formData];
        if (String(newVal) !== String(oldVal)) {
          logEventDirect({
            action: 'update',
            category: 'clients',
            entityType: 'client',
            entityId: client.id,
            clientId: client.id,
            fieldAccessed: label,
            oldValue: String(oldVal),
            newValue: String(newVal),
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-raw'] });
      queryClient.invalidateQueries({ queryKey: ['client', client.id] });
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating client:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить данные клиента',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Редактирование клиента</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Client type toggle */}
          <div className="flex items-center gap-3">
            <Switch
              checked={formData.isCompany}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isCompany: checked }))}
            />
            <Label>Юридическое лицо</Label>
          </div>

          {formData.isCompany ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Название компании *</Label>
                <Input
                  value={formData.companyName}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                  placeholder='ООО "Название"'
                />
              </div>
              <div>
                <Label>ИНН</Label>
                <Input
                  value={formData.inn}
                  onChange={(e) => setFormData(prev => ({ ...prev, inn: e.target.value }))}
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
                  className={cn(phoneError && 'border-destructive focus-visible:ring-destructive')}
                />
                {isCheckingPhone && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Проверка...
                  </div>
                )}
                {phoneError && (
                  <div className="mt-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <p className="text-sm text-destructive font-medium">{phoneError}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Фамилия *</Label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Иванов"
                  />
                </div>
                <div>
                  <Label>Имя *</Label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="Иван"
                  />
                </div>
                <div>
                  <Label>Отчество</Label>
                  <Input
                    value={formData.middleName}
                    onChange={(e) => setFormData(prev => ({ ...prev, middleName: e.target.value }))}
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
                    className={cn(phoneError && 'border-destructive focus-visible:ring-destructive')}
                  />
                  {isCheckingPhone && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Проверка...
                    </div>
                  )}
                  {phoneError && (
                    <div className="mt-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        <p className="text-sm text-destructive font-medium">{phoneError}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Label>Дата рождения</Label>
                  <Input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, birthDate: e.target.value }))}
                  />
                </div>
              </div>
            </>
          )}

          {/* Passport data */}
          {!formData.isCompany && (
            <div className="rounded-lg border border-border p-3 space-y-3">
              <Label className="text-sm font-medium">Паспортные данные</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Серия</Label>
                  <Input
                    value={formData.passportSeries}
                    onChange={(e) => setFormData(prev => ({ ...prev, passportSeries: e.target.value }))}
                    placeholder="4510"
                    maxLength={4}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Номер</Label>
                  <Input
                    value={formData.passportNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, passportNumber: e.target.value }))}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, passportIssueDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Код подразделения</Label>
                  <Input
                    value={formData.passportUnitCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, passportUnitCode: e.target.value }))}
                    placeholder="770-001"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Кем выдан</Label>
                <Input
                  value={formData.passportIssuedBy}
                  onChange={(e) => setFormData(prev => ({ ...prev, passportIssuedBy: e.target.value }))}
                  placeholder="ОВД района..."
                />
              </div>
            </div>
          )}

          {/* Common fields */}
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="email@example.com"
            />
          </div>

          <div>
            <Label>Адрес</Label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="г. Москва, ул. Примера, д. 1"
            />
          </div>

          <div>
            <Label>Заметки</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
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
              'Сохранить изменения'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
