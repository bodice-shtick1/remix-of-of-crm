import { useCallback } from 'react';
import { useMessengerSettings, type ChannelType, type WhatsAppConfig, type TelegramConfig, type MaxConfig } from './useMessengerSettings';

export interface ChannelValidationResult {
  isConfigured: boolean;
  isWhatsAppWeb: boolean;
  errorReason: string | null;
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  max: 'Макс',
  sms: 'СМС',
};

/**
 * Hook to validate whether a messenger channel is properly configured
 * before sending broadcasts or trigger notifications.
 */
export function useChannelValidation() {
  const { settings, isLoading } = useMessengerSettings();

  const validateChannel = useCallback((channel: string): ChannelValidationResult => {
    const channelKey = channel as ChannelType;
    const setting = settings.find(s => s.channel === channelKey);
    const label = CHANNEL_LABELS[channel] || channel;

    // No setting at all
    if (!setting) {
      return {
        isConfigured: false,
        isWhatsAppWeb: false,
        errorReason: `Канал ${label} не настроен. Перейдите в настройки мессенджеров.`,
      };
    }

    // Not active
    if (!setting.is_active) {
      return {
        isConfigured: false,
        isWhatsAppWeb: false,
        errorReason: `Канал ${label} отключён. Активируйте его в настройках мессенджеров.`,
      };
    }

    // Channel-specific validation
    if (channel === 'whatsapp') {
      const config = setting.config as WhatsAppConfig;
      if (config.mode === 'business_api' && !config.api_key) {
        return {
          isConfigured: false,
          isWhatsAppWeb: false,
          errorReason: `Missing WhatsApp Business API key`,
        };
      }
      // WhatsApp Web mode — configured but needs manual confirmation
      if (!config.mode || config.mode === 'web') {
        return {
          isConfigured: true,
          isWhatsAppWeb: true,
          errorReason: null,
        };
      }
      return { isConfigured: true, isWhatsAppWeb: false, errorReason: null };
    }

    if (channel === 'telegram') {
      const config = setting.config as TelegramConfig;
      if (!config.bot_token) {
        return {
          isConfigured: false,
          isWhatsAppWeb: false,
          errorReason: `Missing Telegram Token`,
        };
      }
      return { isConfigured: true, isWhatsAppWeb: false, errorReason: null };
    }

    if (channel === 'max') {
      const config = setting.config as MaxConfig;
      if (!config.api_key) {
        return {
          isConfigured: false,
          isWhatsAppWeb: false,
          errorReason: `Missing Max API key`,
        };
      }
      return { isConfigured: true, isWhatsAppWeb: false, errorReason: null };
    }

    // SMS or unknown — allow by default
    return { isConfigured: true, isWhatsAppWeb: false, errorReason: null };
  }, [settings]);

  /** Check if ANY channel is configured and active */
  const hasAnyActiveChannel = useCallback((): boolean => {
    return settings.some(s => {
      if (!s.is_active) return false;
      const result = validateChannel(s.channel);
      return result.isConfigured;
    });
  }, [settings, validateChannel]);

  return { validateChannel, hasAnyActiveChannel, isLoading };
}
