import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Send, Gift, RefreshCcw, Settings, RefreshCw,
  AlertCircle, MessageCircle, Zap, Users, Plus, Trash2, Copy,
  Clock, History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useNotificationTemplates,
  useNotificationLogs,
} from '@/hooks/useNotifications';
import { TemplateFormDialog } from '@/components/notifications/TemplateFormDialog';
import { ManualSendTab } from '@/components/notifications/ManualSendTab';
import { QueueTab } from '@/components/notifications/QueueTab';
import { HistoryTab } from '@/components/notifications/HistoryTab';
import { AutomationTab } from '@/components/notifications/AutomationTab';
import { MassBroadcastTab } from '@/components/notifications/MassBroadcastTab';
import { NotificationDetailSheet, type NotificationLogDetail } from '@/components/notifications/NotificationDetailSheet';
import type { NotificationTemplate, NotificationLog } from '@/hooks/useNotifications';

const SLUG_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  renewal_14: RefreshCcw,
  renewal_7: RefreshCcw,
  birthday: Gift,
  debt_reminder: AlertCircle,
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  max: 'Макс',
  sms: 'СМС',
};

function formatChannels(channel: string) {
  return channel.split(',').map(c => CHANNEL_LABELS[c.trim()] || c.trim()).join(', ');
}

