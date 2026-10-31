import {
  ClaimRecord,
  ClaimStatus,
  ClaimType,
  CurrencyCode,
  CustomDeadlineRecord,
  DeadlineActionState,
  DeadlineMetaEntry,
  DerivedDeadline,
  EvidenceChecklistItem,
  PurchaseCategory,
  PurchaseRecord,
  WorkspaceState,
} from '../types';

export const STORAGE_KEYS = {
  INIT: 'claimback_initialized_v1',
  PURCHASES: 'claimback_purchases_v1',
  DEADLINE_META: 'claimback_deadline_meta_v1',
  CUSTOM_DEADLINES: 'claimback_custom_deadlines_v1',
  CLAIMS: 'claimback_claims_v1',
  THEME: 'claimback_theme_v1',
  SCALE: 'claimback_scale_v1',
  CURRENCY: 'claimback_currency_v1',
};

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  label: string;
  locale: string;
  usdRate: number; // Units per 1 USD for cross-currency summary normalization
}

export const CURRENCY_OPTIONS: CurrencyConfig[] = [
  { code: 'INR', symbol: '₹', label: 'INR (₹) — Indian Rupee', locale: 'en-IN', usdRate: 84.0 },
  { code: 'USD', symbol: '$', label: 'USD ($) — US Dollar', locale: 'en-US', usdRate: 1.0 },
  { code: 'EUR', symbol: '€', label: 'EUR (€) — Euro', locale: 'de-DE', usdRate: 0.92 },
  { code: 'GBP', symbol: '£', label: 'GBP (£) — British Pound', locale: 'en-GB', usdRate: 0.79 },
  { code: 'AED', symbol: 'AED', label: 'AED (د.إ) — UAE Dirham', locale: 'en-AE', usdRate: 3.67 },
  { code: 'SGD', symbol: 'S$', label: 'SGD (S$) — Singapore Dollar', locale: 'en-SG', usdRate: 1.34 },
  { code: 'CAD', symbol: 'C$', label: 'CAD (C$) — Canadian Dollar', locale: 'en-CA', usdRate: 1.38 },
  { code: 'AUD', symbol: 'A$', label: 'AUD (A$) — Australian Dollar', locale: 'en-AU', usdRate: 1.52 },
];

export function getCurrencyConfig(code?: CurrencyCode): CurrencyConfig {
  return CURRENCY_OPTIONS.find((c) => c.code === code) || CURRENCY_OPTIONS[0];
}

export function convertCurrencyAmount(
  amount: number,
  fromCurrency: CurrencyCode | undefined,
  toCurrency: CurrencyCode
): number {
  const num = Number(amount);
  if (!Number.isFinite(num)) return 0;
  const from = fromCurrency || 'USD';
  if (from === toCurrency) return num;
  const fromCfg = getCurrencyConfig(from);
  const toCfg = getCurrencyConfig(toCurrency);
  const inUsd = num / fromCfg.usdRate;
  return inUsd * toCfg.usdRate;
}

export function formatCurrency(
  val: number,
  currency: CurrencyCode = 'INR'
): string {
  const n = Number(val);
  const cfg = getCurrencyConfig(currency);
  if (!Number.isFinite(n)) {
    return new Intl.NumberFormat(cfg.locale, {
      style: 'currency',
      currency: cfg.code,
    }).format(0);
  }
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency: cfg.code,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(n);
}

/**
 * Formats a record's amount in the user's active display currency (converting
 * cleanly if the record was logged in a different currency).
 */
export function formatDisplayMoney(
  amount: number,
  recordCurrency: CurrencyCode | undefined,
  displayCurrency: CurrencyCode
): string {
  const converted = convertCurrencyAmount(amount, recordCurrency, displayCurrency);
  return formatCurrency(converted, displayCurrency);
}

export function parseYMD(ymd?: string | null): Date | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }
  return dt;
}

export function formatYMD(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayYMD(): string {
  return formatYMD(new Date());
}

export function addCalendarDays(ymd: string, days: number): string | null {
  const dt = parseYMD(ymd);
  if (!dt || !Number.isFinite(days)) return null;
  const out = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + Math.trunc(days));
  return formatYMD(out);
}

export function addCalendarMonths(ymd: string, months: number): string | null {
  const dt = parseYMD(ymd);
  if (!dt || !Number.isFinite(months)) return null;
  const totalMonths = Math.trunc(months);
  const targetFirst = new Date(dt.getFullYear(), dt.getMonth() + totalMonths, 1);
  const maxDay = new Date(targetFirst.getFullYear(), targetFirst.getMonth() + 1, 0).getDate();
  const clampedDay = Math.min(dt.getDate(), maxDay);
  return formatYMD(new Date(targetFirst.getFullYear(), targetFirst.getMonth(), clampedDay));
}

export function diffCalendarDays(fromYMD: string, toYMD: string): number | null {
  const a = parseYMD(fromYMD);
  const b = parseYMD(toYMD);
  if (!a || !b) return null;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86400000);
}

