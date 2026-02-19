import { useState, useRef, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { TeamMember } from '@/hooks/useInternalChat';

interface ChatMentionInputProps {
  value: string;
  onChange: (value: string, mentionedIds: string[]) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  teamMembers: TeamMember[];
  compact?: boolean;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function ChatMentionInput({
  value, onChange, onSend, placeholder, disabled, className, teamMembers, compact = false,
}: ChatMentionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionAnchorIndex, setMentionAnchorIndex] = useState<number>(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Map: displayName → userId (tracks which @names are in the text)
  const mentionedNamesRef = useRef<Map<string, string>>(new Map());

  const filteredMembers = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return teamMembers
      .filter(m => {
        const name = (m.full_name || m.email || '').toLowerCase();
        return name.includes(q);
      })
      .slice(0, 6);
  }, [mentionQuery, teamMembers]);

  const handleChange = useCallback((newVal: string) => {
    const input = inputRef.current;
    const cursor = input?.selectionStart ?? newVal.length;
    const before = newVal.slice(0, cursor);

    // Detect last @ before cursor
    const atIdx = before.lastIndexOf('@');
    if (atIdx !== -1) {
      const query = before.slice(atIdx + 1);
      if (query.length <= 30 && !query.startsWith(' ')) {
        setMentionQuery(query);
        setMentionAnchorIndex(atIdx);
        setSelectedIndex(0);
      } else {
        setMentionQuery(null);
      }
    } else {
      setMentionQuery(null);
    }

    // Keep only mentioned IDs whose @Name still appears in the new text
    const current = new Map<string, string>();
    for (const [name, id] of mentionedNamesRef.current) {
      if (newVal.includes(`@${name}`)) current.set(name, id);
    }
    mentionedNamesRef.current = current;

    onChange(newVal, Array.from(current.values()));
  }, [onChange]);

  const selectMember = useCallback((member: TeamMember) => {
    const displayName = member.full_name || member.email || '';
    const cursor = inputRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, mentionAnchorIndex);
    const after = value.slice(cursor);
    const newVal = `${before}@${displayName} ${after}`;

    mentionedNamesRef.current.set(displayName, member.user_id);
    setMentionQuery(null);

    onChange(newVal, Array.from(mentionedNamesRef.current.values()));

    // Restore focus and move cursor after inserted mention
    requestAnimationFrame(() => {
      if (inputRef.current) {
        const pos = before.length + displayName.length + 2;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(pos, pos);
      }
    });
  }, [value, mentionAnchorIndex, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => (i + 1) % filteredMembers.length); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIndex(i => (i - 1 + filteredMembers.length) % filteredMembers.length); return; }
      if (e.key === 'Enter')     { e.preventDefault(); selectMember(filteredMembers[selectedIndex]); return; }
      if (e.key === 'Escape')    { setMentionQuery(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const h = compact ? 'h-8 text-xs' : 'h-9 text-[13px]';

  return (
    <div className="relative flex-1 min-w-0">
      {/* Mention dropdown */}
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <div className="chat-mention-dropdown absolute bottom-full left-0 mb-1.5 w-56 max-h-52 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg z-50">
          <div className="px-2 py-1 border-b border-border/50">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Упоминание</span>
          </div>
          {filteredMembers.map((m, i) => (
            <button
              key={m.user_id}
              onMouseDown={(e) => { e.preventDefault(); selectMember(m); }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors',
                i === selectedIndex ? 'bg-primary/10' : 'hover:bg-muted/60'
              )}
            >
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-[10px] font-bold text-primary">
                {(m.full_name || m.email || '?').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium truncate leading-tight">{m.full_name || m.email}</p>
                {m.custom_role_name && (
                  <p className="text-[10px] text-muted-foreground truncate leading-tight">
                    {m.custom_role_name === 'admin' ? 'Администратор' : m.custom_role_name}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        value={value}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'flex w-full rounded-md border border-input bg-background px-3 py-1 shadow-sm transition-colors',
          'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          h,
          className
        )}
      />
    </div>
  );
}

// ── Helper: render text with highlighted @mentions ──────────────────────────
export function renderMentionText(
  text: string,
  teamMembers: TeamMember[],
  isMe: boolean
): React.ReactNode {
  if (!text || !text.includes('@')) return text;

  const mentionedMembers = teamMembers.filter(
    m => m.full_name && text.includes(`@${m.full_name}`)
  );
  if (!mentionedMembers.length) return text;

  // Sort longest names first to avoid partial matches
  const sorted = [...mentionedMembers].sort(
    (a, b) => (b.full_name?.length || 0) - (a.full_name?.length || 0)
  );

  const pattern = sorted.map(m => `@${escapeRegex(m.full_name!)}`).join('|');
  const regex = new RegExp(`(${pattern})`, 'g');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        const member = sorted.find(m => `@${m.full_name}` === part);
        if (member) {
          return (
            <span
              key={i}
              className={cn('chat-mention', isMe && 'chat-mention-mine')}
              title={member.full_name || ''}
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
