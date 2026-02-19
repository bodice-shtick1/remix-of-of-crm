import { cn } from '@/lib/utils';

interface IconProps {
  className?: string;
  size?: number;
}

export function WhatsAppIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      fill="none"
    >
      <path
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
        fill="#25D366"
      />
      <path
        d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.96 7.96 0 01-4.11-1.14l-.29-.174-3.01.79.8-2.93-.19-.3A7.96 7.96 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"
        fill="#25D366"
      />
    </svg>
  );
}

export function TelegramIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      fill="none"
    >
      <circle cx="12" cy="12" r="10" fill="#0088CC" />
      <path
        d="M7.5 12.5l2.1 1.9 4.9-5.4"
        stroke="white"
        strokeWidth="0"
        fill="none"
      />
      <path
        d="M6.5 11.5l1.8.7 1.2 3.8.9-1.7 2.8 2.1 3.3-9.9-10 4zm4.1 2.1l-.3 1.8-.8-2.6 7-4.7-5.9 5.5z"
        fill="white"
      />
    </svg>
  );
}

export function MaxIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      viewBox="0 0 1000 1000"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id="max-grad-a">
          <stop offset="0" stopColor="#4cf" />
          <stop offset=".662" stopColor="#53e" />
          <stop offset="1" stopColor="#93d" />
        </linearGradient>
        <linearGradient id="max-grad-c" x1="117.847" x2="1000" y1="760.536" y2="500" gradientUnits="userSpaceOnUse" xlinkHref="#max-grad-a" />
      </defs>
      <rect width="1000" height="1000" fill="url(#max-grad-c)" ry="249.681" />
      <path
        fill="#fff"
        fillRule="evenodd"
        d="M508.211 878.328c-75.007 0-109.864-10.95-170.453-54.75-38.325 49.275-159.686 87.783-164.979 21.9 0-49.456-10.95-91.248-23.36-136.873-14.782-56.21-31.572-118.807-31.572-209.508 0-216.626 177.754-379.597 388.357-379.597 210.785 0 375.947 171.001 375.947 381.604.707 207.346-166.595 376.118-373.94 377.224m3.103-571.585c-102.564-5.292-182.499 65.7-200.201 177.024-14.6 92.162 11.315 204.398 33.397 210.238 10.585 2.555 37.23-18.98 53.837-35.587a189.8 189.8 0 0 0 92.71 33.032c106.273 5.112 197.08-75.794 204.215-181.95 4.154-106.382-77.67-196.486-183.958-202.574Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function SmsIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      fill="none"
    >
      <rect x="5" y="3" width="14" height="18" rx="2" fill="currentColor" opacity="0.6" />
      <rect x="8" y="16" width="8" height="1.5" rx="0.75" fill="white" />
    </svg>
  );
}

/** Renders the appropriate messenger icon for a given channel */
export function ChannelIcon({ channel, size = 14, className }: { channel: string; size?: number; className?: string }) {
  switch (channel) {
    case 'whatsapp':
    case 'whatsapp_web':
      return <WhatsAppIcon size={size} className={className} />;
    case 'telegram':
      return <TelegramIcon size={size} className={className} />;
    case 'max':
    case 'max_web':
      return <MaxIcon size={size} className={className} />;
    case 'sms':
      return <SmsIcon size={size} className={className} />;
    default:
      return <span className="text-[10px]">💬</span>;
  }
}
