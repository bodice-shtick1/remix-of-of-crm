
-- Add telegram_id column to clients table for caching Telegram user IDs
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS telegram_id text;

-- Index for quick lookup by telegram_id
CREATE INDEX IF NOT EXISTS idx_clients_telegram_id ON public.clients (telegram_id) WHERE telegram_id IS NOT NULL;
