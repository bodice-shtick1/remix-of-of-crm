import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Loader2, Rocket } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const CURRENCIES = [
  { value: '₽', label: '₽ — Российский рубль' },
  { value: '$', label: '$ — Доллар США' },
  { value: '€', label: '€ — Евро' },
  { value: '₸', label: '₸ — Казахстанский тенге' },
  { value: 'сум', label: 'сум — Узбекский сум' },
];

const TIMEZONES = [
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
];

export default function SetupWizard() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    org_name: '',
    currency: '₽',
    timezone: 'Europe/Moscow',
    monthly_goal: '1000000',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.org_name) return;

    if (form.password.length < 6) {
      toast({ title: 'Пароль должен быть не менее 6 символов', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Call setup-system edge function (uses Admin API with email_confirm: true)
      const { data, error } = await supabase.functions.invoke('setup-system', {
        body: {
          email: form.email,
          password: form.password,
          org_name: form.org_name,
          currency: form.currency,
          timezone: form.timezone,
          monthly_goal: Number(form.monthly_goal) || 1000000,
        },
      });

      if (error) {
        throw new Error(error.message || 'Ошибка вызова функции настройки');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Sign in with created credentials (email is auto-confirmed)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (signInError) {
        throw new Error(`Система настроена, но не удалось войти: ${signInError.message}`);
      }

      toast({ title: 'Система настроена!', description: 'Добро пожаловать, Администратор.' });

      // Hard reload to pick up new session
      window.location.href = '/';
    } catch (err: any) {
      toast({
        title: 'Ошибка настройки',
        description: err.message || 'Неизвестная ошибка',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Первоначальная настройка CRM</CardTitle>
          <CardDescription>
            Создайте аккаунт администратора и настройте организацию
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Аккаунт администратора
              </h3>
              <div className="space-y-2">
                <Label htmlFor="setup-email">Email *</Label>
                <Input
                  id="setup-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="admin@company.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-password">Пароль *</Label>
                <Input
                  id="setup-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  placeholder="Минимум 6 символов"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="border-t" />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Данные организации
              </h3>
              <div className="space-y-2">
                <Label htmlFor="setup-org">Название компании *</Label>
                <Input
                  id="setup-org"
                  value={form.org_name}
                  onChange={(e) => update('org_name', e.target.value)}
                  placeholder="ООО «Страховой брокер»"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Валюта</Label>
                  <Select value={form.currency} onValueChange={(v) => update('currency', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Часовой пояс</Label>
                  <Select value={form.timezone} onValueChange={(v) => update('timezone', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-goal">Цель по выручке на месяц</Label>
                <Input
                  id="setup-goal"
                  type="number"
                  value={form.monthly_goal}
                  onChange={(e) => update('monthly_goal', e.target.value)}
                  placeholder="1000000"
                  min={0}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting || !form.email || !form.password || !form.org_name}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Rocket className="h-4 w-4 mr-2" />
              )}
              Запустить систему
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
