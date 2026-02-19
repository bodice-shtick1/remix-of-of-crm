import { useEffect, useState, useRef, useCallback } from 'react';
import { Unlock, X } from 'lucide-react';
import { useAuditLogConfig } from '@/hooks/useAuditLogConfig';
import { useAuth } from '@/hooks/useAuth';

const DISMISS_KEY = 'bypass_banner_dismissed';

export function BypassStatusBanner() {
  const { userRole } = useAuth();
  const { getBypassUntil, isBypassActive } = useAuditLogConfig();
  const [, setTick] = useState(0);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1');

  // Drag state
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const bannerRef = useRef<HTMLDivElement>(null);

  const bypassUntil = getBypassUntil();
  const active = isBypassActive();

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, [active]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const rect = bannerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  if (!active || userRole !== 'admin' || dismissed) return null;

  const until = new Date(bypassUntil!);
  const formatTime = (d: Date) =>
    d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (d: Date) =>
    d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });

  const isToday = until.toDateString() === new Date().toDateString();
  const label = isToday
    ? `до ${formatTime(until)}`
    : `до ${formatDate(until)} ${formatTime(until)}`;

  const isFloating = pos !== null;

  const style: React.CSSProperties = isFloating
    ? { position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999 }
    : {};

  return (
    <div
      ref={bannerRef}
      onMouseDown={handleMouseDown}
      style={style}
      className={`flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-xs font-medium whitespace-nowrap select-none ${
        dragging ? 'cursor-grabbing shadow-lg' : 'cursor-grab'
      } text-amber-700 dark:text-amber-400`}
    >
      <Unlock className="h-3.5 w-3.5 shrink-0" />
      <span>🔓 База открыта ({label})</span>
      <button
        onClick={handleDismiss}
        className="ml-1 p-0.5 rounded hover:bg-amber-500/20 transition-colors"
        title="Скрыть до следующего входа"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
