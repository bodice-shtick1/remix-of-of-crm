/**
 * Shared template engine for notification messages.
 * Replaces {{variable}} tags with real client/policy data.
 */

export interface TemplateVars {
  customer_name?: string;
  name?: string;
  fio?: string;
  policy?: string;
  policy_number?: string;
  car?: string;
  auto?: string;
  plate?: string;
  end_date?: string;
  debt?: string;
  due_date?: string;
  product?: string;
  car_brand?: string;
  [key: string]: string | undefined;
}

/**
 * Format a date string (YYYY-MM-DD) into DD.MM.YYYY
 */
export function formatDateRu(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Format a plate number into a readable format: А 000 АА 77
 */
export function formatPlate(plate: string | null | undefined): string {
  if (!plate) return '';
  const clean = plate.replace(/\s+/g, '').toUpperCase();
  // Match Russian plate pattern: letter + 3 digits + 2 letters + 2-3 digit region
  const match = clean.match(/^([А-ЯA-Z])(\d{3})([А-ЯA-Z]{2})(\d{2,3})$/);
  if (match) {
    return `${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
  }
  return plate;
}

/**
 * Build template variables from client and policy data.
 */
export function buildTemplateVars(
  client?: {
    first_name?: string;
    last_name?: string;
    middle_name?: string | null;
  } | null,
  policy?: {
    policy_type?: string;
    policy_series?: string | null;
    policy_number?: string;
    vehicle_model?: string | null;
    vehicle_number?: string | null;
    end_date?: string;
  } | null,
): TemplateVars {
  const firstName = client?.first_name || '';
  const lastName = client?.last_name || '';
  const middleName = client?.middle_name || '';
  const fullName = [lastName, firstName, middleName].filter(Boolean).join(' ');

  const policyLabel = policy
    ? [policy.policy_type, policy.policy_series, policy.policy_number].filter(Boolean).join(' ')
    : '';

  const car = policy?.vehicle_model || '';
  const plate = formatPlate(policy?.vehicle_number);
  const endDate = formatDateRu(policy?.end_date);

  return {
    customer_name: fullName,
    name: firstName,
    fio: fullName,
    policy: policyLabel,
    policy_number: policy?.policy_number || '',
    product: policy?.policy_type || '',
    car,
    auto: car,
    car_brand: car,
    plate,
    end_date: endDate,
    debt: '0',
    due_date: '',
  };
}

/**
 * Replace all {{variable}} tags in a template with values from vars.
 * Unknown or empty variables are replaced with empty string.
 */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = vars[key];
    return value != null ? value : '';
  });
}
