import React, { useState } from 'react';
import { WhatsAppIcon, TelegramIcon, MaxIcon } from '@/components/icons/MessengerIcons';
import { useMessengerSettings } from '@/hooks/useMessengerSettings';
import { MessengerChannelCard } from '@/components/notifications/MessengerChannelCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown } from 'lucide-react';

const ALL_CHANNELS = ['whatsapp_web', 'whatsapp', 'telegram', 'max', 'max_web'] as const;

const MessengerSettings = React.memo(function MessengerSettings() {
  const { isLoading, getChannelSetting } = useMessengerSettings();
  const [openItems, setOpenItems] = useState<string[]>([]);

  const allExpanded = openItems.length === ALL_CHANNELS.length;

  const toggleAll = () => {
    setOpenItems(allExpanded ? [] : [...ALL_CHANNELS]);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Настройка мессенджеров</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Подключите каналы для автоматических рассылок уведомлений клиентам
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={toggleAll} className="gap-2 shrink-0">
          <ChevronsUpDown className="h-4 w-4" />
          {allExpanded ? 'Свернуть все' : 'Развернуть все'}
        </Button>
      </div>

      <Accordion
        type="multiple"
        value={openItems}
        onValueChange={setOpenItems}
        className="space-y-4"
      >
        <MessengerChannelCard
          channel="whatsapp_web"
          title="WhatsApp Web (Личный аккаунт)"
          description="Подключение через QR-код — как WhatsApp Web на компьютере"
          icon={<WhatsAppIcon size={24} />}
          accentClass="bg-green-50/50"
          existing={getChannelSetting('whatsapp_web')}
          onCollapse={() => setOpenItems(prev => prev.filter(i => i !== 'whatsapp_web'))}
        />

        <MessengerChannelCard
          channel="whatsapp"
          title="WhatsApp"
          description="Рассылка через WhatsApp Web или Business API"
          icon={<WhatsAppIcon size={24} />}
          accentClass="bg-green-50/50"
          existing={getChannelSetting('whatsapp')}
        />

        <MessengerChannelCard
          channel="telegram"
          title="Telegram"
          description="Уведомления через Telegram-бота"
          icon={<TelegramIcon size={24} />}
          accentClass="bg-blue-50/50"
          existing={getChannelSetting('telegram')}
        />

        <MessengerChannelCard
          channel="max"
          title="Макс (Bot API)"
          description="Рассылка через официальный Bot API MAX"
          icon={<MaxIcon size={24} />}
          accentClass="bg-violet-50/50"
          existing={getChannelSetting('max')}
        />

        <MessengerChannelCard
          channel="max_web"
          title="MAX Web Bridge"
          description="Отправка от вашего аккаунта через веб-сессию"
          icon={<MaxIcon size={24} />}
          accentClass="bg-purple-50/50"
          existing={getChannelSetting('max_web')}
          onCollapse={() => setOpenItems(prev => prev.filter(i => i !== 'max_web'))}
        />
      </Accordion>
    </div>
  );
});

export default MessengerSettings;
