import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  User, Building2, Bell, Shield, 
  MessageCircle, Phone, Save, Calculator,
  Wrench, Upload, FileSpreadsheet, Download, Trash2,
  ChevronsUpDown, Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { ImportSalesHistoryDialog } from '@/components/settings/ImportSalesHistoryDialog';
import { CleanupDatabaseDialog } from '@/components/settings/CleanupDatabaseDialog';
import { CleanupEventLogDialog } from '@/components/settings/CleanupEventLogDialog';
import { AuditLogConfigPanel } from '@/components/settings/AuditLogConfigPanel';
import { downloadSalesTemplate } from '@/lib/salesTemplateGenerator';
import { Accordion } from '@/components/ui/accordion';
import { EmailAccountSettings } from '@/components/email/EmailAccountSettings';
import { Skeleton } from '@/components/ui/skeleton';
import { WhatsAppIcon, TelegramIcon, MaxIcon } from '@/components/icons/MessengerIcons';
import { useMessengerSettings } from '@/hooks/useMessengerSettings';
import { MessengerChannelCard } from '@/components/notifications/MessengerChannelCard';
import { Switch } from '@/components/ui/switch';
import { useEmailSoundEnabled as useEmailSoundEnabledSettings, playNotificationSound } from '@/hooks/useEmailSoundNotification';
import { Volume2, Palette, Check } from 'lucide-react';
import { useTheme, THEMES, type ThemeId } from '@/hooks/useTheme';

interface ServiceCatalog {
  id: string;
  name: string;
  default_price: number;
}

