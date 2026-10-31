export type CurrencyCode =
  | 'INR'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'AED'
  | 'SGD'
  | 'CAD'
  | 'AUD';

export type PurchaseCategory =
  | 'electronics'
  | 'appliance'
  | 'apparel'
  | 'home'
  | 'service_deposit'
  | 'other';

export type PurchaseType = 'purchase' | 'deposit';
export type PolicySource = 'user_estimate' | 'seller_verified';
export type WarrantyUnit = 'days' | 'months' | 'years';

export interface ProofFileMeta {
  fileName: string;
  fileSize: number;
  fileType: string;
  locationNote: string;
  dataUrl: string;
  attachedAt: string;
}

export interface PurchaseRecord {
  id: string;
  isSample: boolean;
  productName: string;
  seller: string;
  category: PurchaseCategory;
  purchaseType: PurchaseType;
  purchaseDate: string;
  amount: number;
  currency?: CurrencyCode;
  receiptRef: string;
  hasReturnWindow: boolean;
  returnDurationDays: number | null;
  returnExactDate: string;
  returnPolicySource: PolicySource;
  hasWarranty: boolean;
  warrantyDurationValue: number | null;
  warrantyDurationUnit: WarrantyUnit;
  warrantyExactDate: string;
  warrantyPolicySource: PolicySource;
  hasDeposit: boolean;
  depositDueDate: string;
  depositCondition: string;
  proofFile: ProofFileMeta | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type DeadlineActionState =
  | 'needs_action'
  | 'in_progress'
  | 'completed'
  | 'not_applicable';

export interface DeadlineMetaEntry {
  actionState: DeadlineActionState;
  prepDate: string;
  userNote: string;
  updatedAt: string;
}

export type DeadlineCategory = 'return' | 'warranty' | 'refund' | 'deposit';

export interface CustomDeadlineRecord {
  id: string;
  isSample: boolean;
  type: DeadlineCategory;
  title: string;
  seller: string;
  startDate: string;
  dueDate: string;
  amount: number;
  currency?: CurrencyCode;
  receiptRef: string;
  policySource: PolicySource;
  notes: string;
}

export interface DerivedDeadline {
  id: string;
  sourceKind: 'purchase' | 'claim' | 'custom';
  purchaseId: string;
  claimId: string;
  customId: string;
  isSample: boolean;
  type: DeadlineCategory;
  typeLabel: string;
  title: string;
  seller: string;
  amount: number;
  currency: CurrencyCode;
  startDate: string;
  dueDate: string | null;
  daysRemaining: number | null;
  progressPct: number;
  policySource: PolicySource;
  basisText: string;
  receiptRef: string;
  missingReasons: string[];
  actionState: DeadlineActionState;
  prepDate: string;
  prepDaysRemaining: number | null;
  userNote: string;
}

export type ClaimType = 'refund' | 'return' | 'repair' | 'replacement' | 'deposit';
export type ClaimStatus =
  | 'draft'
  | 'submitted'
  | 'awaiting_response'
  | 'resolved'
  | 'rejected'
  | 'closed';
export type LetterTone = 'polite_standard' | 'firm_followup' | 'clarification_request';

export interface EvidenceChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface ClaimHistoryEntry {
  id: string;
  date: string;
  note: string;
}

export interface ClaimRecord {
  id: string;
  isSample: boolean;
  purchaseId: string;
  claimType: ClaimType;
  itemSummary: string;
  seller: string;
  purchaseDate: string;
  receiptRef: string;
  referenceNumber: string;
  dateSubmitted: string;
  responseDueDate: string;
  status: ClaimStatus;
  currency?: CurrencyCode;
  amountRequested: number;
  amountApproved: number;
  amountReceived: number;
  paymentReceived: boolean;
  dateReceived: string;
  issueDescription: string;
  preferredResolution: string;
  letterDraft: string;
  letterTone: LetterTone;
  senderName: string;
  evidenceChecklist: EvidenceChecklistItem[];
  history: ClaimHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceState {
  purchases: PurchaseRecord[];
  deadlineMeta: Record<string, DeadlineMetaEntry>;
  customDeadlines: CustomDeadlineRecord[];
  claims: ClaimRecord[];
}

export type ActiveTab = 'overview' | 'vault' | 'deadlines' | 'recovery';
export type ThemeMode = 'dark' | 'light';
export type TypeScale = 'compact' | 'standard' | 'large';
