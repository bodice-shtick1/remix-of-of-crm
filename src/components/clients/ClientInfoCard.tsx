import { useState, useEffect } from 'react';
import { Client, Policy } from '@/types/crm';
import { 
  Phone, Mail, MapPin, Calendar, Building2, 
  Edit2, MessageCircle, CreditCard, TrendingUp, FileText, Eye, ShieldCheck, ScrollText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientDebtBadge } from './ClientDebtBadge';
import { EditClientDialog } from './EditClientDialog';
import { useContactMasking } from '@/hooks/useContactMasking';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getClientDisplayName, getClientInitials } from '@/lib/mappers';
import { logEventStrictOrBlock } from '@/hooks/useEventLog';
import { supabase } from '@/integrations/supabase/client';
import { useEntityTab } from '@/hooks/useEntityTab';
import { usePermissions } from '@/hooks/usePermissions';

interface ClientInfoCardProps {
  client: Client;
  policies: Policy[];
}

export function ClientInfoCard({ client, policies }: ClientInfoCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const [emailRevealed, setEmailRevealed] = useState(false);
  const [passportRevealed, setPassportRevealed] = useState(false);
  const { shouldMask, maskPhone, maskEmail, checkCanReveal, checkRateLimit } = useContactMasking();
  const { toast } = useToast();
  const { openDkpTab } = useEntityTab();
  const { can } = usePermissions();

  const displayName = getClientDisplayName(client);
  const initials = getClientInitials(client);

  const activePolicies = policies.filter(p => p.status === 'active' || p.status === 'expiring_soon');
  const totalPremium = policies.reduce((sum, p) => sum + p.premiumAmount, 0);
  const totalCommission = policies.reduce((sum, p) => sum + p.commissionAmount, 0);

  const handleReveal = async (field: 'phone' | 'email' | 'passport') => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const { data: profile } = currentUser ? await supabase.from('profiles').select('full_name').eq('user_id', currentUser.id).maybeSingle() : { data: null };
    const staffName = profile?.full_name || 'Сотрудник';

    // Check rate limit first
    const rateResult = await checkRateLimit();
    if (!rateResult.allowed) {
      await logEventStrictOrBlock({
        action: 'rate_limit_exceeded',
        category: 'access',
        entityType: 'client',
        entityId: client.id,
        clientId: client.id,
        fieldAccessed: field,
        newValue: `Сотрудник ${staffName} превысил лимит просмотров контактов (${rateResult.limit}/час)`,
        details: { section: 'Карточка клиента', client_name: displayName, reason: 'rate_limit', current: rateResult.current, limit: rateResult.limit },
      });
      toast({
        title: 'Лимит просмотров исчерпан',
        description: `Максимум ${rateResult.limit} в час. Доступ будет разблокирован через ${rateResult.minutesLeft} мин.`,
        variant: 'destructive',
      });
      return;
    }

    // Check prolongation rule
    const canReveal = await checkCanReveal(client.id);
    if (!canReveal) {
      await logEventStrictOrBlock({
        action: 'access_denied',
        category: 'access',
        entityType: 'client',
        entityId: client.id,
        clientId: client.id,
        fieldAccessed: field,
        newValue: `Попытка доступа отклонена: до пролонгации более 30 дней (Клиент: ${displayName})`,
        details: { section: 'Карточка клиента', client_name: displayName, reason: 'prolongation_30d' },
      });
      toast({
        title: 'Доступ к контактам закрыт',
        description: 'Просмотр разрешен только в период пролонгации (за 30 дней до истечения полиса).',
        variant: 'destructive',
      });
      return;
    }

    const fieldLabel = field === 'phone' ? 'номер телефона' : field === 'email' ? 'email' : 'паспортные данные';
    const action = field === 'phone' ? 'view_contact_phone' : field === 'email' ? 'view_contact_email' : 'view_contact_passport';
    try {
      const logged = await logEventStrictOrBlock({
        action,
        category: 'access',
        entityType: 'client',
        entityId: client.id,
        clientId: client.id,
        fieldAccessed: field,
        newValue: `Сотрудник ${staffName} раскрыл ${fieldLabel} клиента ${displayName}`,
        details: { section: 'Карточка клиента', client_name: displayName },
      });
      if (!logged) {
        toast({ title: 'Ошибка безопасности', description: 'Не удалось записать действие в журнал. Просмотр заблокирован.', variant: 'destructive' });
        return;
      }
    } catch (logError) {
      console.error('Failed to log reveal:', logError);
      toast({ title: 'Ошибка безопасности', description: 'Не удалось записать действие в журнал. Просмотр заблокирован.', variant: 'destructive' });
      return;
    }

    if (field === 'phone') {
      setPhoneRevealed(true);
      setTimeout(() => setPhoneRevealed(false), 10000);
    } else if (field === 'email') {
      setEmailRevealed(true);
      setTimeout(() => setEmailRevealed(false), 10000);
    } else {
      setPassportRevealed(true);
      setTimeout(() => setPassportRevealed(false), 10000);
    }
  };

  const displayPhone = shouldMask && !phoneRevealed ? maskPhone(client.phone) : client.phone;
  const displayEmail = client.email 
    ? (shouldMask && !emailRevealed ? maskEmail(client.email) : client.email) 
    : null;

  return (
    <div className="space-y-4">
      {/* Profile Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 mb-4">
            <div className={cn('avatar-initials h-14 w-14 text-lg shrink-0', client.isCompany && 'bg-accent')}>
              {client.isCompany ? <Building2 className="h-6 w-6" /> : initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-semibold text-foreground truncate">{displayName}</h2>
                <ClientDebtBadge clientId={client.id} />
              </div>
              <p className="text-xs text-muted-foreground">
                {client.createdAt && !isNaN(new Date(client.createdAt).getTime())
                  ? `Клиент с ${new Date(client.createdAt).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`
                  : 'Клиент'}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {can('client_comm_actions') && (
              <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" asChild>
                <a href={shouldMask && !phoneRevealed ? '#' : `tel:${client.phone}`}>
                  <Phone className="h-3 w-3" />
                  Звонок
                </a>
              </Button>
            )}
            {can('client_comm_actions') && (
              <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs">
                <MessageCircle className="h-3 w-3" />
                Написать
              </Button>
            )}
            {can('client_info_edit') && (
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditOpen(true)}>
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          {/* DKP Button */}
          {!client.isCompany && can('client_dkp_generate') && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 gap-1.5 text-xs"
              onClick={() => openDkpTab({ id: client.id, firstName: client.firstName, lastName: client.lastName, middleName: client.middleName })}
            >
              <ScrollText className="h-3.5 w-3.5" />
              Сформировать ДКП
            </Button>
          )}

          {can('client_info_edit') && (
            <EditClientDialog client={client} open={editOpen} onOpenChange={setEditOpen} />
          )}
        </CardContent>
      </Card>

      {/* Contact Info */}
      {can('client_contacts_view') && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Контакты</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded bg-secondary shrink-0">
                <Phone className="h-3.5 w-3.5 text-secondary-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{displayPhone}</p>
                <p className="text-xs text-muted-foreground">Телефон</p>
              </div>
              {shouldMask && !phoneRevealed && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleReveal('phone')}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            
            {client.email && (
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded bg-secondary shrink-0">
                  <Mail className="h-3.5 w-3.5 text-secondary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{displayEmail}</p>
                  <p className="text-xs text-muted-foreground">Email</p>
                </div>
                {shouldMask && !emailRevealed && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleReveal('email')}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}

            {client.address && (
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded bg-secondary shrink-0">
                  <MapPin className="h-3.5 w-3.5 text-secondary-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{client.address}</p>
                  <p className="text-xs text-muted-foreground">Адрес</p>
                </div>
              </div>
            )}

            {client.birthDate && !client.isCompany && (
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded bg-secondary shrink-0">
                  <Calendar className="h-3.5 w-3.5 text-secondary-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {new Date(client.birthDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-muted-foreground">День рождения</p>
                </div>
              </div>
            )}

            {client.isCompany && client.inn && (
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded bg-secondary shrink-0">
                  <FileText className="h-3.5 w-3.5 text-secondary-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{client.inn}</p>
                  <p className="text-xs text-muted-foreground">ИНН</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Passport Data - always show for individuals */}
      {!client.isCompany && can('client_passport_view') && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Паспортные данные</CardTitle>
              {shouldMask && !passportRevealed && (client.passportSeries || client.passportNumber) && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleReveal('passport')}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {(client.passportSeries || client.passportNumber) ? (
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded bg-secondary shrink-0">
                  <ShieldCheck className="h-3.5 w-3.5 text-secondary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground font-mono">
                    {shouldMask && !passportRevealed
                      ? `${client.passportSeries || '****'} ******`
                      : `${client.passportSeries || ''} ${client.passportNumber || ''}`.trim()}
                  </p>
                  <p className="text-xs text-muted-foreground">Серия и номер</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded bg-secondary shrink-0">
                  <ShieldCheck className="h-3.5 w-3.5 text-secondary-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground italic">Не заполнено</p>
                  <p className="text-xs text-muted-foreground">Серия и номер</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded bg-secondary shrink-0">
                <Calendar className="h-3.5 w-3.5 text-secondary-foreground" />
              </div>
              <div className="min-w-0">
                {client.passportIssueDate ? (
                  <p className="text-sm font-medium text-foreground">
                    {shouldMask && !passportRevealed
                      ? '**.**.****'
                      : new Date(client.passportIssueDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Не заполнено</p>
                )}
                <p className="text-xs text-muted-foreground">Дата выдачи</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded bg-secondary shrink-0">
                <FileText className="h-3.5 w-3.5 text-secondary-foreground" />
              </div>
              <div className="min-w-0">
                {client.passportUnitCode ? (
                  <p className="text-sm font-medium text-foreground font-mono">
                    {shouldMask && !passportRevealed ? '***-***' : client.passportUnitCode}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Не заполнено</p>
                )}
                <p className="text-xs text-muted-foreground">Код подразделения</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded bg-secondary shrink-0">
                <Building2 className="h-3.5 w-3.5 text-secondary-foreground" />
              </div>
              <div className="min-w-0">
                {client.passportIssuedBy ? (
                  <p className="text-sm font-medium text-foreground">
                    {shouldMask && !passportRevealed ? '***' : client.passportIssuedBy}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Не заполнено</p>
                )}
                <p className="text-xs text-muted-foreground">Кем выдан</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">Статистика</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <div className="flex items-center justify-between p-2 rounded bg-primary/5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Полисов</span>
            </div>
            <span className="text-sm font-semibold text-primary">{activePolicies.length}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-foreground" />
              <span className="text-xs text-muted-foreground">Премии</span>
            </div>
            <span className="text-sm font-semibold text-foreground">{totalPremium.toLocaleString('ru-RU')} ₽</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-success/5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              <span className="text-xs text-muted-foreground">Комиссия</span>
            </div>
            <span className="text-sm font-semibold text-success">{totalCommission.toLocaleString('ru-RU')} ₽</span>
          </div>
        </CardContent>
      </Card>

      {client.notes && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Примечание</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