const settingsSections = [
  { id: 'profile', label: 'Профиль', icon: User, permissionKey: 'settings_profile_view' },
  { id: 'sales', label: 'Продажи', icon: Calculator, permissionKey: 'settings_sales_view' },
  { id: 'company', label: 'Компания', icon: Building2, permissionKey: 'settings_company_view' },
  { id: 'notifications', label: 'Уведомления', icon: Bell, permissionKey: 'settings_notifications_view' },
  { id: 'integrations', label: 'Каналы связи', icon: MessageCircle, permissionKey: 'settings_channels_view' },
  { id: 'email', label: 'Почтовые аккаунты', icon: Mail, permissionKey: 'email_config_manage' },
  { id: 'security', label: 'Безопасность', icon: Shield, permissionKey: 'settings_security_view' },
  { id: 'audit', label: 'Логирование', icon: Shield, adminOnly: true },
  { id: 'service', label: 'Сервис', icon: Wrench, adminOnly: true },
];
function LinkTelegramSection() {
  const { user } = useAuth();
  const { toast: toastFn } = useToast();
  const [chatId, setChatId] = useState('');
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('telegram_chat_id').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.telegram_chat_id) {
          setCurrentChatId(data.telegram_chat_id);
          setChatId(data.telegram_chat_id);
        }
      });
  }, [user]);

  const handleSave = async () => {
    if (!user || !chatId.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('profiles')
      .update({ telegram_chat_id: chatId.trim() } as any)
      .eq('user_id', user.id);
    setSaving(false);
    if (error) {
      toastFn({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    } else {
      setCurrentChatId(chatId.trim());
      toastFn({ title: 'Telegram привязан' });
    }
  };

  const handleUnlink = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from('profiles')
      .update({ telegram_chat_id: null } as any)
      .eq('user_id', user.id);
    setSaving(false);
    setCurrentChatId(null);
    setChatId('');
    toastFn({ title: 'Telegram отвязан' });
  };

  return (
    <div className="card-elevated p-6">
      <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        Привязка Telegram
      </h2>
      <div className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Как привязать:</p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Откройте Telegram и найдите бота компании</li>
            <li>Нажмите <strong>/start</strong> для получения вашего Chat ID</li>
            <li>Скопируйте Chat ID и вставьте его ниже</li>
          </ol>
          <p className="text-xs">Когда вам придёт сообщение во внутреннем чате, а вы не в сети — бот отправит уведомление в Telegram.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Label htmlFor="tgChatId" className="text-xs">Telegram Chat ID</Label>
            <Input
              id="tgChatId"
              value={chatId}
              onChange={e => setChatId(e.target.value)}
              placeholder="Например: 123456789"
              className="mt-1"
            />
          </div>
          <div className="flex gap-2 pt-5">
            <Button size="sm" onClick={handleSave} disabled={saving || !chatId.trim()}>
              <Save className="h-3.5 w-3.5 mr-1" />Сохранить
            </Button>
            {currentChatId && (
              <Button size="sm" variant="outline" onClick={handleUnlink} disabled={saving}>
                Отвязать
              </Button>
            )}
          </div>
        </div>
        {currentChatId && (
          <p className="text-xs text-success">✓ Telegram привязан (ID: {currentChatId})</p>
        )}
      </div>
    </div>
  );
}

// Theme preview mini-cards
const THEME_PREVIEWS: Record<ThemeId, { bg: string; sidebar: string; primary: string; card: string; text: string }> = {
  slate: { bg: 'hsl(210 40% 96%)', sidebar: 'hsl(215 25% 17%)', primary: 'hsl(210 85% 45%)', card: 'hsl(0 0% 100%)', text: 'hsl(215 25% 17%)' },
  light: { bg: 'hsl(210 40% 98%)', sidebar: 'hsl(0 0% 100%)', primary: 'hsl(210 85% 55%)', card: 'hsl(0 0% 100%)', text: 'hsl(210 20% 20%)' },
  night: { bg: 'hsl(0 0% 0%)', sidebar: 'hsl(0 0% 5%)', primary: 'hsl(199 89% 48%)', card: 'hsl(0 0% 5%)', text: 'hsl(0 0% 90%)' },
  enterprise: { bg: 'hsl(0 0% 95%)', sidebar: 'hsl(0 0% 100%)', primary: 'hsl(45 100% 50%)', card: 'hsl(0 0% 100%)', text: 'hsl(0 0% 10%)' },
};

function ThemePreviewCard({ themeId, isActive, onClick }: { themeId: ThemeId; isActive: boolean; onClick: () => void }) {
  const meta = THEMES.find(t => t.id === themeId)!;
  const preview = THEME_PREVIEWS[themeId];
  const isEnterprise = themeId === 'enterprise';

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative group flex flex-col rounded-xl border-2 overflow-hidden transition-all duration-200 hover:scale-[1.02]',
        isActive
          ? 'border-primary ring-2 ring-primary/20 shadow-lg'
          : 'border-border hover:border-primary/40'
      )}
    >
      {/* Mini preview */}
      <div className="relative w-full h-24 flex" style={{ backgroundColor: preview.bg }}>
        {/* Sidebar mini */}
        <div className="w-8 h-full flex flex-col items-center pt-2 gap-1" style={{ backgroundColor: preview.sidebar }}>
          <div className="w-4 h-4 rounded" style={{ backgroundColor: preview.primary, borderRadius: isEnterprise ? 0 : undefined }} />
          <div className="w-4 h-1 rounded-sm opacity-40" style={{ backgroundColor: preview.text }} />
          <div className="w-4 h-1 rounded-sm opacity-30" style={{ backgroundColor: preview.text }} />
          <div className="w-4 h-1 rounded-sm opacity-20" style={{ backgroundColor: preview.text }} />
        </div>
        {/* Content area */}
        <div className="flex-1 p-2 flex flex-col gap-1.5">
          <div className="h-2 w-12 rounded-sm" style={{ backgroundColor: preview.text, opacity: 0.6, borderRadius: isEnterprise ? 0 : undefined }} />
          <div className="flex gap-1.5 flex-1">
            <div className="flex-1 rounded" style={{ backgroundColor: preview.card, borderRadius: isEnterprise ? 0 : undefined, border: `1px solid ${preview.text}20` }}>
              <div className="h-1.5 w-8 m-1.5 rounded-sm" style={{ backgroundColor: preview.primary, opacity: 0.7, borderRadius: isEnterprise ? 0 : undefined }} />
            </div>
            <div className="flex-1 rounded" style={{ backgroundColor: preview.card, borderRadius: isEnterprise ? 0 : undefined, border: `1px solid ${preview.text}20` }}>
              <div className="h-1.5 w-6 m-1.5 rounded-sm" style={{ backgroundColor: preview.text, opacity: 0.3, borderRadius: isEnterprise ? 0 : undefined }} />
            </div>
          </div>
        </div>
      </div>
      {/* Label */}
      <div className="px-3 py-2 text-left bg-card border-t">
        <p className="text-xs font-medium text-foreground">{meta.label}</p>
        <p className="text-[10px] text-muted-foreground">{meta.description}</p>
      </div>
      {/* Active check */}
      {isActive && (
        <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center shadow">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
    </button>
  );
}

function ThemeAppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="card-elevated p-6">
      <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Palette className="h-5 w-5 text-primary" />
        Оформление интерфейса
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Выберите тему оформления. Настройка сохраняется в вашем профиле.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {THEMES.map(t => (
          <ThemePreviewCard
            key={t.id}
            themeId={t.id}
            isActive={theme === t.id}
            onClick={() => setTheme(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ProfileSection() {
  const { user } = useAuth();
  const { toast: toastFn } = useToast();
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email || '');
    supabase.from('profiles').select('full_name, last_name, first_name, middle_name').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          // If separate fields exist, use them; otherwise parse full_name
          if (data.last_name || data.first_name) {
            setLastName(data.last_name || '');
            setFirstName(data.first_name || '');
            setMiddleName(data.middle_name || '');
          } else if (data.full_name) {
            const parts = data.full_name.trim().split(/\s+/);
            setLastName(parts[0] || '');
            setFirstName(parts[1] || '');
            setMiddleName(parts[2] || '');
          }
        }
        setLoading(false);
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const fullName = [lastName, firstName, middleName].filter(Boolean).join(' ') || null;
    const { error } = await supabase.from('profiles')
      .upsert({
        user_id: user.id,
        last_name: lastName.trim() || null,
        first_name: firstName.trim() || null,
        middle_name: middleName.trim() || null,
        full_name: fullName,
        custom_role_name: null,
      } as any, { onConflict: 'user_id' });
    setSaving(false);
    if (error) {
      toastFn({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    } else {
      toastFn({ title: 'Профиль сохранён' });
    }
  };

  if (loading) {
    return <div className="card-elevated p-6"><Skeleton className="h-40 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="card-elevated p-6">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Профиль брокера
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="lastName">Фамилия</Label>
            <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Иванов" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="firstName">Имя</Label>
            <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Иван" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="middleName">Отчество</Label>
            <Input id="middleName" value={middleName} onChange={e => setMiddleName(e.target.value)} placeholder="Иванович" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profileEmail">Email</Label>
            <Input id="profileEmail" type="email" value={email} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">Email нельзя изменить</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="h-3.5 w-3.5 mr-1" />Сохранить
          </Button>
        </div>
      </div>
      <ThemeAppearanceSection />
      <LinkTelegramSection />
    </div>
  );
}

export default function Settings() {
  const { user, userRole } = useAuth();
  const { can } = usePermissions();
  const isAdmin = userRole === 'admin';
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Compute visible sections
  const visibleSections = useMemo(() => {
    return settingsSections.filter(s => {
      if (s.adminOnly) return isAdmin;
      if (s.permissionKey) return can(s.permissionKey);
      return true;
    });
  }, [isAdmin, can]);

  const [activeSection, setActiveSection] = useState(() => {
    const fromUrl = searchParams.get('section');
    if (fromUrl && visibleSections.some(s => s.id === fromUrl)) return fromUrl;
    return visibleSections[0]?.id || 'profile';
  });

  // Sync section from URL params (e.g. navigating from Notifications)
  useEffect(() => {
    const section = searchParams.get('section');
    if (section && visibleSections.some(s => s.id === section)) {
      setActiveSection(section);
    }
  }, [searchParams, visibleSections]);

  // Redirect to dashboard if no tabs are allowed
  useEffect(() => {
    if (visibleSections.length === 0) {
      navigate('/', { replace: true });
    }
  }, [visibleSections, navigate]);
  const [services, setServices] = useState<ServiceCatalog[]>([]);
  const [preferredRoundingServiceId, setPreferredRoundingServiceId] = useState<string>('');
  const [lastOsagoSeries, setLastOsagoSeries] = useState<string>('');
  const [roundingStep, setRoundingStep] = useState<number>(100);
  const [isSaving, setIsSaving] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);


  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      // Load services
      const { data: servicesData } = await supabase
        .from('services_catalog')
        .select('id, name, default_price')
        .eq('is_active', true)
        .order('name');
      
      if (servicesData) {
        setServices(servicesData);
      }

      // Load agent settings
      const { data: settingsData } = await supabase
        .from('agent_settings')
        .select('preferred_rounding_service_id, last_osago_series, rounding_step')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (settingsData) {
        setPreferredRoundingServiceId(settingsData.preferred_rounding_service_id || '');
        setLastOsagoSeries(settingsData.last_osago_series || '');
        setRoundingStep(settingsData.rounding_step || 100);
      }
    };

    loadData();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('agent_settings')
        .upsert({
          user_id: user.id,
          preferred_rounding_service_id: preferredRoundingServiceId || null,
          last_osago_series: lastOsagoSeries || null,
          rounding_step: roundingStep,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      toast({
        title: 'Настройки сохранены',
        description: 'Ваши настройки успешно обновлены',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить настройки',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 h-full overflow-y-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Настройки</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Управление профилем и настройками системы
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <nav className="space-y-1">
              {visibleSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                    activeSection === section.id 
                      ? 'bg-primary/10 text-primary font-medium' 
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <section.icon className="h-5 w-5" />
                  {section.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Profile Section */}
            {activeSection === 'profile' && (
              <ProfileSection />
            )}

            {/* Sales Settings Section */}
            {activeSection === 'sales' && (
              <div className="card-elevated p-6">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Настройки продаж
                </h2>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="roundingService">Приоритетная услуга для округления</Label>
                    <Select 
                      value={preferredRoundingServiceId || 'auto'} 
                      onValueChange={(value) => setPreferredRoundingServiceId(value === 'auto' ? '' : value)}
                    >
                      <SelectTrigger id="roundingService">
                        <SelectValue placeholder="Выберите услугу..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Автоматический выбор</SelectItem>
                        {services.map(service => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name} ({service.default_price} ₽)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      При включении округления эта услуга будет использоваться в первую очередь
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="roundingStep">Шаг округления</Label>
                    <Select 
                      value={roundingStep.toString()} 
                      onValueChange={(value) => setRoundingStep(parseInt(value))}
                    >
                      <SelectTrigger id="roundingStep" className="w-40">
                        <SelectValue placeholder="Выберите шаг..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="50">50 ₽</SelectItem>
                        <SelectItem value="100">100 ₽</SelectItem>
                        <SelectItem value="500">500 ₽</SelectItem>
                        <SelectItem value="1000">1 000 ₽</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Сумма округляется до ближайшего числа, кратного этому значению
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastOsagoSeries">Последняя серия ОСАГО</Label>
                    <Input 
                      id="lastOsagoSeries" 
                      value={lastOsagoSeries}
                      onChange={(e) => setLastOsagoSeries(e.target.value)}
                      placeholder="XXX"
                      maxLength={3}
                      className="w-32 uppercase"
                    />
                    <p className="text-xs text-muted-foreground">
                      Автоматически подставляется при добавлении нового полиса ОСАГО
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Company Section */}
            {activeSection === 'company' && (
              <div className="card-elevated p-6">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Данные компании
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Название компании</Label>
                    <Input id="companyName" placeholder="ООО «Страховой брокер»" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyInn">ИНН</Label>
                    <Input id="companyInn" placeholder="1234567890" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="companyAddress">Юридический адрес</Label>
                    <Input id="companyAddress" placeholder="г. Москва, ул. Примерная, д. 1" />
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Section */}
            {activeSection === 'notifications' && (
              <NotificationSettingsSection />
            )}

            {/* Integrations / Channel Config Section */}
            {activeSection === 'integrations' && (
              <ChannelConfigSection />
            )}

            {/* Security Section */}
            {activeSection === 'security' && (
              <div className="card-elevated p-6">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Безопасность
                </h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Текущий пароль</Label>
                    <Input id="currentPassword" type="password" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">Новый пароль</Label>
                      <Input id="newPassword" type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
                      <Input id="confirmPassword" type="password" />
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Email Accounts Section */}
            {activeSection === 'email' && (
              <EmailAccountSettings />
            )}

            {/* Audit Config Section (Admin only) */}
            {activeSection === 'audit' && isAdmin && (
              <AuditLogConfigPanel />
            )}

            {/* Service Section (Admin only) */}
            {activeSection === 'service' && isAdmin && (
              <div className="space-y-6">
                <div className="card-elevated p-6">
                  <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-primary" />
                    Сервис
                  </h2>
                  <div className="space-y-4">
                    {/* Template download */}
                    <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Download className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-foreground">Шаблон: История продаж и Касса</h3>
                          <p className="text-xs text-muted-foreground">
                            Скачайте эталонный Excel-файл с правильными колонками для импорта
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={downloadSalesTemplate}>
                        <FileSpreadsheet className="h-4 w-4" />
                        Скачать
                      </Button>
                    </div>

                    {/* Import sales history */}
                    <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <FileSpreadsheet className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-foreground">Импорт истории продаж</h3>
                          <p className="text-xs text-muted-foreground">
                            Перенос данных из сторонних CRM или Excel-таблиц. Создаёт клиентов, полисы, продажи и долги.
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={() => setImportDialogOpen(true)}>
                        <Upload className="h-4 w-4" />
                        Импорт
                      </Button>
                    </div>

                    {/* Cleanup event log */}
                    <CleanupEventLogDialog />

                    {/* Cleanup tool */}
                    <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-destructive/10">
                          <Trash2 className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-foreground">Удалить все тестовые данные</h3>
                          <p className="text-xs text-muted-foreground">
                            Полная очистка клиентов, продаж, полисов и реестра ТС для начала с чистого листа
                          </p>
                        </div>
                      </div>
                      <Button variant="destructive" size="sm" className="gap-1 shrink-0" onClick={() => setCleanupDialogOpen(true)}>
                        <Trash2 className="h-4 w-4" />
                        Очистить
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end">
              <Button 
                className="btn-gradient gap-2" 
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
              </Button>
            </div>
          </div>
        </div>

        <ImportSalesHistoryDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
        <CleanupDatabaseDialog open={cleanupDialogOpen} onOpenChange={setCleanupDialogOpen} />
    </div>
  );
}

function NotificationSettingsSection() {
  const { get: isSoundEnabled, set: setSoundEnabled } = useEmailSoundEnabledSettings();
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const testAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleTestSound = () => {
    playNotificationSound(testAudioRef);
  };

  return (
    <div className="card-elevated p-6">
      <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" />
        Уведомления
      </h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div>
            <h3 className="text-sm font-medium text-foreground">Звуковые уведомления</h3>
            <p className="text-xs text-muted-foreground">Воспроизводить звук при получении нового письма</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleTestSound}>
              <Volume2 className="h-3.5 w-3.5" />
              Проверить звук
            </Button>
            <Switch
              checked={soundOn}
              onCheckedChange={(v) => { setSoundOn(v); setSoundEnabled(v); }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div>
            <h3 className="text-sm font-medium text-foreground">Истекающие полисы</h3>
            <p className="text-xs text-muted-foreground">Напоминания о полисах, срок которых истекает</p>
          </div>
          <Input type="number" defaultValue={30} className="w-20" min={1} max={90} />
          <span className="text-sm text-muted-foreground">дней</span>
        </div>
        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div>
            <h3 className="text-sm font-medium text-foreground">Email-уведомления</h3>
            <p className="text-xs text-muted-foreground">Отправлять уведомления на email</p>
          </div>
          <Button variant="outline" size="sm">Включено</Button>
        </div>
        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div>
            <h3 className="text-sm font-medium text-foreground">Push-уведомления</h3>
            <p className="text-xs text-muted-foreground">Уведомления в браузере</p>
          </div>
          <Button variant="outline" size="sm">Отключено</Button>
        </div>
      </div>
    </div>
  );
}

const ALL_CHANNELS = ['whatsapp_web', 'whatsapp', 'telegram', 'max', 'max_web'] as const;

function ChannelConfigSection() {
  const { isLoading, getChannelSetting } = useMessengerSettings();
  const [openItems, setOpenItems] = useState<string[]>([]);

  const allExpanded = openItems.length === ALL_CHANNELS.length;
  const toggleAll = () => setOpenItems(allExpanded ? [] : [...ALL_CHANNELS]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          Каналы связи
        </h2>
        <Button variant="outline" size="sm" onClick={toggleAll} className="gap-2">
          <ChevronsUpDown className="h-4 w-4" />
          {allExpanded ? 'Свернуть все' : 'Развернуть все'}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Подключите каналы для автоматических рассылок уведомлений клиентам
      </p>

      <Accordion type="multiple" value={openItems} onValueChange={setOpenItems} className="space-y-4">
        <MessengerChannelCard
          channel="whatsapp_web"
          title="WhatsApp Web (Личный аккаунт)"
          description="Подключение через QR-код — как WhatsApp Web на компьютере"
          icon={<WhatsAppIcon size={24} />}
          accentClass="bg-green-50/50"
          existing={getChannelSetting('whatsapp_web')}
          onCollapse={() => setOpenItems(prev => prev.filter(i => i !== 'whatsapp_web'))}
        />
        <MessengerChannelCard
          channel="whatsapp"
          title="WhatsApp"
          description="Рассылка через WhatsApp Web или Business API"
          icon={<WhatsAppIcon size={24} />}
          accentClass="bg-green-50/50"
          existing={getChannelSetting('whatsapp')}
        />
        <MessengerChannelCard
          channel="telegram"
          title="Telegram"
          description="Уведомления через Telegram-бота"
          icon={<TelegramIcon size={24} />}
          accentClass="bg-blue-50/50"
          existing={getChannelSetting('telegram')}
        />
        <MessengerChannelCard
          channel="max"
          title="Макс (Bot API)"
          description="Рассылка через официальный Bot API MAX"
          icon={<MaxIcon size={24} />}
          accentClass="bg-violet-50/50"
          existing={getChannelSetting('max')}
        />
        <MessengerChannelCard
          channel="max_web"
          title="MAX Web Bridge"
          description="Отправка от вашего аккаунта через веб-сессию"
          icon={<MaxIcon size={24} />}
          accentClass="bg-purple-50/50"
          existing={getChannelSetting('max_web')}
          onCollapse={() => setOpenItems(prev => prev.filter(i => i !== 'max_web'))}
        />
      </Accordion>
    </div>
  );
}
