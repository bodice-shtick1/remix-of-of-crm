import { useState, useMemo, useEffect } from 'react';
import { useEmails, Email } from '@/hooks/useEmails';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { usePermissions } from '@/hooks/usePermissions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Inbox, Send, Search, RefreshCw, Plus, Mail, User, Building2,
  Shield, Loader2, ChevronLeft, RotateCcw, CheckCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EmailComposer } from './EmailComposer';
import { EmailView } from './EmailView';

type Folder = 'inbox' | 'sent';

interface EmailInboxProps {
  initialEmailId?: string;
}

export function EmailInbox({ initialEmailId }: EmailInboxProps) {
  const { can } = usePermissions();
  const { accounts } = useEmailAccounts();
  const [folder, setFolder] = useState<Folder>('inbox');
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>();
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Email | null>(null);
  const [forwardEmail, setForwardEmail] = useState<Email | null>(null);
  const [search, setSearch] = useState('');

  const { emails, isLoading, syncEmails, markRead, deleteEmail } = useEmails(folder, selectedAccountId);

  // Auto-select email from URL param
  useEffect(() => {
    if (initialEmailId && emails.length > 0) {
      const found = emails.find(e => e.id === initialEmailId);
      if (found && selectedEmail?.id !== initialEmailId) {
        setSelectedEmail(found);
        if (!found.is_read) markRead.mutate(found.id);
      }
    }
  }, [initialEmailId, emails]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredEmails = useMemo(() => {
    if (!search) return emails;
    const s = search.toLowerCase();
    return emails.filter(e =>
      (e.subject?.toLowerCase().includes(s)) ||
      e.from_email.toLowerCase().includes(s) ||
      e.to_email.toLowerCase().includes(s) ||
      e.client_name?.toLowerCase().includes(s) ||
      e.company_name?.toLowerCase().includes(s)
    );
  }, [emails, search]);

  const handleSelectEmail = (email: Email) => {
    setSelectedEmail(email);
    if (!email.is_read) {
      markRead.mutate(email.id);
    }
  };

  const handleReply = (email: Email) => {
    setReplyTo(email);
    setForwardEmail(null);
    setComposerOpen(true);
  };

  const handleForward = (email: Email) => {
    setForwardEmail(email);
    setReplyTo(null);
    setComposerOpen(true);
  };

  const handleDelete = (emailId: string) => {
    deleteEmail.mutate(emailId);
    setSelectedEmail(null);
  };

  const handleSync = (fullSync = false) => {
    if (selectedAccountId) {
      syncEmails.mutate({ accountId: selectedAccountId, full_sync: fullSync });
    } else if (accounts.length > 0) {
      accounts.forEach(a => syncEmails.mutate({ accountId: a.id, full_sync: fullSync }));
    }
  };

  if (!can('email_view_own')) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Нет доступа к почте</p>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Mail className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">Нет настроенных почтовых аккаунтов</p>
        <p className="text-sm text-muted-foreground">Добавьте аккаунт в Настройках → Почтовые аккаунты</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Folder sidebar */}
      <div className="w-48 border-r border-border flex-shrink-0 flex flex-col">
        <div className="p-3 space-y-1">
          <button
            onClick={() => { setFolder('inbox'); setSelectedEmail(null); }}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
              folder === 'inbox' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <Inbox className="h-4 w-4" />
            Входящие
            {emails.filter(e => !e.is_read && folder === 'inbox').length > 0 && (
              <Badge variant="destructive" className="ml-auto text-[10px] h-5 px-1.5">
                {emails.filter(e => !e.is_read).length}
              </Badge>
            )}
          </button>
          <button
            onClick={() => { setFolder('sent'); setSelectedEmail(null); }}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
              folder === 'sent' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <Send className="h-4 w-4" />
            Отправленные
          </button>
        </div>

        {/* Account filter */}
        <div className="px-3 mt-2 space-y-1">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground/60 px-1">Аккаунты</p>
          <button
            onClick={() => setSelectedAccountId(undefined)}
            className={cn(
              'w-full text-left px-2 py-1 rounded text-xs transition-colors truncate',
              !selectedAccountId ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            Все аккаунты
          </button>
          {accounts.map(a => (
            <button
              key={a.id}
              onClick={() => setSelectedAccountId(a.id)}
              className={cn(
                'w-full text-left px-2 py-1 rounded text-xs transition-colors truncate',
                selectedAccountId === a.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {a.display_name || a.email_address}
              {a.is_org_account && <Building2 className="inline h-3 w-3 ml-1" />}
            </button>
          ))}
        </div>
      </div>

      {/* Email list or view */}
      {selectedEmail ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-2 border-b border-border flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedEmail(null)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Назад
            </Button>
          </div>
          <EmailView
            email={selectedEmail}
            onReply={handleReply}
            onForward={handleForward}
            onDelete={handleDelete}
            isDeleting={deleteEmail.isPending}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="p-2 border-b border-border flex items-center gap-2">
            <Button size="sm" onClick={() => { setReplyTo(null); setForwardEmail(null); setComposerOpen(true); }} className="gap-1">
              <Plus className="h-4 w-4" /> Написать
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleSync()} disabled={syncEmails.isPending} className="gap-1">
              {syncEmails.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Синхронизировать
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleSync(true)} disabled={syncEmails.isPending} className="gap-1" title="Загрузить письма за 90 дней">
              <RotateCcw className="h-4 w-4" />
              Полная
            </Button>
            <div className="flex-1" />
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* Email list */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Mail className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Нет писем</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredEmails.map(email => (
                  <button
                    key={email.id}
                    onClick={() => handleSelectEmail(email)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex gap-3',
                      !email.is_read && 'bg-primary/5'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn('text-sm truncate', !email.is_read && 'font-semibold text-foreground')}>
                          {folder === 'inbox' ? email.from_email : email.to_email}
                        </span>
                        {email.client_name && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5 shrink-0">
                            <User className="h-2.5 w-2.5" /> Клиент
                          </Badge>
                        )}
                        {email.company_name && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5 shrink-0">
                            <Building2 className="h-2.5 w-2.5" /> Партнёр
                          </Badge>
                        )}
                        {email.direction === 'outbound' && (
                          <TooltipProvider delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center shrink-0">
                                  <CheckCheck className={cn('h-3.5 w-3.5', email.opened_at ? 'text-blue-500' : 'text-muted-foreground/50')} />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                {email.opened_at
                                  ? `Прочитано: ${format(new Date(email.opened_at), 'dd MMM yyyy, HH:mm', { locale: ru })}${email.open_count > 1 ? ` (×${email.open_count})` : ''}`
                                  : 'Отправлено, не прочитано'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                          {email.created_at ? format(new Date(email.created_at), 'dd MMM HH:mm', { locale: ru }) : ''}
                        </span>
                      </div>
                      <p className={cn('text-sm truncate', !email.is_read ? 'text-foreground' : 'text-muted-foreground')}>
                        {email.subject || '(без темы)'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Composer dialog */}
      <EmailComposer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        replyTo={replyTo}
        forwardEmail={forwardEmail}
        accounts={accounts}
      />
    </div>
  );
}
