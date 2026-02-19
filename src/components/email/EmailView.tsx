import { useState } from 'react';
import { Email } from '@/hooks/useEmails';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Reply, Forward, Trash2, User, Building2, Paperclip, Download, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface EmailViewProps {
  email: Email;
  onReply: (email: Email) => void;
  onForward: (email: Email) => void;
  onDelete: (emailId: string) => void;
  isDeleting?: boolean;
}

export function EmailView({ email, onReply, onForward, onDelete, isDeleting }: EmailViewProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 max-w-4xl mx-auto">
        {/* Subject */}
        <h2 className="text-xl font-semibold text-foreground mb-4">
          {email.subject || '(без темы)'}
        </h2>

        {/* Meta */}
        <div className="flex items-start justify-between mb-4 gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">
                {email.direction === 'in' ? email.from_email : `Кому: ${email.to_email}`}
              </span>
              {email.client_name && (
                <Badge variant="secondary" className="text-[10px] gap-0.5">
                  <User className="h-2.5 w-2.5" /> {email.client_name}
                </Badge>
              )}
              {email.company_name && (
                <Badge variant="secondary" className="text-[10px] gap-0.5">
                  <Building2 className="h-2.5 w-2.5" /> {email.company_name}
                </Badge>
              )}
            </div>
            {email.cc && (
              <p className="text-xs text-muted-foreground">Копия: {email.cc}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {email.created_at ? format(new Date(email.created_at), "dd MMMM yyyy, HH:mm", { locale: ru }) : ''}
            </p>
          </div>
        </div>

        {/* Action toolbar */}
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
          <Button variant="outline" size="sm" onClick={() => onReply(email)} className="gap-1.5">
            <Reply className="h-4 w-4" /> Ответить
          </Button>
          <Button variant="outline" size="sm" onClick={() => onForward(email)} className="gap-1.5">
            <Forward className="h-4 w-4" /> Переслать
          </Button>
          {email.direction === 'outbound' && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className={`text-xs gap-1 ${email.opened_at ? 'text-blue-500 border-blue-200' : 'text-muted-foreground border-border'}`}>
                    <CheckCheck className="h-3.5 w-3.5" />
                    {email.opened_at ? 'Прочитано' : 'Отправлено'}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {email.opened_at
                    ? `Открыто: ${format(new Date(email.opened_at), 'dd MMMM yyyy, HH:mm', { locale: ru })}${email.open_count > 1 ? ` · Открытий: ${email.open_count}` : ''}`
                    : 'Письмо доставлено, но ещё не открыто'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4" /> Удалить
          </Button>
        </div>

        {/* Attachments */}
        {email.attachments && email.attachments.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            {email.attachments.map((att: any, i: number) => (
              <Badge key={i} variant="outline" className="text-xs gap-1 cursor-pointer hover:bg-accent">
                {att.path ? (
                  <a href={att.path} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    {att.name || `Файл ${i + 1}`}
                  </a>
                ) : (
                  <span>{att.name || `Файл ${i + 1}`}</span>
                )}
              </Badge>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="border border-border rounded-lg p-4 bg-card">
          {email.body_html ? (
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: email.body_html }}
            />
          ) : (
            <p className="text-muted-foreground text-sm italic">Нет содержимого</p>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить письмо?</AlertDialogTitle>
            <AlertDialogDescription>
              Письмо будет перемещено в корзину. Это действие можно отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onDelete(email.id);
                setDeleteConfirmOpen(false);
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  );
}