export default function Notifications() {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const {
    templates,
    isLoading: templatesLoading,
    saveTemplate,
    isSaving,
    copyTemplate,
    isCopying,
    deleteTemplate,
    isDeleting,
  } = useNotificationTemplates();
  const { logs, isLoading: logsLoading, createLog, checkReadStatus, isCheckingReadStatus } = useNotificationLogs();

  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<NotificationLogDetail | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const handleLogSelect = (log: NotificationLog) => {
    setSelectedLog(log as NotificationLogDetail);
    setDetailSheetOpen(true);
  };

  const handleRetry = async (log: NotificationLogDetail) => {
    try {
      await createLog({
        client_id: log.client_id,
        channel: log.channel,
        message: log.message,
        template_title: log.template_title || undefined,
        status: 'pending',
        source: 'manual',
      });
      setDetailSheetOpen(false);
    } catch { /* error handled by hook */ }
  };

  const openCreate = () => {
    setEditingTemplate(null);
    setFormDialogOpen(true);
  };

  const openEdit = (template: NotificationTemplate) => {
    setEditingTemplate(template);
    setFormDialogOpen(true);
  };

  const handleSave = (params: {
    id?: string;
    title: string;
    slug: string;
    message_template: string;
    channel: string;
    description: string;
    is_active: boolean;
  }) => {
    saveTemplate(params);
    setFormDialogOpen(false);
    setEditingTemplate(null);
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Уведомления</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Очередь, история и инструменты рассылки
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => navigate('/settings?section=integrations')}>
          <Settings className="h-4 w-4" />
          ⚙️ Настроить каналы
        </Button>
      </div>

      <Tabs defaultValue={can('notify_queue_view') ? 'queue' : can('notify_templates_manage') ? 'templates' : can('notify_manual_send') ? 'manual-send' : can('notify_automation_config') ? 'automation' : 'broadcast'} className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          {/* Group 1: Monitoring */}
          {can('notify_queue_view') && (
          <TabsTrigger value="queue" className="gap-1.5">
            <Clock className="h-4 w-4" />
            Очередь
          </TabsTrigger>
          )}
          {can('notify_queue_view') && (
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" />
            История
          </TabsTrigger>
          )}

          {/* Visual separator */}
          {can('notify_queue_view') && (can('notify_templates_manage') || can('notify_manual_send') || can('notify_automation_config') || can('notify_mass_bulk')) && (
            <Separator orientation="vertical" className="h-6 mx-1" />
          )}

          {/* Group 2: Management */}
          {can('notify_templates_manage') && (
          <TabsTrigger value="templates" className="gap-1.5">
            <MessageCircle className="h-4 w-4" />
            Шаблоны
          </TabsTrigger>
          )}
          {can('notify_manual_send') && (
          <TabsTrigger value="manual-send" className="gap-1.5">
            <Send className="h-4 w-4" />
            Отправить вручную
          </TabsTrigger>
          )}
          {can('notify_automation_config') && (
          <TabsTrigger value="automation" className="gap-1.5">
            <Zap className="h-4 w-4" />
            Автоматизация
          </TabsTrigger>
          )}
          {can('notify_mass_bulk') && (
          <TabsTrigger value="broadcast" className="gap-1.5">
            <Users className="h-4 w-4" />
            Массовая рассылка
          </TabsTrigger>
          )}
        </TabsList>

        {/* Queue Tab */}
        {can('notify_queue_view') && (
        <TabsContent value="queue">
          <QueueTab
            logs={logs}
            isLoading={logsLoading}
            onSelect={handleLogSelect}
            onCheckRead={checkReadStatus}
            isCheckingRead={isCheckingReadStatus}
          />
        </TabsContent>
        )}

        {/* History Tab */}
        {can('notify_queue_view') && (
        <TabsContent value="history">
          <HistoryTab
            logs={logs}
            isLoading={logsLoading}
            onSelect={handleLogSelect}
            onCheckRead={checkReadStatus}
            isCheckingRead={isCheckingReadStatus}
          />
        </TabsContent>
        )}

        {/* Templates Tab */}
        {can('notify_templates_manage') && (
        <TabsContent value="templates">
          <div className="card-elevated">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Шаблоны рассылок</h2>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={openCreate}>
                <Plus className="h-3.5 w-3.5" />
                Добавить
              </Button>
            </div>
            {templatesLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : templates.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  У вас пока нет созданных шаблонов.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Нажмите кнопку «Добавить», чтобы добавить первый.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {templates.map((template) => {
                  const Icon = SLUG_ICONS[template.slug] || MessageCircle;
                  return (
                    <div key={template.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          'p-2.5 rounded-lg shrink-0',
                          template.is_active ? 'bg-primary/10' : 'bg-muted'
                        )}>
                          <Icon className={cn(
                            'h-5 w-5',
                            template.is_active ? 'text-primary' : 'text-muted-foreground'
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="text-sm font-medium text-foreground">
                                {template.title}
                              </h3>
                              <p className="text-xs text-muted-foreground mt-1">
                                {template.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="status-badge status-info text-xs">
                                {formatChannels(template.channel)}
                              </span>
                              <Switch
                                checked={template.is_active}
                                onCheckedChange={(checked) =>
                                  saveTemplate({ id: template.id, title: template.title, slug: template.slug, message_template: template.message_template, channel: template.channel, description: template.description || '', is_active: checked })
                                }
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mt-2">
                            <Button variant="ghost" size="sm" className="text-primary h-7" onClick={() => openEdit(template)}>
                              Редактировать
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 gap-1" disabled={isCopying} onClick={() => copyTemplate(template.id)}>
                              <Copy className="h-3.5 w-3.5" />
                              Копировать
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive h-7" disabled={isDeleting} onClick={() => deleteTemplate(template.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
        )}

        {/* Manual Send Tab */}
        {can('notify_manual_send') && (
        <TabsContent value="manual-send">
          <ManualSendTab templates={templates} onSent={createLog} />
        </TabsContent>
        )}

        {/* Automation Tab */}
        {can('notify_automation_config') && (
        <TabsContent value="automation">
          <AutomationTab templates={templates} />
        </TabsContent>
        )}

        {/* Broadcast Tab */}
        {can('notify_mass_bulk') && (
        <TabsContent value="broadcast">
          <MassBroadcastTab templates={templates} onLogCreated={createLog} />
        </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      <TemplateFormDialog
        template={editingTemplate}
        open={formDialogOpen}
        onOpenChange={(o) => {
          setFormDialogOpen(o);
          if (!o) setEditingTemplate(null);
        }}
        onSave={handleSave}
        isSaving={isSaving}
      />

      <NotificationDetailSheet
        log={selectedLog}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onRetry={handleRetry}
      />
    </div>
  );
}
