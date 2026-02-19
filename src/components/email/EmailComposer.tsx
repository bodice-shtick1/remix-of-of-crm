import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, Paperclip, Maximize2, Minimize2, FileText, X, FolderOpen } from 'lucide-react';
import { EmailAccount } from '@/hooks/useEmailAccounts';
import { useEmails, Email } from '@/hooks/useEmails';
import { useNotificationTemplates } from '@/hooks/useNotifications';
import { renderTemplate, type TemplateVars } from '@/lib/templateEngine';
import { useClientDocuments } from '@/hooks/useClientDocuments';
import { RichTextEditor } from './RichTextEditor';
import { cn } from '@/lib/utils';

interface AttachmentFile {
  name: string;
  path?: string;
  file?: File;
  size?: number;
}

interface EmailComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replyTo?: Email | null;
  forwardEmail?: Email | null;
  accounts: EmailAccount[];
  clientContext?: {
    email?: string;
    name?: string;
    clientId?: string;
  };
}

export function EmailComposer({ open, onOpenChange, replyTo, forwardEmail, accounts, clientContext }: EmailComposerProps) {
  const [accountId, setAccountId] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [crmPickerOpen, setCrmPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { sendEmail } = useEmails();
  const { templates } = useNotificationTemplates();
  const { documents: crmDocuments, isLoading: crmLoading } = useClientDocuments(clientContext?.clientId || '');

  const selectedAccount = accounts.find(a => a.id === accountId);

  // Set defaults when dialog opens
  useEffect(() => {
    if (!open) return;
    if (accounts.length > 0 && !accountId) {
      setAccountId(accounts[0].id);
    }
    if (replyTo) {
      setTo(replyTo.direction === 'in' ? replyTo.from_email : replyTo.to_email);
      setSubject(replyTo.subject ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, '')}` : '');
      const quoted = `<br/><br/><blockquote style="border-left:3px solid #ccc;padding-left:12px;margin-left:0;color:#666">${replyTo.body_html || ''}</blockquote>`;
      setBodyHtml(quoted);
      setAttachments([]);
    } else if (forwardEmail) {
      setTo('');
      setSubject(forwardEmail.subject ? `Fwd: ${forwardEmail.subject.replace(/^Fwd:\s*/i, '')}` : '');
      const fwdHeader = `<br/><br/>---------- Пересланное сообщение ----------<br/>От: ${forwardEmail.from_email}<br/>Тема: ${forwardEmail.subject || ''}<br/><br/>`;
      setBodyHtml(fwdHeader + (forwardEmail.body_html || ''));
      // Forward attachments
      const fwdAttachments = (forwardEmail.attachments || []).map((att: any) => ({
        name: att.name || 'file',
        path: att.path,
      }));
      setAttachments(fwdAttachments);
    } else if (clientContext?.email) {
      setTo(clientContext.email);
      setSubject('');
      setBodyHtml('');
      setAttachments([]);
    } else {
      setTo('');
      setSubject('');
      setBodyHtml('');
      setAttachments([]);
    }
    setCc('');
    setIsFullscreen(false);
  }, [open, replyTo, forwardEmail, accounts, clientContext]);

  // Append signature when account changes
  useEffect(() => {
    if (!open || !selectedAccount?.signature) return;
    // Only append if body doesn't already contain the signature
    if (!bodyHtml.includes('email-signature')) {
      setBodyHtml(prev => prev + `<br/><div class="email-signature" style="margin-top:16px;border-top:1px solid #eee;padding-top:8px;color:#888;font-size:13px">${selectedAccount.signature}</div>`);
    }
  }, [accountId, open]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: AttachmentFile[] = Array.from(files).map(f => ({
      name: f.name,
      file: f,
      size: f.size,
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleTemplateSelect = (template: { message_template: string; title: string }) => {
    const vars: TemplateVars = {};
    if (clientContext?.name) {
      vars.customer_name = clientContext.name;
      vars.name = clientContext.name;
    }
    const rendered = renderTemplate(template.message_template, vars);
    setBodyHtml(rendered.replace(/\n/g, '<br/>'));
    if (!subject) setSubject(template.title);
    setTemplateOpen(false);
  };

  const handleSend = () => {
    if (!accountId || !to.trim() || !subject.trim()) return;

    const vars: TemplateVars = {};
    if (clientContext?.name) {
      vars.customer_name = clientContext.name;
      vars.name = clientContext.name;
    }
    const processedBody = renderTemplate(bodyHtml, vars);

    sendEmail.mutate({
      account_id: accountId,
      to: to.trim(),
      subject: subject.trim(),
      html: processedBody,
      cc: cc.trim() || undefined,
      attachments: attachments.filter(a => a.path).map(a => ({ name: a.name, path: a.path! })),
    }, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  const emailTemplates = templates.filter(t => t.channel === 'email' || t.channel === 'whatsapp');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        'flex flex-col',
        isFullscreen ? 'sm:max-w-[95vw] sm:max-h-[95vh] h-[95vh]' : 'sm:max-w-3xl sm:max-h-[85vh]'
      )}>
        <DialogHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <DialogTitle className="text-base">{replyTo ? 'Ответить' : forwardEmail ? 'Переслать' : 'Новое письмо'}</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setIsFullscreen(v => !v)}
            title={isFullscreen ? 'Свернуть' : 'На весь экран'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3">
          {/* Account selector */}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="space-y-1">
              <Label className="text-xs">От</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Аккаунт..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.display_name || a.email_address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Template picker */}
            <div className="space-y-1">
              <Label className="text-xs">Шаблон</Label>
              <Popover open={templateOpen} onOpenChange={setTemplateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                    <FileText className="h-3.5 w-3.5" /> Шаблоны
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="end">
                  <Command>
                    <CommandInput placeholder="Поиск шаблона..." />
                    <CommandList>
                      <CommandEmpty>Нет шаблонов</CommandEmpty>
                      <CommandGroup>
                        {emailTemplates.map(t => (
                          <CommandItem key={t.id} onSelect={() => handleTemplateSelect(t)} className="cursor-pointer">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{t.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{t.description || t.message_template.slice(0, 60)}</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* To / CC */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Кому</Label>
              <Input value={to} onChange={e => setTo(e.target.value)} placeholder="email@example.com" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Копия (CC)</Label>
              <Input value={cc} onChange={e => setCc(e.target.value)} placeholder="email@example.com" className="h-8 text-sm" />
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1">
            <Label className="text-xs">Тема</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Тема письма..." className="h-8 text-sm" />
          </div>

          {/* Rich Text Editor */}
          <div className="space-y-1">
            <Label className="text-xs">Сообщение</Label>
            <RichTextEditor
              content={bodyHtml}
              onChange={setBodyHtml}
              placeholder="Текст письма... Поддерживается {{customer_name}}"
              minHeight={isFullscreen ? '400px' : '200px'}
            />
            <p className="text-[10px] text-muted-foreground">
              Переменные: {'{{customer_name}}'}, {'{{policy_number}}'}, {'{{end_date}}'}
            </p>
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachments.map((att, i) => (
                <Badge key={i} variant="secondary" className="gap-1 text-xs pr-1">
                  <Paperclip className="h-3 w-3" />
                  {att.name}
                  {att.size && <span className="text-muted-foreground">({(att.size / 1024).toFixed(0)}KB)</span>}
                  <button onClick={() => removeAttachment(i)} className="ml-0.5 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-1">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-3.5 w-3.5" /> Прикрепить
            </Button>
            {clientContext?.clientId && (
              <Popover open={crmPickerOpen} onOpenChange={setCrmPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    <FolderOpen className="h-3.5 w-3.5" /> Из CRM
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <div className="p-2 border-b border-border">
                    <p className="text-xs font-medium text-foreground">Документы клиента</p>
                  </div>
                  <ScrollArea className="max-h-48">
                    {crmLoading ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">Загрузка...</div>
                    ) : crmDocuments.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">Нет документов</div>
                    ) : (
                      <div className="p-1">
                        {crmDocuments.map(doc => {
                          const alreadyAdded = attachments.some(a => a.path === doc.file_path);
                          return (
                            <button
                              key={doc.id}
                              disabled={alreadyAdded}
                              onClick={() => {
                                setAttachments(prev => [...prev, {
                                  name: doc.file_name,
                                  path: doc.file_path,
                                  size: doc.file_size ?? undefined,
                                }]);
                                setCrmPickerOpen(false);
                              }}
                              className={cn(
                                'w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors flex items-center gap-2',
                                alreadyAdded && 'opacity-50 cursor-not-allowed'
                              )}
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="truncate flex-1">{doc.file_name}</span>
                              {doc.file_size && (
                                <span className="text-muted-foreground shrink-0">
                                  {(doc.file_size / 1024).toFixed(0)}KB
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button size="sm" onClick={handleSend} disabled={sendEmail.isPending || !to.trim() || !subject.trim()} className="gap-1">
              {sendEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Отправить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
