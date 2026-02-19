import { Client, Policy } from '@/types/crm';
import { Tables } from '@/integrations/supabase/types';

/**
 * Safe client display name — handles any combination of fields.
 * Works with both mapped Client objects and raw DB rows.
 */
export function getClientDisplayName(client: {
  isCompany?: boolean;
  is_company?: boolean;
  companyName?: string;
  company_name?: string | null;
  lastName?: string;
  last_name?: string;
  firstName?: string;
  first_name?: string;
  middleName?: string;
  middle_name?: string | null;
  full_name?: string;
  name?: string;
} | null | undefined): string {
  if (!client) return 'Имя не указано';

  const isCompany = client.isCompany ?? client.is_company ?? false;
  if (isCompany) {
    return client.companyName || client.company_name || 'Компания';
  }

  // Try full_name first (if ever present)
  if ((client as any).full_name) return (client as any).full_name;

  const last = client.lastName || client.last_name || '';
  const first = client.firstName || client.first_name || '';
  const middle = client.middleName || client.middle_name || '';

  const composed = `${last} ${first} ${middle}`.trim();
  if (composed) return composed;

  // Fallback
  if ((client as any).name) return (client as any).name;
  return 'Имя не указано';
}

/**
 * Safe client initials.
 */
export function getClientInitials(client: Parameters<typeof getClientDisplayName>[0]): string {
  if (!client) return '??';
  const isCompany = (client as any).isCompany ?? (client as any).is_company ?? false;
  if (isCompany) {
    const name = (client as any).companyName || (client as any).company_name || '';
    return name.substring(0, 2).toUpperCase() || 'КО';
  }
  const last = (client as any).lastName || (client as any).last_name || '';
  const first = (client as any).firstName || (client as any).first_name || '';
  return `${last[0] || ''}${first[0] || ''}`.toUpperCase() || '??';
}

/**
 * Maps a Supabase `clients` row to the app-level `Client` type.
 */
export function mapDbClientToClient(dbClient: Tables<'clients'>): Client {
  return {
    id: dbClient.id,
    firstName: dbClient.first_name,
    lastName: dbClient.last_name,
    middleName: dbClient.middle_name || undefined,
    companyName: dbClient.company_name || undefined,
    isCompany: dbClient.is_company,
    phone: dbClient.phone,
    email: dbClient.email || undefined,
    birthDate: dbClient.birth_date || undefined,
    passportData: dbClient.passport_data || undefined,
    passportSeries: dbClient.passport_series || undefined,
    passportNumber: dbClient.passport_number || undefined,
    passportIssueDate: dbClient.passport_issue_date || undefined,
    passportIssuedBy: dbClient.passport_issued_by || undefined,
    passportUnitCode: dbClient.passport_unit_code || undefined,
    inn: dbClient.inn || undefined,
    address: dbClient.address || undefined,
    notes: dbClient.notes || undefined,
    createdAt: dbClient.created_at,
    agentId: dbClient.agent_id || '',
  };
}

/**
 * Maps a Supabase `policies` row to the app-level `Policy` type.
 */
export function mapDbPolicyToPolicy(dbPolicy: Tables<'policies'>): Policy {
  return {
    id: dbPolicy.id,
    clientId: dbPolicy.client_id,
    type: dbPolicy.policy_type as Policy['type'],
    policyNumber: dbPolicy.policy_number,
    policySeries: dbPolicy.policy_series || undefined,
    insuranceCompany: dbPolicy.insurance_company,
    startDate: dbPolicy.start_date,
    endDate: dbPolicy.end_date,
    premiumAmount: Number(dbPolicy.premium_amount),
    commissionPercent: Number(dbPolicy.commission_percent),
    commissionAmount: Number(dbPolicy.commission_amount),
    vehicleNumber: dbPolicy.vehicle_number || undefined,
    vehicleModel: dbPolicy.vehicle_model || undefined,
    status: dbPolicy.status as Policy['status'],
    paymentStatus: dbPolicy.payment_status as Policy['paymentStatus'],
    notes: dbPolicy.notes || undefined,
    createdAt: dbPolicy.created_at,
  };
}
