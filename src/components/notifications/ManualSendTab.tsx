import { useState, useMemo, useEffect } from 'react';
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
import { MessageCircle, Send, ExternalLink, Eye } from 'lucide-react';
import { maskPhone } from '@/hooks/useContactMasking';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { NotificationTemplate } from '@/hooks/useNotifications';
import { useMessengerSettings } from '@/hooks/useMessengerSettings';
import { buildTemplateVars, renderTemplate } from '@/lib/templateEngine';
import { toast } from 'sonner';
import { getClientDisplayName } from '@/lib/mappers';

interface ManualSendTabProps {
  templates: NotificationTemplate[];
  onSent: (params: {
    client_id: string;
    template_id?: string;
    channel: string;
    message: string;
    template_title?: string;
  }) => Promise<void>;
}

export function ManualSendTab({ templates, onSent }: ManualSendTabProps) {
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { settings: messengerSettings } = useMessengerSettings();

  const preferredChannel = useMemo(() => {
    const active = messengerSettings.find(s => s.is_active && s.status === 'connected');
    return active?.channel ?? 'whatsapp';
  }, [messengerSettings]);

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
    staleTime: 60 * 1000,
  });

  // Fetch latest policy for selected client
  const { data: clientPolicy } = useQuery({
    queryKey: ['client-latest-policy', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return null;
      const { data, error } = await supabase
        .from('policies')
        .select('policy_type, policy_series, policy_number, vehicle_model, vehicle_number, end_date')
        .eq('client_id', selectedClientId)
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClientId,
    staleTime: 30 * 1000,
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

  // Re-render template when client policy data loads
  const resolvedText = useMemo(() => {
    if (!selectedTemplate) return '';
    const vars = buildTemplateVars(selectedClient, clientPolicy);
    return renderTemplate(selectedTemplate.message_template, vars);
  }, [selectedTemplate, selectedClient, clientPolicy]);

  // Auto-fill message when resolved text changes (and user hasn't manually edited)
  useEffect(() => {
    if (selectedTemplate && selectedClient) {
      setMessageText(resolvedText);
    }
  }, [resolvedText, selectedTemplate, selectedClient]);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tpl = templates.find(t => t.id === templateId);
    if (tpl && selectedClient) {
      const vars = buildTemplateVars(selectedClient, clientPolicy);
      setMessageText(renderTemplate(tpl.message_template, vars));
    } else if (tpl) {
      setMessageText(tpl.message_template);
    }
  };

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    // Template will re-resolve via the useEffect when clientPolicy loads
    if (selectedTemplate) {
      const client = clients.find(c => c.id === clientId);
      const vars = buildTemplateVars(client, null); // policy will load async
      setMessageText(renderTemplate(selectedTemplate.message_template, vars));
    }
  };

  const resetForm = () => {
    setSearch('');
    setSelectedClientId(null);
    setSelectedTemplateId(null);
    setMessageText('');
  };

  const handlePreview = () => {
    if (messageText.trim()) {
      toast.info('Предпросмотр сообщения', {
        description: messageText,
        duration: 8000,
      });
    }
  };

  const handleSend = async (channel: 'whatsapp' | 'telegram') => {
    if (!selectedClient || !messageText.trim()) return;
    setIsSending(true);
    try {
      // Log final message to console for verification
      console.log('[ManualSend] Финальный текст:', messageText);

      if (channel === 'whatsapp') {
        const phone = selectedClient.phone.replace(/\D/g, '');
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`;
        window.open(url, '_blank');
      }

      await onSent({
        client_id: selectedClient.id,
        template_id: selectedTemplate?.id,
        channel,
        message: messageText,
        template_title: selectedTemplate?.title,
      });
      resetForm();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="card-elevated p-5 space-y-4">
        <h3 className="font-semibold text-foreground">Отправить сообщение</h3>

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
                    setSearch(getClientDisplayName(c));
                  }}
                >
                  <span className="font-medium">{getClientDisplayName(c)}</span>
                  <span className="text-muted-foreground ml-2">{maskPhone(c.phone)}</span>
                </button>
              ))}
            </div>
          )}
          {selectedClient && (
            <p className="text-xs text-muted-foreground">
              Выбран: {getClientDisplayName(selectedClient)} — {maskPhone(selectedClient.phone)}
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

        {/* Message */}
        <div className="space-y-2">
          <Label>Сообщение</Label>
          <Textarea
            rows={5}
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            placeholder="Текст сообщения..."
          />
        </div>

        {/* Send buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={!messageText.trim()}
            className="gap-1.5"
          >
            <Eye className="h-4 w-4" />
            Предпросмотр
          </Button>
          {preferredChannel === 'whatsapp' ? (
            <>
              <Button
                onClick={() => handleSend('whatsapp')}
                disabled={!selectedClient || !messageText.trim() || isSending}
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
                <ExternalLink className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSend('telegram')}
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
                onClick={() => handleSend('telegram')}
                disabled={!selectedClient || !messageText.trim() || isSending}
                className="flex-1 gap-2"
              >
                <Send className="h-4 w-4" />
                Telegram
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSend('whatsapp')}
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

      {/* Quick template preview */}
      <div className="card-elevated p-5 space-y-3">
        <h3 className="font-semibold text-foreground">Быстрый выбор шаблона</h3>
        {templates.filter(t => t.is_active).length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет активных шаблонов</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {templates.filter(t => t.is_active).map(t => {
              // Show resolved preview if client is selected
              const previewText = selectedClient
                ? renderTemplate(t.message_template, buildTemplateVars(selectedClient, clientPolicy))
                : t.message_template;
              return (
                <button
                  key={t.id}
                  onClick={() => handleTemplateChange(t.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors text-sm ${
                    selectedTemplateId === t.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <div className="font-medium text-foreground">{t.title}</div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                    {previewText}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