export function computeWindowProgress(startDate?: string, dueDate?: string | null): number {
  if (!startDate || !dueDate) return 0;
  const total = diffCalendarDays(startDate, dueDate);
  const elapsed = diffCalendarDays(startDate, todayYMD());
  if (total === null || elapsed === null) return 0;
  if (total <= 0) return elapsed >= 0 ? 100 : 0;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

export function formatHumanDate(ymd?: string | null): string {
  const dt = parseYMD(ymd);
  if (!dt) return '—';
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function categoryLabel(cat: PurchaseCategory): string {
  const map: Record<PurchaseCategory, string> = {
    electronics: 'Electronics',
    appliance: 'Appliance',
    apparel: 'Apparel',
    home: 'Home Goods',
    service_deposit: 'Service Deposit',
    other: 'Consumer Purchase',
  };
  return map[cat] || 'Purchase';
}

export function claimTypeLabel(t: ClaimType): string {
  const map: Record<ClaimType, string> = {
    refund: 'Refund Request',
    return: 'Product Return',
    repair: 'Warranty Repair',
    replacement: 'Replacement',
    deposit: 'Deposit Release',
  };
  return map[t] || t;
}

export function claimStatusLabel(st: ClaimStatus): string {
  const map: Record<ClaimStatus, string> = {
    draft: 'Draft',
    submitted: 'Submitted',
    awaiting_response: 'Awaiting Response',
    resolved: 'Resolved',
    rejected: 'Rejected',
    closed: 'Closed',
  };
  return map[st] || st;
}

export function computeReturnDeadline(p: PurchaseRecord) {
  if (!p.hasReturnWindow) {
    return {
      applicable: false,
      dueDate: null as string | null,
      daysRemaining: null as number | null,
      isExactOverride: false,
      missingInfo: false,
      progressPct: 0,
    };
  }
  let dueDate: string | null = null;
  let isExactOverride = false;
  if (p.returnExactDate && parseYMD(p.returnExactDate)) {
    dueDate = p.returnExactDate;
    isExactOverride = true;
  } else if (
    p.returnDurationDays !== null &&
    Number.isFinite(Number(p.returnDurationDays)) &&
    Number(p.returnDurationDays) >= 0
  ) {
    dueDate = addCalendarDays(p.purchaseDate, Number(p.returnDurationDays));
  }
  if (!dueDate) {
    return {
      applicable: true,
      dueDate: null,
      daysRemaining: null,
      isExactOverride: false,
      missingInfo: true,
      progressPct: 0,
    };
  }
  return {
    applicable: true,
    dueDate,
    daysRemaining: diffCalendarDays(todayYMD(), dueDate),
    isExactOverride,
    missingInfo: false,
    progressPct: computeWindowProgress(p.purchaseDate, dueDate),
  };
}

export function computeWarrantyDeadline(p: PurchaseRecord) {
  if (!p.hasWarranty) {
    return {
      applicable: false,
      dueDate: null as string | null,
      daysRemaining: null as number | null,
      isExactOverride: false,
      missingInfo: false,
      progressPct: 0,
    };
  }
  let dueDate: string | null = null;
  let isExactOverride = false;
  if (p.warrantyExactDate && parseYMD(p.warrantyExactDate)) {
    dueDate = p.warrantyExactDate;
    isExactOverride = true;
  } else if (
    p.warrantyDurationValue !== null &&
    Number.isFinite(Number(p.warrantyDurationValue)) &&
    Number(p.warrantyDurationValue) > 0
  ) {
    const v = Number(p.warrantyDurationValue);
    if (p.warrantyDurationUnit === 'days') {
      dueDate = addCalendarDays(p.purchaseDate, v);
    } else if (p.warrantyDurationUnit === 'years') {
      dueDate = addCalendarMonths(p.purchaseDate, v * 12);
    } else {
      dueDate = addCalendarMonths(p.purchaseDate, v);
    }
  }
  if (!dueDate) {
    return {
      applicable: true,
      dueDate: null,
      daysRemaining: null,
      isExactOverride: false,
      missingInfo: true,
      progressPct: 0,
    };
  }
  return {
    applicable: true,
    dueDate,
    daysRemaining: diffCalendarDays(todayYMD(), dueDate),
    isExactOverride,
    missingInfo: false,
    progressPct: computeWindowProgress(p.purchaseDate, dueDate),
  };
}

export function computeDepositDeadline(p: PurchaseRecord) {
  if (!p.hasDeposit && p.purchaseType !== 'deposit') {
    return {
      applicable: false,
      dueDate: null as string | null,
      daysRemaining: null as number | null,
      missingInfo: false,
      progressPct: 0,
    };
  }
  if (p.depositDueDate && parseYMD(p.depositDueDate)) {
    return {
      applicable: true,
      dueDate: p.depositDueDate,
      daysRemaining: diffCalendarDays(todayYMD(), p.depositDueDate),
      missingInfo: false,
      progressPct: computeWindowProgress(p.purchaseDate, p.depositDueDate),
    };
  }
  return {
    applicable: true,
    dueDate: null,
    daysRemaining: null,
    missingInfo: true,
    progressPct: 0,
  };
}

export function deriveAllDeadlines(state: WorkspaceState): DerivedDeadline[] {
  const t = todayYMD();
  const items: DerivedDeadline[] = [];

  const resolveMeta = (id: string, defaultState: DeadlineActionState) => {
    const m: Partial<DeadlineMetaEntry> = state.deadlineMeta[id] || {};
    return {
      actionState: m.actionState || defaultState,
      prepDate: m.prepDate || '',
      userNote: m.userNote || '',
    };
  };

  for (const p of state.purchases) {
    const missingReceipt = !p.receiptRef || !p.receiptRef.trim();
    const recCurrency: CurrencyCode = p.currency || 'USD';

    if (p.hasReturnWindow) {
      const ret = computeReturnDeadline(p);
      const id = `ret_${p.id}`;
      const meta = resolveMeta(id, 'needs_action');
      const missingReasons: string[] = [];
      if (missingReceipt) missingReasons.push('Missing receipt reference');
      if (ret.missingInfo) missingReasons.push('Missing return cutoff date');

      items.push({
        id,
        sourceKind: 'purchase',
        purchaseId: p.id,
        claimId: '',
        customId: '',
        isSample: Boolean(p.isSample),
        type: 'return',
        typeLabel: 'Return Window',
        title: p.productName,
        seller: p.seller,
        amount: Number(p.amount) || 0,
        currency: recCurrency,
        startDate: p.purchaseDate,
        dueDate: ret.dueDate,
        daysRemaining: ret.daysRemaining,
        progressPct: ret.progressPct,
        policySource: p.returnPolicySource || 'user_estimate',
        basisText: ret.isExactOverride
          ? 'Exact seller return cutoff'
          : `${p.returnDurationDays ?? '—'}-day return window`,
        receiptRef: p.receiptRef || '',
        missingReasons,
        actionState: meta.actionState,
        prepDate: meta.prepDate,
        prepDaysRemaining: meta.prepDate ? diffCalendarDays(t, meta.prepDate) : null,
        userNote: meta.userNote,
      });
    }

    if (p.hasWarranty) {
      const war = computeWarrantyDeadline(p);
      const id = `war_${p.id}`;
      const meta = resolveMeta(id, 'needs_action');
      const missingReasons: string[] = [];
      if (missingReceipt) missingReasons.push('Missing receipt reference');
      if (war.missingInfo) missingReasons.push('Missing warranty end date');

      items.push({
        id,
        sourceKind: 'purchase',
        purchaseId: p.id,
        claimId: '',
        customId: '',
        isSample: Boolean(p.isSample),
        type: 'warranty',
        typeLabel: 'Warranty Coverage',
        title: p.productName,
        seller: p.seller,
        amount: Number(p.amount) || 0,
        currency: recCurrency,
        startDate: p.purchaseDate,
        dueDate: war.dueDate,
        daysRemaining: war.daysRemaining,
        progressPct: war.progressPct,
        policySource: p.warrantyPolicySource || 'user_estimate',
        basisText: war.isExactOverride
          ? 'Exact warranty end date'
          : `${p.warrantyDurationValue ?? '—'} ${p.warrantyDurationUnit} warranty`,
        receiptRef: p.receiptRef || '',
        missingReasons,
        actionState: meta.actionState,
        prepDate: meta.prepDate,
        prepDaysRemaining: meta.prepDate ? diffCalendarDays(t, meta.prepDate) : null,
        userNote: meta.userNote,
      });
    }

    if (p.hasDeposit || p.purchaseType === 'deposit') {
      const dep = computeDepositDeadline(p);
      const id = `dep_${p.id}`;
      const meta = resolveMeta(id, 'needs_action');
      const missingReasons: string[] = [];
      if (missingReceipt) missingReasons.push('Missing deposit receipt ref');
      if (dep.missingInfo) missingReasons.push('Missing deposit due date');

      items.push({
        id,
        sourceKind: 'purchase',
        purchaseId: p.id,
        claimId: '',
        customId: '',
        isSample: Boolean(p.isSample),
        type: 'deposit',
        typeLabel: 'Refundable Deposit',
        title: p.productName,
        seller: p.seller,
        amount: Number(p.amount) || 0,
        currency: recCurrency,
        startDate: p.purchaseDate,
        dueDate: dep.dueDate,
        daysRemaining: dep.daysRemaining,
        progressPct: dep.progressPct,
        policySource: p.returnPolicySource || 'seller_verified',
        basisText: p.depositCondition || 'Deposit return condition',
        receiptRef: p.receiptRef || '',
        missingReasons,
        actionState: meta.actionState,
        prepDate: meta.prepDate,
        prepDaysRemaining: meta.prepDate ? diffCalendarDays(t, meta.prepDate) : null,
        userNote: meta.userNote,
      });
    }
  }

  for (const c of state.claims) {
    const isClosed = c.status === 'resolved' || c.status === 'closed' || c.status === 'rejected';
    let dueDate = c.responseDueDate && parseYMD(c.responseDueDate) ? c.responseDueDate : null;
    if (!dueDate && c.dateSubmitted && parseYMD(c.dateSubmitted) && !isClosed) {
      dueDate = addCalendarDays(c.dateSubmitted, 14);
    }
    if (!dueDate && isClosed) continue;

    const id = `clm_${c.id}`;
    const defaultState: DeadlineActionState =
      c.paymentReceived || c.status === 'resolved'
        ? 'completed'
        : c.status === 'draft'
        ? 'needs_action'
        : 'in_progress';
    const meta = resolveMeta(id, defaultState);
    const missingReasons: string[] = [];
    if (c.status !== 'draft' && (!c.referenceNumber || !c.referenceNumber.trim())) {
      missingReasons.push('Missing seller RMA / claim ref #');
    }
    if (!dueDate) missingReasons.push('No response target date set');

    items.push({
      id,
      sourceKind: 'claim',
      purchaseId: c.purchaseId || '',
      claimId: c.id,
      customId: '',
      isSample: Boolean(c.isSample),
      type: c.claimType === 'deposit' ? 'deposit' : 'refund',
      typeLabel: c.claimType === 'deposit' ? 'Deposit Claim Follow-Up' : 'Refund Claim Follow-Up',
      title: `${c.itemSummary} (${claimTypeLabel(c.claimType)})`,
      seller: c.seller,
      amount: Number(c.amountRequested) || 0,
      currency: c.currency || 'USD',
      startDate: c.dateSubmitted || c.purchaseDate || '',
      dueDate,
      daysRemaining: dueDate ? diffCalendarDays(t, dueDate) : null,
      progressPct: computeWindowProgress(c.dateSubmitted || c.purchaseDate, dueDate),
      policySource: 'seller_verified',
      basisText: `Claim status: ${claimStatusLabel(c.status)}`,
      receiptRef: c.referenceNumber || c.receiptRef || '',
      missingReasons,
      actionState: meta.actionState,
      prepDate: meta.prepDate,
      prepDaysRemaining: meta.prepDate ? diffCalendarDays(t, meta.prepDate) : null,
      userNote: meta.userNote,
    });
  }

  for (const cd of state.customDeadlines) {
    const id = `cst_${cd.id}`;
    const dueDate = cd.dueDate && parseYMD(cd.dueDate) ? cd.dueDate : null;
    const meta = resolveMeta(id, 'needs_action');
    const missingReasons: string[] = [];
    if (!cd.receiptRef || !cd.receiptRef.trim()) missingReasons.push('Missing reference #');
    if (!dueDate) missingReasons.push('Missing deadline date');

    const mapLabels = {
      return: 'Return Window',
      warranty: 'Warranty Coverage',
      refund: 'Refund Follow-Up',
      deposit: 'Refundable Deposit',
    };

    items.push({
      id,
      sourceKind: 'custom',
      purchaseId: '',
      claimId: '',
      customId: cd.id,
      isSample: Boolean(cd.isSample),
      type: cd.type,
      typeLabel: mapLabels[cd.type] || 'Custom Deadline',
      title: cd.title,
      seller: cd.seller,
      amount: Number(cd.amount) || 0,
      currency: cd.currency || 'USD',
      startDate: cd.startDate || '',
      dueDate,
      daysRemaining: dueDate ? diffCalendarDays(t, dueDate) : null,
      progressPct: computeWindowProgress(cd.startDate || t, dueDate),
      policySource: cd.policySource || 'user_estimate',
      basisText: cd.notes || 'Standalone logged deadline',
      receiptRef: cd.receiptRef || '',
      missingReasons,
      actionState: meta.actionState,
      prepDate: meta.prepDate,
      prepDaysRemaining: meta.prepDate ? diffCalendarDays(t, meta.prepDate) : null,
      userNote: meta.userNote,
    });
  }

  return items;
}

export function calculateFinancialTotals(
  claims: ClaimRecord[],
  displayCurrency: CurrencyCode = 'INR'
) {
  let totalRequested = 0;
  let unapprovedPending = 0;
  let approvedAwaitingPayout = 0;
  let confirmedReceived = 0;
  let openClaimsCount = 0;
  let receivedClaimsCount = 0;

  for (const c of claims) {
    const cur = c.currency || 'USD';
    const req = convertCurrencyAmount(
      Math.max(0, Number(c.amountRequested) || 0),
      cur,
      displayCurrency
    );
    const app = convertCurrencyAmount(
      Math.max(0, Number(c.amountApproved) || 0),
      cur,
      displayCurrency
    );
    const rec = c.paymentReceived
      ? convertCurrencyAmount(
          Math.max(0, Number(c.amountReceived) || 0),
          cur,
          displayCurrency
        )
      : 0;

    totalRequested += req;
    if (c.paymentReceived && rec > 0) {
      confirmedReceived += rec;
      receivedClaimsCount++;
    } else {
      if (app > 0) approvedAwaitingPayout += app;
      if (
        c.status === 'draft' ||
        c.status === 'submitted' ||
        c.status === 'awaiting_response'
      ) {
        openClaimsCount++;
        unapprovedPending += Math.max(0, req - app);
      }
    }
  }

  return {
    totalRequested,
    unapprovedPending,
    approvedAwaitingPayout,
    confirmedReceived,
    openClaimsCount,
    receivedClaimsCount,
  };
}

export function buildDefaultEvidenceChecklist(
  claimType: ClaimType,
  receiptRef: string,
  hasProofFile: boolean
): EvidenceChecklistItem[] {
  const refText = receiptRef ? ` (${receiptRef})` : '';
  const base: EvidenceChecklistItem[] = [
    {
      id: `ev_${Date.now()}_1`,
      label: `Receipt, order invoice, or proof of payment${refText}`,
      checked: Boolean(receiptRef || hasProofFile),
    },
  ];
  if (claimType === 'return' || claimType === 'refund') {
    base.push(
      { id: `ev_${Date.now()}_2`, label: 'Seller return policy snapshot or cutoff date', checked: false },
      { id: `ev_${Date.now()}_3`, label: 'Photos of item condition and packaging prior to shipment', checked: false },
      { id: `ev_${Date.now()}_4`, label: 'Carrier tracking number & drop-off weight receipt', checked: false }
    );
  } else if (claimType === 'repair' || claimType === 'replacement') {
    base.push(
      { id: `ev_${Date.now()}_2`, label: 'Photos or short video demonstrating the defect', checked: false },
      { id: `ev_${Date.now()}_3`, label: 'Serial number / model plate photo from device housing', checked: false },
      { id: `ev_${Date.now()}_4`, label: 'Written warranty terms confirming active coverage', checked: false }
    );
  } else {
    base.push(
      { id: `ev_${Date.now()}_2`, label: 'Deposit agreement stating refund timeline & conditions', checked: false },
      { id: `ev_${Date.now()}_3`, label: 'Equipment return receipt or signed move-out inspection', checked: false },
      { id: `ev_${Date.now()}_4`, label: 'Final account statement showing zero balance due', checked: false }
    );
  }
  return base;
}

export function generateClaimLetter(
  c: ClaimRecord,
  displayCurrency: CurrencyCode = 'INR'
): string {
  const todayStr = formatHumanDate(todayYMD());
  const subjectLabel = claimTypeLabel(c.claimType);
  const itemCurrency = c.currency || displayCurrency;
  const formattedReq = formatCurrency(c.amountRequested, itemCurrency);

  const refPart = c.referenceNumber
    ? `Claim / RMA Reference: ${c.referenceNumber}`
    : c.receiptRef
    ? `Order / Receipt Reference: ${c.receiptRef}`
    : 'Reference: [Insert Order or Account Number]';

  const sender = c.senderName && c.senderName.trim() ? c.senderName.trim() : '[Your Name]';
  const checkedEvidence = (c.evidenceChecklist || []).filter((e) => e.checked);
  const evidenceBlock =
    checkedEvidence.length > 0
      ? `\nSupporting documentation prepared:\n${checkedEvidence.map((e) => `- ${e.label}`).join('\n')}\n`
      : '\nI have my proof of purchase and supporting records available upon request.\n';

  const requestedLine =
    Number(c.amountRequested) > 0
      ? `Amount requested: ${formattedReq}`
      : 'Requested remedy: Authorized repair or replacement under applicable policy';

  const resolutionLine =
    c.preferredResolution && c.preferredResolution.trim()
      ? c.preferredResolution.trim()
      : Number(c.amountRequested) > 0
      ? `Please process the ${formattedReq} refund to my original payment method and confirm once issued.`
      : 'Please provide return authorization instructions or next steps for repair/replacement.';

  let opening = '';
  let closing = '';

  if (c.letterTone === 'firm_followup') {
    opening = `I am writing to follow up on my ${subjectLabel.toLowerCase()} regarding ${c.itemSummary}${
      c.dateSubmitted ? `, originally submitted on ${formatHumanDate(c.dateSubmitted)}` : ''
    }.`;
    closing =
      'Please provide a written update on the status of this request, including the expected completion or payout date, within 5 business days. If any additional documentation is needed under your policy, please let me know promptly.';
  } else if (c.letterTone === 'clarification_request') {
    opening = `I am writing to request written clarification and assistance regarding ${c.itemSummary}${
      c.purchaseDate ? `, purchased/initiated on ${formatHumanDate(c.purchaseDate)}` : ''
    }.`;
    closing =
      'Could you please confirm how your applicable policy applies to this item and outline any itemized basis or steps required to complete resolution? Thank you for your clear guidance.';
  } else {
    opening = `I am contacting ${c.seller} to submit a ${subjectLabel.toLowerCase()} for ${c.itemSummary}${
      c.purchaseDate ? `, purchased/initiated on ${formatHumanDate(c.purchaseDate)}` : ''
    }.`;
    closing =
      'Please let me know the next steps or confirm any return authorization details needed to complete this request in accordance with your policy. Thank you for your time and assistance.';
  }

  return [
    `Date: ${todayStr}`,
    `To: ${c.seller} Customer Support`,
    `Subject: ${subjectLabel} — ${c.itemSummary}`,
    refPart,
    c.receiptRef && c.referenceNumber ? `Original Receipt / Invoice: ${c.receiptRef}` : null,
    '',
    `Hello ${c.seller} Support Team,`,
    '',
    opening,
    '',
    'Summary of issue / basis for request:',
    c.issueDescription || '[Describe the issue, return reason, or deposit completion details]',
    '',
    requestedLine,
    `Preferred resolution: ${resolutionLine}`,
    evidenceBlock,
    closing,
    '',
    'Sincerely,',
    sender,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export interface ParsedReceiptFields {
  productName: string;
  seller: string;
  amount: string;
  currency?: CurrencyCode;
  purchaseDate: string;
  receiptRef: string;
  returnDays: string;
  warrantyMonths: string;
}

export function parseReceiptSnippet(
  raw: string,
  defaultCurrency: CurrencyCode = 'INR'
): ParsedReceiptFields {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let seller = '';
  let productName = '';
  let amount = '';
  let currency: CurrencyCode = defaultCurrency;
  let purchaseDate = todayYMD();
  let receiptRef = '';
  let returnDays = '30';
  let warrantyMonths = '12';

  const sellerMatch = raw.match(/(?:seller|merchant|store|from|vendor)\s*[:\-]\s*([^\n\r]+)/i);
  if (sellerMatch) seller = sellerMatch[1].trim();
  else if (lines.length > 0 && lines[0].length < 50 && !/order|invoice|receipt|date|total/i.test(lines[0])) {
    seller = lines[0];
  }

  const itemMatch = raw.match(/(?:item|product|model|description)\s*[:\-]\s*([^\n\r]+)/i);
  if (itemMatch) productName = itemMatch[1].trim();

  // Detect currency symbol/code in receipt text (INR / ₹ / Rs. / USD / EUR / GBP)
  if (/₹|\bINR\b|\bRs\.?\s*\d/i.test(raw)) currency = 'INR';
  else if (/€|\bEUR\b/i.test(raw)) currency = 'EUR';
  else if (/£|\bGBP\b/i.test(raw)) currency = 'GBP';
  else if (/\bAED\b/i.test(raw)) currency = 'AED';
  else if (/\$|\bUSD\b/i.test(raw)) currency = 'USD';

  // Supports both international (12,345.00) and Indian comma grouping (1,24,999.00)
  const totalMatch =
    raw.match(
      /(?:total|amount|paid|price|deposit|mrp)\s*(?:paid)?\s*[:\-]?\s*(?:₹|Rs\.?|INR|\$|€|£|AED)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i
    ) ||
    raw.match(/(?:₹|Rs\.?\s*|\$|€|£)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  if (totalMatch) {
    amount = totalMatch[1].replace(/,/g, '');
  }

  const refMatch = raw.match(
    /(?:order|invoice|receipt|confirmation|ref)\s*(?:#|no\.?|id|number)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-]{3,28})/i
  );
  if (refMatch) receiptRef = refMatch[1].trim();

  const isoMatch = raw.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch && parseYMD(isoMatch[1])) {
    purchaseDate = isoMatch[1];
  } else {
    const namedMonth = raw.match(
      /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\b/i
    );
    if (namedMonth) {
      const parsed = new Date(`${namedMonth[1]} ${namedMonth[2]}, ${namedMonth[3]}`);
      if (!Number.isNaN(parsed.getTime())) {
        purchaseDate = formatYMD(parsed);
      }
    }
  }

  const retMatch = raw.match(/(\d{1,3})\s*[-\s]?day\s+return/i);
  if (retMatch) returnDays = retMatch[1];

  const warYr = raw.match(/(\d{1,2})\s*[-\s]?year\s+warranty/i);
  const warMo = raw.match(/(\d{1,2})\s*[-\s]?month\s+warranty/i);
  if (warYr) warrantyMonths = String(Number(warYr[1]) * 12);
  else if (warMo) warrantyMonths = warMo[1];

  return {
    productName,
    seller,
    amount,
    currency,
    purchaseDate,
    receiptRef,
    returnDays,
    warrantyMonths,
  };
}

export function buildSampleDataset(): WorkspaceState {
  const t = todayYMD();
  const nowIso = new Date().toISOString();
  const d = (offset: number) => addCalendarDays(t, offset) || t;

  const purchases: PurchaseRecord[] = [
    {
      id: 'pur_sample_1',
      isSample: true,
      productName: 'Northstar 27-inch 4K IPS Monitor',
      seller: 'Boreal Tech Direct',
      category: 'electronics',
      purchaseType: 'purchase',
      purchaseDate: d(-25),
      amount: 35990,
      currency: 'INR',
      receiptRef: 'BTD-2026-44910',
      hasReturnWindow: true,
      returnDurationDays: 30,
      returnExactDate: '',
      returnPolicySource: 'seller_verified',
      hasWarranty: true,
      warrantyDurationValue: 24,
      warrantyDurationUnit: 'months',
      warrantyExactDate: '',
      warrantyPolicySource: 'seller_verified',
      hasDeposit: false,
      depositDueDate: '',
      depositCondition: '',
      proofFile: {
        fileName: 'boreal-monitor-invoice-44910.pdf',
        fileSize: 148200,
        fileType: 'application/pdf',
        locationNote: 'Documents/Receipts/2026/boreal-monitor-invoice-44910.pdf',
        dataUrl: '',
        attachedAt: d(-25),
      },
      notes: 'Serial #NS27-99481A. Intermittent upper-panel flicker noticed after 20 minutes warm-up.',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'pur_sample_2',
      isSample: true,
      productName: 'Solace Barista Conical Burr Grinder',
      seller: 'Hearth & Kettle Co.',
      category: 'appliance',
      purchaseType: 'purchase',
      purchaseDate: d(-356),
      amount: 15499,
      currency: 'INR',
      receiptRef: 'HK-771092',
      hasReturnWindow: true,
      returnDurationDays: 30,
      returnExactDate: '',
      returnPolicySource: 'user_estimate',
      hasWarranty: true,
      warrantyDurationValue: 12,
      warrantyDurationUnit: 'months',
      warrantyExactDate: '',
      warrantyPolicySource: 'seller_verified',
      hasDeposit: false,
      depositDueDate: '',
      depositCondition: '',
      proofFile: {
        fileName: 'hearth-kettle-order-771092.pdf',
        fileSize: 94100,
        fileType: 'application/pdf',
        locationNote: 'Email archive + Kitchen appliance binder',
        dataUrl: '',
        attachedAt: d(-356),
      },
      notes: 'Motor stalls on fine espresso setting; 12-month manufacturer warranty expires in ~9 days.',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'pur_sample_3',
      isSample: true,
      productName: 'Crestline Fiber ONT Router Equipment Deposit',
      seller: 'Crestline Broadband',
      category: 'service_deposit',
      purchaseType: 'deposit',
      purchaseDate: d(-180),
      amount: 2500,
      currency: 'INR',
      receiptRef: 'CB-DEP-55301',
      hasReturnWindow: false,
      returnDurationDays: null,
      returnExactDate: '',
      returnPolicySource: 'seller_verified',
      hasWarranty: false,
      warrantyDurationValue: null,
      warrantyDurationUnit: 'months',
      warrantyExactDate: '',
      warrantyPolicySource: 'user_estimate',
      hasDeposit: true,
      depositDueDate: d(4),
      depositCondition: 'Return ONT fiber box and power supply within 14 days of service cancellation',
      proofFile: {
        fileName: 'crestline-deposit-agreement.pdf',
        fileSize: 112400,
        fileType: 'application/pdf',
        locationNote: 'Utilities folder / Crestline account statement',
        dataUrl: '',
        attachedAt: d(-180),
      },
      notes: 'Keep courier drop-off weight receipt when returning router hardware.',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'pur_sample_4',
      isSample: true,
      productName: 'Veridian Mesh Ergonomic Task Chair',
      seller: 'Veridian Workspace',
      category: 'home',
      purchaseType: 'purchase',
      purchaseDate: d(-21),
      amount: 24900,
      currency: 'INR',
      receiptRef: '',
      hasReturnWindow: true,
      returnDurationDays: 14,
      returnExactDate: '',
      returnPolicySource: 'user_estimate',
      hasWarranty: true,
      warrantyDurationValue: 3,
      warrantyDurationUnit: 'years',
      warrantyExactDate: '',
      warrantyPolicySource: 'user_estimate',
      hasDeposit: false,
      depositDueDate: '',
      depositCondition: '',
      proofFile: null,
      notes: 'Right armrest height lock slips. Locate GST invoice email from Veridian Workspace.',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'pur_sample_5',
      isSample: true,
      productName: 'Alpine Trail 3L Waterproof Shell Jacket',
      seller: 'Summit & Pine Outfitters',
      category: 'apparel',
      purchaseType: 'purchase',
      purchaseDate: d(-45),
      amount: 12999,
      currency: 'INR',
      receiptRef: 'SPO-99204',
      hasReturnWindow: true,
      returnDurationDays: 60,
      returnExactDate: '',
      returnPolicySource: 'seller_verified',
      hasWarranty: false,
      warrantyDurationValue: null,
      warrantyDurationUnit: 'months',
      warrantyExactDate: '',
      warrantyPolicySource: 'user_estimate',
      hasDeposit: false,
      depositDueDate: '',
      depositCondition: '',
      proofFile: {
        fileName: 'summit-pine-receipt-99204.jpg',
        fileSize: 184000,
        fileType: 'image/jpeg',
        locationNote: 'Photos / Receipts album',
        dataUrl: '',
        attachedAt: d(-45),
      },
      notes: 'Returned unworn with tags; full refund received.',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'pur_sample_6',
      isSample: true,
      productName: 'MetroStay Short-Term Utility Security Deposit',
      seller: 'MetroStay Property Services',
      category: 'service_deposit',
      purchaseType: 'deposit',
      purchaseDate: d(-95),
      amount: 15000,
      currency: 'INR',
      receiptRef: 'MSP-DEP-3098',
      hasReturnWindow: false,
      returnDurationDays: null,
      returnExactDate: '',
      returnPolicySource: 'seller_verified',
      hasWarranty: false,
      warrantyDurationValue: null,
      warrantyDurationUnit: 'months',
      warrantyExactDate: '',
      warrantyPolicySource: 'user_estimate',
      hasDeposit: true,
      depositDueDate: d(-5),
      depositCondition: 'Refundable within 30 days after final meter reading and key handoff',
      proofFile: {
        fileName: 'metrostay-moveout-inspection.pdf',
        fileSize: 205000,
        fileType: 'application/pdf',
        locationNote: 'Housing / Lease Archive 2026',
        dataUrl: '',
        attachedAt: d(-35),
      },
      notes: 'Signed move-out sheet shows zero balance due; disputing ₹2,000 administrative deduction.',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const deadlineMeta: Record<string, DeadlineMetaEntry> = {
    ret_pur_sample_1: {
      actionState: 'in_progress',
      prepDate: d(2),
      userNote: 'RMA-88210 issued; pack monitor in original foam box before courier pickup.',
      updatedAt: nowIso,
    },
    ret_pur_sample_2: {
      actionState: 'not_applicable',
      prepDate: '',
      userNote: 'Kept grinder past 30-day retail return window.',
      updatedAt: nowIso,
    },
    war_pur_sample_2: {
      actionState: 'needs_action',
      prepDate: d(2),
      userNote: 'Record 15-second video of burr motor stalling before warranty expires.',
      updatedAt: nowIso,
    },
    dep_pur_sample_3: {
      actionState: 'in_progress',
      prepDate: d(1),
      userNote: 'Drop off fiber ONT kit at authorized counter and photograph receipt.',
      updatedAt: nowIso,
    },
    ret_pur_sample_4: {
      actionState: 'needs_action',
      prepDate: '',
      userNote: 'Check whether seller offers exchange exception or file under 3-year warranty.',
      updatedAt: nowIso,
    },
    ret_pur_sample_5: {
      actionState: 'completed',
      prepDate: '',
      userNote: 'Return completed and refund confirmed.',
      updatedAt: nowIso,
    },
    dep_pur_sample_6: {
      actionState: 'in_progress',
      prepDate: '',
      userNote: 'Submitted written request for full deposit release.',
      updatedAt: nowIso,
    },
  };

  const claims: ClaimRecord[] = [
    {
      id: 'clm_sample_1',
      isSample: true,
      purchaseId: 'pur_sample_1',
      claimType: 'return',
      itemSummary: 'Northstar 27-inch 4K IPS Monitor',
      seller: 'Boreal Tech Direct',
      purchaseDate: d(-25),
      receiptRef: 'BTD-2026-44910',
      referenceNumber: 'RMA-88210',
      dateSubmitted: d(-2),
      responseDueDate: d(5),
      status: 'awaiting_response',
      currency: 'INR',
      amountRequested: 35990,
      amountApproved: 35990,
      amountReceived: 0,
      paymentReceived: false,
      dateReceived: '',
      issueDescription:
        'Intermittent horizontal flicker across upper third of screen after 20 minutes of use. Returning within verified 30-day return window.',
      preferredResolution: 'Full refund to original payment method upon return inspection.',
      letterDraft: '',
      letterTone: 'polite_standard',
      senderName: '',
      evidenceChecklist: [
        { id: 'ev_s1_1', label: 'Invoice / receipt reference (BTD-2026-44910)', checked: true },
        { id: 'ev_s1_2', label: 'Short video showing upper-panel display flicker', checked: true },
        { id: 'ev_s1_3', label: 'Photo of serial number tag (#NS27-99481A)', checked: true },
        { id: 'ev_s1_4', label: 'Courier pickup receipt with tracking number', checked: false },
      ],
      history: [
        { id: 'his_s1_1', date: d(-2), note: 'Return claim opened; seller issued RMA-88210.' },
        {
          id: 'his_s1_2',
          date: d(-1),
          note: 'Seller pre-approved refund pending warehouse receipt. Payout not yet received.',
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'clm_sample_2',
      isSample: true,
      purchaseId: 'pur_sample_2',
      claimType: 'repair',
      itemSummary: 'Solace Barista Conical Burr Grinder',
      seller: 'Hearth & Kettle Co.',
      purchaseDate: d(-356),
      receiptRef: 'HK-771092',
      referenceNumber: '',
      dateSubmitted: '',
      responseDueDate: d(8),
      status: 'draft',
      currency: 'INR',
      amountRequested: 0,
      amountApproved: 0,
      amountReceived: 0,
      paymentReceived: false,
      dateReceived: '',
      issueDescription:
        'Conical burr drive motor stalls under normal load prior to 12-month warranty expiration.',
      preferredResolution: 'Authorized warranty repair or replacement unit at no charge.',
      letterDraft: '',
      letterTone: 'polite_standard',
      senderName: '',
      evidenceChecklist: [
        { id: 'ev_s2_1', label: 'Order invoice HK-771092 showing purchase date', checked: true },
        { id: 'ev_s2_2', label: 'Video demonstrating grinder motor stall on medium-fine setting', checked: false },
        { id: 'ev_s2_3', label: 'Photo of bottom manufacture plate & batch code', checked: false },
      ],
      history: [{ id: 'his_s2_1', date: t, note: 'Draft warranty repair request prepared ahead of 12-month warranty deadline.' }],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'clm_sample_3',
      isSample: true,
      purchaseId: 'pur_sample_5',
      claimType: 'refund',
      itemSummary: 'Alpine Trail 3L Waterproof Shell Jacket',
      seller: 'Summit & Pine Outfitters',
      purchaseDate: d(-45),
      receiptRef: 'SPO-99204',
      referenceNumber: 'RET-50192',
      dateSubmitted: d(-20),
      responseDueDate: '',
      status: 'resolved',
      currency: 'INR',
      amountRequested: 12999,
      amountApproved: 12999,
      amountReceived: 12999,
      paymentReceived: true,
      dateReceived: d(-12),
      issueDescription: 'Returned unworn jacket with original retail tags attached within 60-day return policy.',
      preferredResolution: 'Full refund to original payment method.',
      letterDraft: '',
      letterTone: 'polite_standard',
      senderName: '',
      evidenceChecklist: [
        { id: 'ev_s3_1', label: 'Receipt SPO-99204', checked: true },
        { id: 'ev_s3_2', label: 'Return parcel tracking delivery confirmation', checked: true },
        { id: 'ev_s3_3', label: 'Statement credit confirmation (full refund received)', checked: true },
      ],
      history: [
        { id: 'his_s3_1', date: d(-20), note: 'Submitted return package under RET-50192.' },
        { id: 'his_s3_2', date: d(-15), note: 'Warehouse confirmed receipt and approved full refund.' },
        { id: 'his_s3_3', date: d(-12), note: 'Confirmed full payout received.' },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'clm_sample_4',
      isSample: true,
      purchaseId: 'pur_sample_6',
      claimType: 'deposit',
      itemSummary: 'MetroStay Short-Term Utility Security Deposit',
      seller: 'MetroStay Property Services',
      purchaseDate: d(-95),
      receiptRef: 'MSP-DEP-3098',
      referenceNumber: 'CLM-3098-D',
      dateSubmitted: d(-4),
      responseDueDate: d(3),
      status: 'submitted',
      currency: 'INR',
      amountRequested: 15000,
      amountApproved: 13000,
      amountReceived: 0,
      paymentReceived: false,
      dateReceived: '',
      issueDescription:
        '30-day utility deposit return window passed. Provider proposed partial release with unexplained deduction despite signed zero-balance move-out report.',
      preferredResolution:
        'Release of full refundable deposit or itemized contractual basis for any deduction.',
      letterDraft: '',
      letterTone: 'firm_followup',
      senderName: '',
      evidenceChecklist: [
        { id: 'ev_s4_1', label: 'Deposit receipt MSP-DEP-3098', checked: true },
        { id: 'ev_s4_2', label: 'Signed move-out meter & key inspection form', checked: true },
        { id: 'ev_s4_3', label: 'Written clarification request regarding deduction', checked: true },
      ],
      history: [
        { id: 'his_s4_1', date: d(-4), note: 'Filed deposit refund claim CLM-3098-D after 30-day return window elapsed.' },
        {
          id: 'his_s4_2',
          date: d(-2),
          note: 'Provider indicated partial approval; requested written clarification on remaining balance. No funds received yet.',
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const customDeadlines: CustomDeadlineRecord[] = [];
  return { purchases, deadlineMeta, customDeadlines, claims };
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeIcsText(val: string): string {
  return String(val || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function ymdToIcsDate(ymd: string): string {
  return ymd.replace(/-/g, '');
}

/**
 * Generates an RFC 5545 compliant .ics calendar file for one or more deadlines
 * (including earlier user-configured preparation dates and 24-hour VALARM reminders).
 */
export function generateIcsCalendar(
  deadlines: DerivedDeadline[],
  displayCurrency: CurrencyCode = 'INR'
): string {
  const dtstamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CLAIMBACK//Consumer Protection Utility//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const d of deadlines) {
    if (d.actionState === 'completed' || d.actionState === 'not_applicable') {
      continue;
    }

    const moneyStr =
      d.amount > 0
        ? formatDisplayMoney(d.amount, d.currency, displayCurrency)
        : 'Coverage / Service';

    if (d.dueDate && parseYMD(d.dueDate)) {
      const endNext = addCalendarDays(d.dueDate, 1) || d.dueDate;
      lines.push(
        'BEGIN:VEVENT',
        `UID:claimback-due-${d.id}@claimback.local`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${ymdToIcsDate(d.dueDate)}`,
        `DTEND;VALUE=DATE:${ymdToIcsDate(endNext)}`,
        `SUMMARY:${escapeIcsText(`[CLAIMBACK] ${d.typeLabel}: ${d.title}`)}`,
        `DESCRIPTION:${escapeIcsText(
          `Seller: ${d.seller}\nProtected Value: ${moneyStr}\nBasis: ${d.basisText} (${
            d.policySource === 'seller_verified'
              ? 'Seller-verified policy'
              : 'User-entered estimate'
          })\nReference: ${d.receiptRef || 'None'}\nNote: ${
            d.userNote || 'Verify seller written terms prior to cutoff.'
          }`
        )}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT24H',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeIcsText(`CLAIMBACK Reminder: ${d.title} (${d.typeLabel})`)}`,
        'END:VALARM',
        'END:VEVENT'
      );
    }

    if (d.prepDate && parseYMD(d.prepDate)) {
      const prepEndNext = addCalendarDays(d.prepDate, 1) || d.prepDate;
      lines.push(
        'BEGIN:VEVENT',
        `UID:claimback-prep-${d.id}@claimback.local`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${ymdToIcsDate(d.prepDate)}`,
        `DTEND;VALUE=DATE:${ymdToIcsDate(prepEndNext)}`,
        `SUMMARY:${escapeIcsText(`[CLAIMBACK PREP] Prepare Evidence: ${d.title}`)}`,
        `DESCRIPTION:${escapeIcsText(
          `Earlier preparation target ahead of ${formatHumanDate(d.dueDate)} (${
            d.typeLabel
          }).\nSeller: ${d.seller}\nAction Note: ${
            d.userNote || 'Gather receipt, photos, and RMA authorization.'
          }`
        )}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT12H',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeIcsText(`Prepare claim evidence for ${d.title}`)}`,
        'END:VALARM',
        'END:VEVENT'
      );
    }
  }

  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).join('\r\n');
}

function escapeHtmlSafe(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generates a clean, self-contained, print-ready HTML Claim Evidence & Correspondence Dossier
 * so users can print or save to PDF directly from any browser.
 */
export function generateClaimDossierHtml(
  claim: ClaimRecord,
  linkedPurchase: PurchaseRecord | null,
  displayCurrency: CurrencyCode = 'INR'
): string {
  const recCur = claim.currency || displayCurrency;
  const letter =
    claim.letterDraft && claim.letterDraft.trim()
      ? claim.letterDraft
      : generateClaimLetter(claim, displayCurrency);

  const checklistHtml = (claim.evidenceChecklist || [])
    .map(
      (item) =>
        `<li><strong>${item.checked ? '[✓] Prepared' : '[ ] Pending'}</strong> — ${escapeHtmlSafe(
          item.label
        )}</li>`
    )
    .join('');

  const historyHtml = (claim.history || [])
    .map(
      (h) =>
        `<tr><td style="white-space:nowrap;font-family:monospace;">${escapeHtmlSafe(
          formatHumanDate(h.date)
        )}</td><td>${escapeHtmlSafe(h.note)}</td></tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>CLAIMBACK Claim Dossier — ${escapeHtmlSafe(claim.itemSummary)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; max-width: 820px; margin: 32px auto; padding: 0 24px; line-height: 1.55; }
    .toolbar { display: flex; justify-content: space-between; align-items: center; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 12px 16px; border-radius: 8px; margin-bottom: 24px; }
    .btn { background: #0891b2; color: #fff; border: 0; border-radius: 6px; padding: 8px 16px; font-weight: 600; cursor: pointer; font-size: 13px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.04em; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 26px; }
    .meta { color: #475569; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
    th { background: #f8fafc; font-weight: 600; }
    pre { white-space: pre-wrap; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .disclaimer { margin-top: 28px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    @media print { .toolbar { display: none; } body { margin: 0; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <span style="font-size:13px;font-weight:600;">CLAIMBACK Printable Claim Evidence &amp; Correspondence Dossier</span>
    <button class="btn" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <h1>${escapeHtmlSafe(claim.itemSummary)}</h1>
  <div class="meta">
    ${escapeHtmlSafe(claimTypeLabel(claim.claimType))} · Seller: <strong>${escapeHtmlSafe(
    claim.seller
  )}</strong> · Status: <strong>${escapeHtmlSafe(
    claimStatusLabel(claim.status)
  )}</strong> · Generated ${escapeHtmlSafe(formatHumanDate(todayYMD()))}
  </div>

  <h2>1. Reference &amp; Purchase Details</h2>
  <table>
    <tbody>
      <tr><th>Claim / RMA Reference</th><td>${escapeHtmlSafe(claim.referenceNumber || 'Pending')}</td><th>Original Receipt / Invoice</th><td>${escapeHtmlSafe(claim.receiptRef || 'Not recorded')}</td></tr>
      <tr><th>Purchase / Start Date</th><td>${escapeHtmlSafe(formatHumanDate(claim.purchaseDate))}</td><th>Claim Submitted Date</th><td>${escapeHtmlSafe(formatHumanDate(claim.dateSubmitted))}</td></tr>
      <tr><th>Proof File Reference</th><td colspan="3">${escapeHtmlSafe(linkedPurchase?.proofFile ? `${linkedPurchase.proofFile.fileName} (${linkedPurchase.proofFile.locationNote})` : 'No local file metadata attached')}</td></tr>
    </tbody>
  </table>

  <h2>2. Strict Financial Accounting (${escapeHtmlSafe(displayCurrency)})</h2>
  <table>
    <thead>
      <tr><th>Amount Requested</th><th>Seller Approved</th><th>Confirmed Payout Received</th><th>Payout Status</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>${escapeHtmlSafe(formatDisplayMoney(claim.amountRequested, recCur, displayCurrency))}</td>
        <td>${escapeHtmlSafe(formatDisplayMoney(claim.amountApproved, recCur, displayCurrency))}</td>
        <td><strong>${escapeHtmlSafe(claim.paymentReceived ? formatDisplayMoney(claim.amountReceived, recCur, displayCurrency) : formatCurrency(0, displayCurrency))}</strong></td>
        <td>${escapeHtmlSafe(claim.paymentReceived ? `Confirmed received on ${formatHumanDate(claim.dateReceived)}` : 'Awaiting confirmed payout')}</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Supporting Evidence Checklist</h2>
  <ul style="font-size:13px;padding-left:20px;">${checklistHtml || '<li>No checklist items recorded.</li>'}</ul>

  <h2>4. Chronological Activity Log</h2>
  <table>
    <thead><tr><th>Date</th><th>Recorded Event</th></tr></thead>
    <tbody>${historyHtml || '<tr><td colspan="2">No dated history entries recorded.</td></tr>'}</tbody>
  </table>

  <h2>5. Correspondence Draft</h2>
  <pre>${escapeHtmlSafe(letter)}</pre>

  <div class="disclaimer">
    Prepared with CLAIMBACK Consumer Protection Utility. Requested and seller-approved amounts are tracked separately from confirmed payouts. Correspondence letters are editable personal drafts, not legal advice; eligibility is governed by seller terms and applicable law.
  </div>
</body>
</html>`;
}

