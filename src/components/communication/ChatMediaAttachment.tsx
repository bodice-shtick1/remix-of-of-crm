import React, { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, Image, Mic, FileText, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MediaAttachment {
  file: File;
  previewUrl: string;
  mediaType: 'photo' | 'voice' | 'audio' | 'video' | 'document';
  storageUrl?: string;
}

interface ChatMediaAttachmentProps {
  onAttach: (attachment: { mediaUrl: string; mediaType: string; fileName: string }) => void;
  disabled?: boolean;
}

function detectMediaType(file: File): MediaAttachment['mediaType'] {
  if (file.type.startsWith('image/')) return 'photo';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) {
    if (file.type.includes('ogg') || file.name.endsWith('.ogg')) return 'voice';
    return 'audio';
  }
  return 'document';
}

export function ChatMediaAttachment({ onAttach, disabled }: ChatMediaAttachmentProps) {
  const [attachment, setAttachment] = useState<MediaAttachment | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error('Файл слишком большой (макс. 50 МБ)');
      return;
    }

    const mediaType = detectMediaType(file);
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';

    setAttachment({ file, previewUrl, mediaType });
    setMenuOpen(false);
    
    // Upload immediately
    uploadAndAttach(file, mediaType);
  }, []);

  const uploadAndAttach = async (file: File, mediaType: string) => {
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const fileName = `outgoing_${Date.now()}.${ext}`;
      const filePath = `telegram/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      onAttach({
        mediaUrl: urlData.publicUrl,
        mediaType,
        fileName: file.name,
      });

      // Clear attachment after successful send trigger
      setAttachment(null);
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Ошибка загрузки файла');
    } finally {
      setIsUploading(false);
    }
  };

  const clearAttachment = () => {
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
    setAttachment(null);
  };

  return (
    <div className="relative">
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Attachment preview */}
      {attachment && (
        <div className="mb-2 p-2 bg-muted/50 rounded-lg flex items-center gap-2">
          {attachment.previewUrl ? (
            <img src={attachment.previewUrl} alt="" className="h-12 w-12 object-cover rounded" />
          ) : (
            <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{attachment.file.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {(attachment.file.size / 1024).toFixed(0)} КБ • {attachment.mediaType}
            </p>
          </div>
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearAttachment}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      {/* Attachment button */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={disabled || isUploading}
          onClick={() => setMenuOpen(!menuOpen)}
          title="Прикрепить файл"
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </Button>

        {menuOpen && (
          <div className="absolute bottom-full left-0 mb-1 bg-popover border border-border rounded-lg shadow-lg py-1 w-44 z-10">
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
              onClick={() => { imageInputRef.current?.click(); }}
            >
              <Image className="h-4 w-4 text-primary" />
              Фото
            </button>
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = 'audio/*';
                  fileInputRef.current.click();
                }
              }}
            >
              <Mic className="h-4 w-4 text-primary" />
              Аудио / Голосовое
            </button>
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = '*/*';
                  fileInputRef.current.click();
                }
              }}
            >
              <FileText className="h-4 w-4 text-primary" />
              Документ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
