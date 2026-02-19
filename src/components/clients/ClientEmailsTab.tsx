import { useClientEmails, useEmails, Email } from '@/hooks/useEmails';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, Send, Inbox, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useState } from 'react';
import { EmailComposer } from '@/components/email/EmailComposer';
import { EmailView } from '@/components/email/EmailView';

interface ClientEmailsTabProps {
  clientId: string;
  clientEmail?: string;
  clientName?: string;
}

export function ClientEmailsTab({ clientId, clientEmail, clientName }: ClientEmailsTabProps) {
  const { data: emails = [], isLoading } = useClientEmails(clientId);
  const { accounts } = useEmailAccounts();
  const [composerOpen, setComposerOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Email | null>(null);
  const [forwardEmail, setForwardEmail] = useState<Email | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const { deleteEmail } = useEmails();

  if (isLoading) {
    return <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>;
  }

  if (selectedEmail) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => setSelectedEmail(null)} className="mb-2">
          ← Назад к списку
        </Button>
        <EmailView
          email={selectedEmail}
          onReply={(e) => { setReplyTo(e); setForwardEmail(null); setComposerOpen(true); }}
          onForward={(e) => { setForwardEmail(e); setReplyTo(null); setComposerOpen(true); }}
          onDelete={(id) => { deleteEmail.mutate(id); setSelectedEmail(null); }}
          isDeleting={deleteEmail.isPending}
        />
        <EmailComposer
          open={composerOpen}
          onOpenChange={setComposerOpen}
          replyTo={replyTo}
          forwardEmail={forwardEmail}
          accounts={accounts}
          clientContext={{ email: clientEmail, name: clientName, clientId }}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">Переписка по email</h3>
        {clientEmail && accounts.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => { setReplyTo(null); setComposerOpen(true); }} className="gap-1">
            <Plus className="h-4 w-4" /> Написать
          </Button>
        )}
      </div>

      {emails.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Нет писем</p>
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map(email => (
            <button
              key={email.id}
              onClick={() => setSelectedEmail(email)}
              className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                {email.direction === 'in' ? (
                  <Inbox className="h-3.5 w-3.5 text-blue-500" />
                ) : (
                  <Send className="h-3.5 w-3.5 text-green-500" />
                )}
                <span className="text-sm font-medium text-foreground truncate">
                  {email.direction === 'in' ? email.from_email : `→ ${email.to_email}`}
                </span>
                <span className="text-[11px] text-muted-foreground ml-auto">
                  {email.created_at ? format(new Date(email.created_at), 'dd.MM.yy HH:mm', { locale: ru }) : ''}
                </span>
              </div>
              <p className="text-sm text-muted-foreground truncate">{email.subject || '(без темы)'}</p>
            </button>
          ))}
        </div>
      )}

      <EmailComposer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        replyTo={replyTo}
        accounts={accounts}
        clientContext={{ email: clientEmail, name: clientName, clientId }}
      />
    </div>
  );
}
