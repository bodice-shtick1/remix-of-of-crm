-- Add task_id column to chat_messages for linking messages to tasks
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_task_id ON public.chat_messages(task_id)
WHERE task_id IS NOT NULL;