import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface WatermarkOverlayProps {
  enabled: boolean;
}

export function WatermarkOverlay({ enabled }: WatermarkOverlayProps) {
  const { user } = useAuth();
  const [fullName, setFullName] = useState<string>('');
  const [ip, setIp] = useState<string>('');

  useEffect(() => {
    if (!user || !enabled) return;

    // Get profile name
    supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setFullName(data?.full_name || user.email || 'Unknown');
      });

    // Get IP address
    fetch('https://api.ipify.org?format=json')
      .then(r => r.json())
      .then(data => setIp(data.ip || ''))
      .catch(() => setIp(''));
  }, [user, enabled]);

  const userId = user?.id?.slice(0, 8) || '';
  const text = `${fullName} | ${userId} | ${ip}`;

  const svgPattern = useMemo(() => {
    if (!text || !enabled) return '';

    const encoded = encodeURIComponent(text);
    // Create a repeating rotated text pattern
    return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='250'%3E%3Ctext x='50%25' y='50%25' font-size='14' fill='%23888888' fill-opacity='0.04' text-anchor='middle' dominant-baseline='middle' transform='rotate(-45, 200, 125)' font-family='sans-serif'%3E${encoded}%3C/text%3E%3C/svg%3E")`;
  }, [text, enabled]);

  if (!enabled || !user) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        pointerEvents: 'none',
        backgroundImage: svgPattern,
        backgroundRepeat: 'repeat',
      }}
    />
  );
}
