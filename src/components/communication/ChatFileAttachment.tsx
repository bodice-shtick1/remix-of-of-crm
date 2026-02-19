import { useState } from 'react';
import { FileText, Download, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatFileAttachmentProps {
  fileUrl: string;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  isMe: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function ChatFileAttachment({ fileUrl, fileName, fileType, fileSize, isMe }: ChatFileAttachmentProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isImage = fileType?.startsWith('image/');

  if (isImage) {
    return (
      <>
        <div
          className={cn(
            'chat-file-image-wrapper mt-1 cursor-pointer overflow-hidden',
            'rounded-lg border border-border/20 hover:opacity-90 transition-opacity'
          )}
          onClick={() => setLightboxOpen(true)}
        >
          <img
            src={fileUrl}
            alt={fileName || 'Изображение'}
            className="max-w-[240px] max-h-[200px] object-cover w-full block chat-image-preview"
            loading="lazy"
          />
        </div>
        {lightboxOpen && (
          <div
            className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setLightboxOpen(false)}
          >
            <img
              src={fileUrl}
              alt={fileName || 'Изображение'}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </>
    );
  }

  // Document card
  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-2.5 p-2.5 mt-1 rounded-lg transition-colors cursor-pointer chat-file-card',
        isMe
          ? 'bg-primary-foreground/10 hover:bg-primary-foreground/15 border border-primary-foreground/20'
          : 'bg-muted hover:bg-muted/80 border border-border/30'
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={cn(
        'h-9 w-9 rounded-md flex items-center justify-center shrink-0',
        isMe ? 'bg-primary-foreground/20' : 'bg-background'
      )}>
        <FileText className={cn('h-5 w-5', isMe ? 'text-primary-foreground/70' : 'text-primary')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-medium truncate', isMe ? 'text-primary-foreground' : 'text-foreground')}>
          {fileName || 'Файл'}
        </p>
        <p className={cn('text-[10px]', isMe ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
          {fileSize ? formatBytes(fileSize) : fileType || 'Документ'}
        </p>
      </div>
      <Download className={cn('h-4 w-4 shrink-0', isMe ? 'text-primary-foreground/60' : 'text-muted-foreground')} />
    </a>
  );
}
