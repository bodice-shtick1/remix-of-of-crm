// Service name constants used for document form detection
export const DKP_SERVICE_NAME = 'Составление ДКП ТС';
export const EURO_SERVICE_NAME = 'Оформление Европротокола';

export const SYSTEM_SERVICE_NAMES = [DKP_SERVICE_NAME, EURO_SERVICE_NAME] as const;

export function isSystemService(name: string): boolean {
  return SYSTEM_SERVICE_NAMES.includes(name as any);
}
