import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BookOpen, Terminal, Key, Server } from 'lucide-react';

interface WhatsAppSetupInstructionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhatsAppSetupInstructions({ open, onOpenChange }: WhatsAppSetupInstructionsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Инструкция по запуску WhatsApp Web Bridge
          </DialogTitle>
          <DialogDescription>
            Пошаговое руководство по настройке интеграции WhatsApp Web
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Step 1 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
              Как это работает
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed pl-8">
              CRM использует Edge Function <code className="bg-muted px-1 rounded text-[11px]">whatsapp-bridge</code> как API-шлюз.
              При нажатии «Сгенерировать QR-код» функция создаёт QR и ожидает сканирования.
              После успешного сканирования данные сессии (auth_payload) сохраняются в базу данных
              в таблицу <code className="bg-muted px-1 rounded text-[11px]">messenger_settings</code>.
            </p>
          </section>

          {/* Step 2 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
              <Server className="h-3.5 w-3.5" />
              Edge Function уже развёрнута
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed pl-8">
              Функция <code className="bg-muted px-1 rounded text-[11px]">whatsapp-bridge</code> автоматически развёрнута в вашем проекте.
              Она обрабатывает действия: генерация QR, сохранение сессии, проверка статуса, выход и отправка сообщений.
            </p>
          </section>

          {/* Step 3 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
              <Key className="h-3.5 w-3.5" />
              Секреты (автоматически)
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed pl-8">
              Следующие секреты уже настроены автоматически и не требуют дополнительных действий:
            </p>
            <div className="pl-8 space-y-1">
              <code className="block text-[11px] bg-muted p-2 rounded font-mono">
                SUPABASE_URL — URL проекта<br />
                SUPABASE_ANON_KEY — Публичный ключ<br />
                SUPABASE_SERVICE_ROLE_KEY — Сервисный ключ
              </code>
            </div>
          </section>

          {/* Step 4 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">4</span>
              <Terminal className="h-3.5 w-3.5" />
              Companion-сервер Baileys (опционально)
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed pl-8">
              Для полноценной работы WhatsApp Web (реальная отправка сообщений, приём входящих) нужен
              внешний Node.js сервер с библиотекой <strong>Baileys</strong>. Он должен:
            </p>
            <ul className="text-xs text-muted-foreground pl-12 space-y-1 list-disc">
              <li>Запускать WebSocket-соединение с серверами WhatsApp</li>
              <li>Генерировать QR-код для привязки устройства</li>
              <li>Вызывать <code className="bg-muted px-1 rounded text-[11px]">save_session</code> в Edge Function после успешного сканирования</li>
              <li>Пересылать входящие сообщения через вебхук в CRM</li>
            </ul>
          </section>

          {/* Step 5 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">5</span>
              Хранение сессии
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed pl-8">
              После сканирования QR-кода данные сессии (auth_payload) записываются в таблицу{' '}
              <code className="bg-muted px-1 rounded text-[11px]">messenger_settings</code> с полем{' '}
              <code className="bg-muted px-1 rounded text-[11px]">channel = 'whatsapp_web'</code>.
              Сессия используется для авторизации при отправке сообщений.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
