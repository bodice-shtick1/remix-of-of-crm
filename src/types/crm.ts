export type InsuranceType = 'ОСАГО' | 'КАСКО' | 'Имущество' | 'Жизнь' | 'ДМС' | 'НС' | 'ДОМ' | 'Другое';

export type PaymentStatus = 'pending' | 'paid' | 'transferred' | 'commission_received';

export type PolicyStatus = 'active' | 'expiring_soon' | 'expired' | 'renewed';

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'sbp';

export type DebtStatus = 'paid' | 'pending';

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  companyName?: string;
  isCompany: boolean;
  phone: string;
  email?: string;
  birthDate?: string;
  passportData?: string;
  passportSeries?: string;
  passportNumber?: string;
  passportIssueDate?: string;
  passportIssuedBy?: string;
  passportUnitCode?: string;
  inn?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  agentId: string;
}

export interface Policy {
  id: string;
  clientId: string;
  type: InsuranceType;
  policyNumber: string;
  policySeries?: string;
  insuranceCompany: string;
  startDate: string;
  endDate: string;
  premiumAmount: number;
  commissionPercent: number;
  commissionAmount: number;
  vehicleNumber?: string;
  vehicleModel?: string;
  status: PolicyStatus;
  paymentStatus: PaymentStatus;
  documents?: string[];
  notes?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  policyId: string;
  clientId: string;
  amount: number;
  paymentType: PaymentMethod;
  status: PaymentStatus;
  paidAt?: string;
  transferredToInsurer?: string;
  commissionReceivedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  type: 'renewal' | 'birthday' | 'call' | 'payment' | 'custom';
  title: string;
  description?: string;
  clientId?: string;
  policyId?: string;
  dueDate: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface DashboardStats {
  totalClients: number;
  activePolicies: number;
  expiringThisMonth: number;
  monthlyRevenue: number;
  pendingPayments: number;
}

// Типы для регистрации продажи
export interface InsuranceProduct {
  id: string;
  type: InsuranceType;
  series: string;
  number: string;
  insuranceCompany: string;
  startDate: string;
  endDate: string;
  premiumAmount: number;
  commissionPercent: number;
}

export interface AdditionalService {
  id: string;
  name: string;
  quantity: number;
  price: number;
  amount: number;
}

export type SaleItemType = 'insurance' | 'service';

export interface SaleItem {
  id: string;
  type: SaleItemType;
  insuranceProduct?: InsuranceProduct;
  service?: AdditionalService;
  amount: number;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
}

export interface Sale {
  id: string;
  uid: string;
  clientId: string;
  items: SaleItem[];
  totalAmount: number;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  bankId?: string | null;
  companyId?: string | null;
  contractId?: string | null;
  isInstallment: boolean;
  installmentDueDate?: string | null;
  installmentPaymentsCount?: number | null;
  roundingAmount: number;
  debtStatus: DebtStatus;
  status: 'draft' | 'completed' | 'cancelled';
  completedAt?: string | null;
  auditLog: AuditLogEntry[];
  createdAt: string;
  createdBy: string;
}

export interface ClientVisit {
  date: string;
  services: string[];
  amount: number;
}

// Справочники
export interface ServiceCatalog {
  id: string;
  name: string;
  defaultPrice: number;
  category: 'inspection' | 'documents' | 'other';
}
