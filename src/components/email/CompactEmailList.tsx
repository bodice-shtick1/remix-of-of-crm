import { useMemo, useState } from 'react';
import { useEmails, Email } from '@/hooks/useEmails';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Mail, User, Building2, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { EmailView } from './EmailView';
import { EmailComposer } from './EmailComposer';

interface CompactEmailListProps {
  folder: 'inbox' | 'sent';
  accountId?: string;
  composerOpen: boolean;
  onComposerOpenChange: (open: boolean) => void;
}

export function CompactEmailList({ folder, accountId, composerOpen, onComposerOpenChange }: CompactEmailListProps) {
  const { accounts } = useEmailAccounts();
  const { emails, isLoading, markRead, deleteEmail } = useEmails(folder, accountId);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [replyTo, setReplyTo] = useState<Email | null>(null);
  const [forwardEmail, setForwardEmail] = useState<Email | null>(null);

  const handleSelectEmail = (email: Email) => {
    setSelectedEmail(email);
    if (!email.is_read) markRead.mutate(email.id);
  };

  const handleReply = (email: Email) => {
    setReplyTo(email);
    setForwardEmail(null);
    onComposerOpenChange(true);
  };

  const handleForward = (email: Email) => {
    setForwardEmail(email);
    setReplyTo(null);
    onComposerOpenChange(true);
  };

  const handleDelete = (emailId: string) => {
    deleteEmail.mutate(emailId);
    setSelectedEmail(null);
  };

  const handleCompose = () => {
    setReplyTo(null);
    setForwardEmail(null);
    onComposerOpenChange(true);
  };

  // When viewing a single email
  if (selectedEmail) {
    return (
      <div className="flex flex-col h-full">
        <button
          onClick={() => setSelectedEmail(null)}
          className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Назад
        </button>
        <div className="flex-1 overflow-auto">
          <EmailView
            email={selectedEmail}
            onReply={handleReply}
            onForward={handleForward}
            onDelete={handleDelete}
            isDeleting={deleteEmail.isPending}
          />
        </div>
        <EmailComposer
          open={composerOpen}
          onOpenChange={onComposerOpenChange}
          replyTo={replyTo}
          forwardEmail={forwardEmail}
          accounts={accounts}
        />
      </div>
    );
  }

  // Email list — full width, edge to edge
  return (
    <>
      <ScrollArea className="h-full">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Mail className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Нет писем</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {emails.map(email => (
              <button
                key={email.id}
                onClick={() => handleSelectEmail(email)}
                className={cn(
                  'w-full text-left px-3 py-2.5 hover:bg-muted/30 transition-colors',
                  !email.is_read && 'bg-primary/5'
                )}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={cn('text-xs truncate flex-1', !email.is_read && 'font-semibold text-foreground')}>
                    {folder === 'inbox' ? email.from_email : email.to_email}
                  </span>
                  {email.client_name && (
                    <Badge variant="outline" className="text-[9px] h-3.5 px-1 gap-0.5 shrink-0">
                      <User className="h-2 w-2" />
                    </Badge>
                  )}
                  {email.company_name && (
                    <Badge variant="outline" className="text-[9px] h-3.5 px-1 gap-0.5 shrink-0">
                      <Building2 className="h-2 w-2" />
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {email.created_at ? format(new Date(email.created_at), 'dd MMM HH:mm', { locale: ru }) : ''}
                  </span>
                </div>
                <p className={cn('text-xs truncate', !email.is_read ? 'text-foreground' : 'text-muted-foreground')}>
                  {email.subject || '(без темы)'}
                </p>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      <EmailComposer
        open={composerOpen}
        onOpenChange={onComposerOpenChange}
        replyTo={replyTo}
        forwardEmail={forwardEmail}
        accounts={accounts}
      />
    </>
  );
}
