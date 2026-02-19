import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchInput } from '@/components/ui/search-input';
import { MessageCircle, Send, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { NotificationTemplate } from '@/hooks/useNotifications';
import { useMessengerSettings } from '@/hooks/useMessengerSettings';

interface ManualSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: NotificationTemplate[];
  onSent: (params: {
    client_id: string;
    template_id?: string;
    channel: string;
    message: string;
    template_title?: string;
  }) => Promise<void>;
}

function resolveTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
}

export function ManualSendDialog({
  open,
  onOpenChange,
  templates,
  onSent,
}: ManualSendDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { settings: messengerSettings } = useMessengerSettings();

  // Determine preferred channel
  const preferredChannel = useMemo(() => {
    const active = messengerSettings.find(s => s.is_active && s.status === 'connected');
    return active?.channel ?? 'whatsapp';
  }, [messengerSettings]);

  // Load clients for search
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-notify'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, first_name, last_name, middle_name, phone')
        .order('last_name')
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
    staleTime: 60 * 1000,
  });

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients.slice(0, 30);
    const q = search.toLowerCase();
    return clients.filter(c => {
      const full = `${c.last_name} ${c.first_name} ${c.middle_name || ''} ${c.phone}`.toLowerCase();
      return full.includes(q);
    }).slice(0, 30);
  }, [clients, search]);

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  // When template or client changes, update preview
  const previewText = useMemo(() => {
    if (messageText) return messageText;
    if (!selectedTemplate) return '';
    const vars: Record<string, string> = {};
    if (selectedClient) {
      vars.name = `${selectedClient.first_name} ${selectedClient.middle_name || ''}`.trim();
    }
    return resolveTemplate(selectedTemplate.message_template, vars);
  }, [selectedTemplate, selectedClient, messageText]);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tpl = templates.find(t => t.id === templateId);
    if (tpl && selectedClient) {
      const vars: Record<string, string> = {
        name: `${selectedClient.first_name} ${selectedClient.middle_name || ''}`.trim(),
      };
      setMessageText(resolveTemplate(tpl.message_template, vars));
    } else if (tpl) {
      setMessageText(tpl.message_template);
    }
  };

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find(c => c.id === clientId);
    if (selectedTemplate && client) {
      const vars: Record<string, string> = {
        name: `${client.first_name} ${client.middle_name || ''}`.trim(),
      };
      setMessageText(resolveTemplate(selectedTemplate.message_template, vars));
    }
  };

  const handleSendWhatsApp = async () => {
    if (!selectedClient || !messageText.trim()) return;
    setIsSending(true);
    try {
      // Clean phone number
      const phone = selectedClient.phone.replace(/\D/g, '');
      const encodedText = encodeURIComponent(messageText);
      const url = `https://wa.me/${phone}?text=${encodedText}`;

      // Log the send
      await onSent({
        client_id: selectedClient.id,
        template_id: selectedTemplate?.id,
        channel: 'whatsapp',
        message: messageText,
        template_title: selectedTemplate?.title,
      });

      // Open WhatsApp
      window.open(url, '_blank');
      onOpenChange(false);
      resetForm();
    } finally {
      setIsSending(false);
    }
  };

  const handleSendTelegram = async () => {
    if (!selectedClient || !messageText.trim()) return;
    setIsSending(true);
    try {
      await onSent({
        client_id: selectedClient.id,
        template_id: selectedTemplate?.id,
        channel: 'telegram',
        message: messageText,
        template_title: selectedTemplate?.title,
      });
      onOpenChange(false);
      resetForm();
    } finally {
      setIsSending(false);
    }
  };

  const resetForm = () => {
    setSearch('');
    setSelectedClientId(null);
    setSelectedTemplateId(null);
    setMessageText('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ручная отправка сообщения</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Client search */}
          <div className="space-y-2">
            <Label>Клиент</Label>
            <SearchInput
              placeholder="Поиск по ФИО или телефону..."
              value={search}
              onChange={setSearch}
            />
            {search && !selectedClientId && filteredClients.length > 0 && (
              <div className="border border-border rounded-md max-h-40 overflow-y-auto divide-y divide-border">
                {filteredClients.map(c => (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors text-sm"
                    onClick={() => {
                      handleClientSelect(c.id);
                      setSearch(`${c.last_name} ${c.first_name}`);
                    }}
                  >
                    <span className="font-medium">{c.last_name} {c.first_name} {c.middle_name || ''}</span>
                    <span className="text-muted-foreground ml-2">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedClient && (
              <p className="text-xs text-muted-foreground">
                Выбран: {selectedClient.last_name} {selectedClient.first_name} — {selectedClient.phone}
              </p>
            )}
          </div>

          {/* Template selection */}
          <div className="space-y-2">
            <Label>Шаблон</Label>
            <Select value={selectedTemplateId || ''} onValueChange={handleTemplateChange}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите шаблон" />
              </SelectTrigger>
              <SelectContent>
                {templates.filter(t => t.is_active).map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Message preview / edit */}
          <div className="space-y-2">
            <Label>Сообщение</Label>
            <Textarea
              rows={5}
              value={messageText || previewText}
              onChange={e => setMessageText(e.target.value)}
              placeholder="Текст сообщения..."
            />
          </div>

          {/* Send buttons */}
          <div className="flex gap-2">
            {preferredChannel === 'whatsapp' ? (
              <>
                <Button
                  onClick={handleSendWhatsApp}
                  disabled={!selectedClient || !messageText.trim() || isSending}
                  className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  <MessageCircle className="h-4 w-4" />
                  Отправить в WhatsApp
                  <ExternalLink className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSendTelegram}
                  disabled={!selectedClient || !messageText.trim() || isSending}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  Telegram
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleSendTelegram}
                  disabled={!selectedClient || !messageText.trim() || isSending}
                  className="flex-1 gap-2"
                >
                  <Send className="h-4 w-4" />
                  Отправить в Telegram
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSendWhatsApp}
                  disabled={!selectedClient || !messageText.trim() || isSending}
                  className="gap-2 border-green-300 text-green-700 hover:bg-green-50"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
