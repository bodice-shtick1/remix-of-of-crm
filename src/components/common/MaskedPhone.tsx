import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useContactMasking } from '@/hooks/useContactMasking';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { logEventStrictOrBlock } from '@/hooks/useEventLog';
import { supabase } from '@/integrations/supabase/client';

interface MaskedPhoneProps {
  phone: string;
  clientId: string;
  clientName?: string;
  className?: string;
  showIcon?: boolean;
  context?: string;
}

export function MaskedPhone({ phone, clientId, clientName, className, showIcon = true, context }: MaskedPhoneProps) {
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { shouldMask, maskPhone, checkCanReveal } = useContactMasking();
  const { toast } = useToast();

  if (!shouldMask) {
    return <span className={className}>{phone}</span>;
  }

  const handleReveal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (revealed) {
      setRevealed(false);
      return;
    }

    setLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { data: profile } = currentUser ? await supabase.from('profiles').select('full_name').eq('user_id', currentUser.id).maybeSingle() : { data: null };
      const staffName = profile?.full_name || 'Сотрудник';
      const displayClientName = clientName || `Неизвестный клиент ID: ${clientId}`;

      // Check prolongation rule (admin bypasses)
      const canReveal = await checkCanReveal(clientId);
      if (!canReveal) {
        // Log denied attempt
        await logEventStrictOrBlock({
          action: 'access_denied',
          category: 'access',
          entityType: 'client',
          entityId: clientId,
          clientId,
          fieldAccessed: 'phone',
          newValue: `Попытка доступа отклонена: до пролонгации более 30 дней (Клиент: ${displayClientName})`,
          details: { section: context || 'Клиенты', client_name: displayClientName, reason: 'prolongation_30d' },
        });
        toast({
          title: 'Доступ к контактам закрыт',
          description: 'Просмотр разрешен только в период пролонгации (за 30 дней до истечения полиса).',
          variant: 'destructive',
        });
        return;
      }

      // Log successful reveal
      const logged = await logEventStrictOrBlock({
        action: 'view_contact_phone',
        category: 'access',
        entityType: 'client',
        entityId: clientId,
        clientId,
        fieldAccessed: 'phone',
        newValue: `Сотрудник ${staffName} раскрыл номер телефона клиента ${displayClientName}`,
        details: { section: context || 'Клиенты', client_name: displayClientName },
      });

      if (!logged) {
        toast({
          title: 'Ошибка безопасности',
          description: 'Не удалось записать действие в журнал. Просмотр заблокирован.',
          variant: 'destructive',
        });
        return;
      }

      setRevealed(true);
      setTimeout(() => setRevealed(false), 10000);
    } catch (error) {
      console.error('Error revealing phone:', error);
      toast({ 
        title: 'Ошибка', 
        description: 'Не удалось открыть номер', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const displayPhone = revealed ? phone : maskPhone(phone);

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className={cn(revealed && 'text-primary font-medium')}>{displayPhone}</span>
      {showIcon && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-5 w-5 shrink-0" 
          onClick={handleReveal}
          disabled={loading}
          title={revealed ? 'Скрыть номер' : 'Показать номер'}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : revealed ? (
            <EyeOff className="h-3 w-3" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
        </Button>
      )}
    </span>
  );
}

interface MaskedEmailProps {
  email: string;
  clientId: string;
  className?: string;
}

export function MaskedEmail({ email, clientId, clientName, className, context }: MaskedEmailProps & { clientName?: string; context?: string }) {
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { shouldMask, maskEmail, checkCanReveal } = useContactMasking();
  const { toast } = useToast();

  if (!shouldMask || !email) {
    return <span className={className}>{email}</span>;
  }

  const handleReveal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (revealed) {
      setRevealed(false);
      return;
    }

    setLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { data: profile } = currentUser ? await supabase.from('profiles').select('full_name').eq('user_id', currentUser.id).maybeSingle() : { data: null };
      const staffName = profile?.full_name || 'Сотрудник';
      const displayClientName = clientName || `Неизвестный клиент ID: ${clientId}`;

      // Check prolongation rule (admin bypasses)
      const canReveal = await checkCanReveal(clientId);
      if (!canReveal) {
        await logEventStrictOrBlock({
          action: 'access_denied',
          category: 'access',
          entityType: 'client',
          entityId: clientId,
          clientId,
          fieldAccessed: 'email',
          newValue: `Попытка доступа отклонена: до пролонгации более 30 дней (Клиент: ${displayClientName})`,
          details: { section: context || 'Клиенты', client_name: displayClientName, reason: 'prolongation_30d' },
        });
        toast({
          title: 'Доступ к контактам закрыт',
          description: 'Просмотр разрешен только в период пролонгации (за 30 дней до истечения полиса).',
          variant: 'destructive',
        });
        return;
      }

      const logged = await logEventStrictOrBlock({
        action: 'view_contact_email',
        category: 'access',
        entityType: 'client',
        entityId: clientId,
        clientId,
        fieldAccessed: 'email',
        newValue: `Сотрудник ${staffName} раскрыл email клиента ${displayClientName}`,
        details: { section: context || 'Клиенты', client_name: displayClientName },
      });

      if (!logged) {
        toast({
          title: 'Ошибка безопасности',
          description: 'Не удалось записать действие в журнал. Просмотр заблокирован.',
          variant: 'destructive',
        });
        return;
      }

      setRevealed(true);
      setTimeout(() => setRevealed(false), 10000);
    } catch (error) {
      toast({ title: 'Ошибка', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const displayEmail = revealed ? email : maskEmail(email);

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className={cn(revealed && 'text-primary')}>{displayEmail}</span>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-4 w-4" 
        onClick={handleReveal}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
        ) : revealed ? (
          <EyeOff className="h-2.5 w-2.5" />
        ) : (
          <Eye className="h-2.5 w-2.5" />
        )}
      </Button>
    </span>
  );
}
