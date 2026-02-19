import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StaffCredentialsCellProps {
  type: 'email' | 'password';
  value: string;
  userId: string;
  adminId: string;
  targetEmail: string;
}

export function StaffCredentialsCell({ type, value, userId, adminId, targetEmail }: StaffCredentialsCellProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  const handleReveal = async () => {
    if (!isRevealed) {
      // Log the reveal action
      try {
        await supabase.from('security_audit_logs').insert({
          user_id: adminId,
          action: type === 'password' ? 'password_viewed' : 'email_viewed',
          target_user_id: userId,
          target_email: targetEmail,
          details: { field: type, viewed_at: new Date().toISOString() },
        });
      } catch (error) {
        console.warn('[StaffCredentialsCell] Failed to log reveal:', error);
      }
    }
    
    setIsRevealed(!isRevealed);
    
    // Auto-hide after 10 seconds
    if (!isRevealed) {
      setTimeout(() => setIsRevealed(false), 10000);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      
      // Log the copy action
      await supabase.from('security_audit_logs').insert({
        user_id: adminId,
        action: type === 'password' ? 'password_copied' : 'email_copied',
        target_user_id: userId,
        target_email: targetEmail,
        details: { field: type, copied_at: new Date().toISOString() },
      });
      
      toast({ title: 'Скопировано', description: `${type === 'email' ? 'Email' : 'Пароль'} скопирован в буфер обмена` });
      
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось скопировать', variant: 'destructive' });
    }
  };

  const displayValue = () => {
    if (type === 'email') {
      return isRevealed ? value : maskEmail(value);
    }
    return isRevealed ? value : '••••••••';
  };

  const maskEmail = (email: string) => {
    if (!email) return '—';
    const [local, domain] = email.split('@');
    if (!domain) return '***@***';
    return `${local.slice(0, 2)}***@${domain}`;
  };

  if (!value) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono max-w-[120px] truncate">
          {displayValue()}
        </code>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleReveal}
            >
              {isRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isRevealed ? 'Скрыть' : 'Показать'}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopy}
            >
              {isCopied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Копировать
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
