/**
 * PND Consent (ФЗ-152) — thin wrapper around documentTemplates.
 * Keeps backward-compatible exports for existing consumers.
 */
import { supabase } from '@/integrations/supabase/client';
import { generatePndHTML, generatePndBodyFragment, printDocumentHTML } from '@/lib/documentTemplates';
import type { PndTemplateData } from '@/lib/documentTemplates';

// Re-export types and generators for backward compatibility
export type PndConsentData = PndTemplateData;
export const generatePndConsentHTML = generatePndBodyFragment;

/**
 * Open a print window with PND consent
 */
export function printPndConsent(data: PndConsentData): void {
  const html = generatePndHTML(data);
  printDocumentHTML(html);
}

/**
 * Mark client as PND-signed in the database
 */
export async function markPndSigned(clientId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  await supabase.from('clients').update({
    is_pnd_signed: true,
    pnd_signed_date: today,
  } as any).eq('id', clientId);
}
