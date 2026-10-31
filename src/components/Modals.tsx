import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Database,
  Download,
  FileCheck2,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  ClaimRecord,
  ClaimStatus,
  ClaimType,
  CurrencyCode,
  CustomDeadlineRecord,
  DeadlineCategory,
  DerivedDeadline,
  PolicySource,
  ProofFileMeta,
  PurchaseCategory,
  PurchaseRecord,
  PurchaseType,
  WarrantyUnit,
  WorkspaceState,
} from '../types';
import {
  addCalendarDays,
  addCalendarMonths,
  buildDefaultEvidenceChecklist,
  claimStatusLabel,
  CURRENCY_OPTIONS,
  downloadTextFile,
  formatCurrency,
  formatHumanDate,
  generateClaimLetter,
  getCurrencyConfig,
  ParsedReceiptFields,
  parseYMD,
  todayYMD,
} from '../utils/dateAndMoney';

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

const ModalShell: React.FC<ModalShellProps> = ({
  open,
  onClose,
  title,
  subtitle,
  maxWidthClass = 'max-w-2xl',
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${maxWidthClass} bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#263859] rounded-xl shadow-2xl my-auto max-h-[90vh] flex flex-col overflow-hidden`}
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1F2D47] flex items-start justify-between gap-4 shrink-0">
          <div>
            <h2 className="font-display font-bold text-lg text-slate-900 dark:text-slate-50">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#1C2A45] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 1. PURCHASE MODAL
 * ========================================================================== */
interface PurchaseModalProps {
  open: boolean;
  existing: PurchaseRecord | null;
  prefill?: Partial<ParsedReceiptFields> | null;
  displayCurrency: CurrencyCode;
  onClose: () => void;
  onSave: (record: PurchaseRecord) => void;
}

export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  open,
  existing,
  prefill,
  displayCurrency,
  onClose,
  onSave,
}) => {
  const [productName, setProductName] = useState('');
  const [seller, setSeller] = useState('');
  const [category, setCategory] = useState<PurchaseCategory>('electronics');
  const [purchaseType, setPurchaseType] = useState<PurchaseType>('purchase');
  const [purchaseDate, setPurchaseDate] = useState(todayYMD());
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(displayCurrency);
  const [receiptRef, setReceiptRef] = useState('');

  const [hasReturnWindow, setHasReturnWindow] = useState(true);
  const [returnDurationDays, setReturnDurationDays] = useState('30');
  const [returnExactDate, setReturnExactDate] = useState('');
  const [returnPolicySource, setReturnPolicySource] =
    useState<PolicySource>('user_estimate');

  const [hasWarranty, setHasWarranty] = useState(true);
  const [warrantyDurationValue, setWarrantyDurationValue] = useState('12');
  const [warrantyDurationUnit, setWarrantyDurationUnit] =
    useState<WarrantyUnit>('months');
  const [warrantyExactDate, setWarrantyExactDate] = useState('');
  const [warrantyPolicySource, setWarrantyPolicySource] =
    useState<PolicySource>('user_estimate');

  const [hasDeposit, setHasDeposit] = useState(false);
  const [depositDueDate, setDepositDueDate] = useState('');
  const [depositCondition, setDepositCondition] = useState('');

  const [proofFile, setProofFile] = useState<ProofFileMeta | null>(null);
  const [locationNote, setLocationNote] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (existing) {
      setProductName(existing.productName);
      setSeller(existing.seller);
      setCategory(existing.category);
      setPurchaseType(existing.purchaseType);
      setPurchaseDate(existing.purchaseDate);
      setAmount(String(existing.amount));
      setCurrency(existing.currency || 'USD');
      setReceiptRef(existing.receiptRef || '');
      setHasReturnWindow(existing.hasReturnWindow);
      setReturnDurationDays(
        existing.returnDurationDays !== null
          ? String(existing.returnDurationDays)
          : ''
      );
      setReturnExactDate(existing.returnExactDate || '');
      setReturnPolicySource(existing.returnPolicySource || 'user_estimate');
      setHasWarranty(existing.hasWarranty);
      setWarrantyDurationValue(
        existing.warrantyDurationValue !== null
          ? String(existing.warrantyDurationValue)
          : ''
      );
      setWarrantyDurationUnit(existing.warrantyDurationUnit || 'months');
      setWarrantyExactDate(existing.warrantyExactDate || '');
      setWarrantyPolicySource(existing.warrantyPolicySource || 'user_estimate');
      setHasDeposit(existing.hasDeposit || existing.purchaseType === 'deposit');
      setDepositDueDate(existing.depositDueDate || '');
      setDepositCondition(existing.depositCondition || '');
      setProofFile(existing.proofFile || null);
      setLocationNote(existing.proofFile?.locationNote || '');
      setNotes(existing.notes || '');
    } else {
      setProductName(prefill?.productName || '');
      setSeller(prefill?.seller || '');
      setCategory('electronics');
      setPurchaseType('purchase');
      setPurchaseDate(prefill?.purchaseDate || todayYMD());
      setAmount(prefill?.amount || '');
      setCurrency(prefill?.currency || displayCurrency);
      setReceiptRef(prefill?.receiptRef || '');
      setHasReturnWindow(true);
      setReturnDurationDays(prefill?.returnDays || '30');
      setReturnExactDate('');
      setReturnPolicySource('user_estimate');
      setHasWarranty(true);
      setWarrantyDurationValue(prefill?.warrantyMonths || '12');
      setWarrantyDurationUnit('months');
      setWarrantyExactDate('');
      setWarrantyPolicySource('user_estimate');
      setHasDeposit(false);
      setDepositDueDate('');
      setDepositCondition('');
      setProofFile(null);
      setLocationNote('');
      setNotes('');
    }
  }, [open, existing, prefill, displayCurrency]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const baseMeta: ProofFileMeta = {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
      locationNote: locationNote || `Local file: ${file.name}`,
      dataUrl: '',
      attachedAt: todayYMD(),
    };
    if (file.type.startsWith('image/') && file.size <= 250 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        setProofFile({
          ...baseMeta,
          dataUrl: typeof reader.result === 'string' ? reader.result : '',
        });
      };
      reader.readAsDataURL(file);
    } else {
      setProofFile(baseMeta);
    }
  };

  // Live preview dates
  const previewReturnDate = !hasReturnWindow
    ? null
    : returnExactDate && parseYMD(returnExactDate)
    ? returnExactDate
    : Number.isFinite(Number(returnDurationDays)) &&
      returnDurationDays.trim() !== '' &&
      Number(returnDurationDays) >= 0
    ? addCalendarDays(purchaseDate, Number(returnDurationDays))
    : null;

  const previewWarrantyDate = !hasWarranty
    ? null
    : warrantyExactDate && parseYMD(warrantyExactDate)
    ? warrantyExactDate
    : Number.isFinite(Number(warrantyDurationValue)) &&
      Number(warrantyDurationValue) > 0
    ? warrantyDurationUnit === 'days'
      ? addCalendarDays(purchaseDate, Number(warrantyDurationValue))
      : warrantyDurationUnit === 'years'
      ? addCalendarMonths(purchaseDate, Number(warrantyDurationValue) * 12)
      : addCalendarMonths(purchaseDate, Number(warrantyDurationValue))
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      setError('Product or deposit name is required.');
      return;
    }
    if (!seller.trim()) {
      setError('Seller or service provider name is required.');
      return;
    }
    if (!parseYMD(purchaseDate)) {
      setError('Enter a valid calendar purchase date.');
      return;
    }
    const parsedAmt = Number(amount);
    if (!Number.isFinite(parsedAmt) || parsedAmt < 0) {
      setError('Enter a valid non-negative purchase or deposit amount.');
      return;
    }

    if (hasReturnWindow && returnExactDate) {
      if (!parseYMD(returnExactDate) || returnExactDate < purchaseDate) {
        setError('Exact seller return cutoff cannot be earlier than purchase date.');
        return;
      }
    }
    if (hasWarranty && warrantyExactDate) {
      if (!parseYMD(warrantyExactDate) || warrantyExactDate < purchaseDate) {
        setError('Exact warranty end date cannot be earlier than purchase date.');
        return;
      }
    }
    if ((hasDeposit || purchaseType === 'deposit') && depositDueDate) {
      if (!parseYMD(depositDueDate) || depositDueDate < purchaseDate) {
        setError('Deposit due date cannot be earlier than purchase/start date.');
        return;
      }
    }

    const nowIso = new Date().toISOString();
    const finalProof = proofFile
      ? { ...proofFile, locationNote: locationNote.trim() || proofFile.locationNote }
      : locationNote.trim()
      ? {
          fileName: 'Local receipt note',
          fileSize: 0,
          fileType: 'text/plain',
          locationNote: locationNote.trim(),
          dataUrl: '',
          attachedAt: todayYMD(),
        }
      : null;

    const record: PurchaseRecord = {
      id: existing ? existing.id : `pur_${Date.now()}`,
      isSample: existing ? existing.isSample : false,
      productName: productName.trim(),
      seller: seller.trim(),
      category,
      purchaseType,
      purchaseDate,
      amount: parsedAmt,
      currency,
      receiptRef: receiptRef.trim(),
      hasReturnWindow,
      returnDurationDays:
        hasReturnWindow && returnDurationDays.trim() !== ''
          ? Math.max(0, Math.trunc(Number(returnDurationDays)))
          : null,
      returnExactDate: hasReturnWindow ? returnExactDate : '',
      returnPolicySource,
      hasWarranty,
      warrantyDurationValue:
        hasWarranty && warrantyDurationValue.trim() !== ''
          ? Math.max(1, Math.trunc(Number(warrantyDurationValue)))
          : null,
      warrantyDurationUnit,
      warrantyExactDate: hasWarranty ? warrantyExactDate : '',
      warrantyPolicySource,
      hasDeposit: hasDeposit || purchaseType === 'deposit',
      depositDueDate: hasDeposit || purchaseType === 'deposit' ? depositDueDate : '',
      depositCondition:
        hasDeposit || purchaseType === 'deposit' ? depositCondition.trim() : '',
      proofFile: finalProof,
      notes: notes.trim(),
      createdAt: existing ? existing.createdAt : nowIso,
      updatedAt: nowIso,
    };

    onSave(record);
  };

  const curCfg = getCurrencyConfig(currency);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={existing ? 'Edit Purchase / Deposit Record' : 'Add Purchase or Deposit'}
      subtitle="Seller written policies take precedence over estimated durations. Not every item has a return window or warranty."
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-xs">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Product or Deposit Name *
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g., 27-inch 4K IPS Monitor"
              className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Seller / Service Provider *
            </label>
            <input
              type="text"
              value={seller}
              onChange={(e) => setSeller(e.target.value)}
              placeholder="e.g., Croma Electronics / Boreal Tech"
              className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Record Type
            </label>
            <select
              value={purchaseType}
              onChange={(e) => {
                const v = e.target.value as PurchaseType;
                setPurchaseType(v);
                if (v === 'deposit') {
                  setHasDeposit(true);
                  setCategory('service_deposit');
                }
              }}
              className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
            >
              <option value="purchase">Retail Purchase</option>
              <option value="deposit">Refundable Deposit</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PurchaseCategory)}
              className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
            >
              <option value="electronics">Electronics</option>
              <option value="appliance">Appliance</option>
              <option value="apparel">Apparel</option>
              <option value="home">Home Goods</option>
              <option value="service_deposit">Service Deposit</option>
              <option value="other">Other Purchase</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              aria-label="Purchase currency"
              className="w-full px-2.5 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] font-mono"
            >
              {CURRENCY_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.code} ({opt.symbol})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Amount ({curCfg.symbol}) *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] font-mono tabular-nums text-right"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Purchase / Agreement Date *
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] font-mono tabular-nums"
              required
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Receipt / Invoice / GST Reference
            </label>
            <input
              type="text"
              value={receiptRef}
              onChange={(e) => setReceiptRef(e.target.value)}
              placeholder="e.g., INV-2026-44910 (leave blank to flag)"
              className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] font-mono"
            />
          </div>
        </div>

        {/* Return Window Section */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={hasReturnWindow}
                onChange={(e) => setHasReturnWindow(e.target.checked)}
                className="accent-cyan-500 w-4 h-4"
              />
              Item has a return window
            </label>
            {hasReturnWindow && (
              <span className="font-mono tabular-nums text-amber-600 dark:text-amber-400">
                Cutoff: {previewReturnDate ? formatHumanDate(previewReturnDate) : 'Set days or date'}
              </span>
            )}
          </div>

          {hasReturnWindow && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">
                  Window Length (Days)
                </label>
                <input
                  type="number"
                  min="0"
                  max="3650"
                  value={returnDurationDays}
                  onChange={(e) => setReturnDurationDays(e.target.value)}
                  className="w-full px-3 py-2 min-h-[36px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">
                  Exact Seller Cutoff (Optional)
                </label>
                <input
                  type="date"
                  value={returnExactDate}
                  onChange={(e) => setReturnExactDate(e.target.value)}
                  className="w-full px-3 py-2 min-h-[36px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">
                  Policy Verification
                </label>
                <select
                  value={returnPolicySource}
                  onChange={(e) =>
                    setReturnPolicySource(e.target.value as PolicySource)
                  }
                  className="w-full px-3 py-2 min-h-[36px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
                >
                  <option value="user_estimate">User-entered estimate</option>
                  <option value="seller_verified">Verified seller policy</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Warranty Section */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={hasWarranty}
                onChange={(e) => setHasWarranty(e.target.checked)}
                className="accent-cyan-500 w-4 h-4"
              />
              Item includes manufacturer / seller warranty
            </label>
            {hasWarranty && (
              <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                Ends: {previewWarrantyDate ? formatHumanDate(previewWarrantyDate) : 'Set duration'}
              </span>
            )}
          </div>

          {hasWarranty && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">
                  Warranty Duration
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="1200"
                    value={warrantyDurationValue}
                    onChange={(e) => setWarrantyDurationValue(e.target.value)}
                    className="w-20 px-2.5 py-2 min-h-[36px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] font-mono tabular-nums"
                  />
                  <select
                    value={warrantyDurationUnit}
                    onChange={(e) =>
                      setWarrantyDurationUnit(e.target.value as WarrantyUnit)
                    }
                    className="flex-1 px-2.5 py-2 min-h-[36px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
                  >
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">
                  Exact Warranty End (Optional)
                </label>
                <input
                  type="date"
                  value={warrantyExactDate}
                  onChange={(e) => setWarrantyExactDate(e.target.value)}
                  className="w-full px-3 py-2 min-h-[36px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">
                  Policy Verification
                </label>
                <select
                  value={warrantyPolicySource}
                  onChange={(e) =>
                    setWarrantyPolicySource(e.target.value as PolicySource)
                  }
                  className="w-full px-3 py-2 min-h-[36px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
                >
                  <option value="user_estimate">User-entered estimate</option>
                  <option value="seller_verified">Verified warranty terms</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Refundable Deposit Section */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <label className="inline-flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={hasDeposit || purchaseType === 'deposit'}
              onChange={(e) => setHasDeposit(e.target.checked)}
              disabled={purchaseType === 'deposit'}
              className="accent-cyan-500 w-4 h-4"
            />
            Track refundable deposit due date &amp; return condition
          </label>

          {(hasDeposit || purchaseType === 'deposit') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">
                  Target Deposit Return Date
                </label>
                <input
                  type="date"
                  value={depositDueDate}
                  onChange={(e) => setDepositDueDate(e.target.value)}
                  className="w-full px-3 py-2 min-h-[36px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">
                  Deposit Return Condition
                </label>
                <input
                  type="text"
                  value={depositCondition}
                  onChange={(e) => setDepositCondition(e.target.value)}
                  placeholder="e.g., Return router kit within 14 days"
                  className="w-full px-3 py-2 min-h-[36px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Proof File Reference & Notes */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Attach Local Receipt Metadata (Never Uploaded)
              </label>
              <input
                type="file"
                accept=".pdf,image/*,.txt"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-slate-200 dark:file:bg-[#1E2D4A] file:text-slate-800 dark:file:text-slate-100 file:font-semibold file:cursor-pointer"
              />
              {proofFile && (
                <div className="mt-1 flex items-center justify-between text-[11px] text-cyan-600 dark:text-cyan-400">
                  <span className="truncate">{proofFile.fileName}</span>
                  <button
                    type="button"
                    onClick={() => setProofFile(null)}
                    className="text-red-500 hover:underline ml-2 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Where Proof Is Stored Locally
              </label>
              <input
                type="text"
                value={locationNote}
                onChange={(e) => setLocationNote(e.target.value)}
                placeholder="e.g., Documents/Receipts/2026 or Email folder"
                className="w-full px-3 py-2 min-h-[36px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Serial Number / Condition Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Serial #, defect observations, or packaging condition..."
              className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 min-h-[38px] rounded-lg border border-slate-200 dark:border-[#293B5C] font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 min-h-[38px] rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold cursor-pointer"
          >
            {existing ? 'Save Changes' : 'Save to Purchase Vault'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

/* ============================================================================
 * 2. CLAIM MODAL
 * ========================================================================== */
interface ClaimModalProps {
  open: boolean;
  existing: ClaimRecord | null;
  initialPurchaseId?: string;
  initialClaimType?: ClaimType;
  purchases: PurchaseRecord[];
  displayCurrency: CurrencyCode;
  onClose: () => void;
  onSave: (claim: ClaimRecord) => void;
}

export const ClaimModal: React.FC<ClaimModalProps> = ({
  open,
  existing,
  initialPurchaseId = '',
  initialClaimType = 'return',
  purchases,
  displayCurrency,
  onClose,
  onSave,
}) => {
  const [purchaseId, setPurchaseId] = useState('');
  const [claimType, setClaimType] = useState<ClaimType>('return');
  const [itemSummary, setItemSummary] = useState('');
  const [seller, setSeller] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [receiptRef, setReceiptRef] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [dateSubmitted, setDateSubmitted] = useState(todayYMD());
  const [responseDueDate, setResponseDueDate] = useState('');
  const [status, setStatus] = useState<ClaimStatus>('draft');

  const [currency, setCurrency] = useState<CurrencyCode>(displayCurrency);
  const [amountRequested, setAmountRequested] = useState('0');
  const [amountApproved, setAmountApproved] = useState('0');
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [amountReceived, setAmountReceived] = useState('0');
  const [dateReceived, setDateReceived] = useState('');

  const [issueDescription, setIssueDescription] = useState('');
  const [preferredResolution, setPreferredResolution] = useState('');
  const [error, setError] = useState('');

  const applyPurchaseLink = (pid: string, nextType?: ClaimType) => {
    setPurchaseId(pid);
    const p = purchases.find((x) => x.id === pid);
    if (!p) return;
    setItemSummary(p.productName);
    setSeller(p.seller);
    setPurchaseDate(p.purchaseDate);
    setReceiptRef(p.receiptRef || '');
    setCurrency(p.currency || displayCurrency);
    const t = nextType || claimType;
    setAmountRequested(t === 'repair' ? '0' : String(p.amount));
  };

  useEffect(() => {
    if (!open) return;
    setError('');
    if (existing) {
      setPurchaseId(existing.purchaseId || '');
      setClaimType(existing.claimType);
      setItemSummary(existing.itemSummary);
      setSeller(existing.seller);
      setPurchaseDate(existing.purchaseDate || '');
      setReceiptRef(existing.receiptRef || '');
      setReferenceNumber(existing.referenceNumber || '');
      setDateSubmitted(existing.dateSubmitted || '');
      setResponseDueDate(existing.responseDueDate || '');
      setStatus(existing.status);
      setCurrency(existing.currency || 'USD');
      setAmountRequested(String(existing.amountRequested));
      setAmountApproved(String(existing.amountApproved));
      setPaymentReceived(Boolean(existing.paymentReceived));
      setAmountReceived(String(existing.amountReceived));
      setDateReceived(existing.dateReceived || '');
      setIssueDescription(existing.issueDescription || '');
      setPreferredResolution(existing.preferredResolution || '');
    } else {
      setClaimType(initialClaimType);
      setReferenceNumber('');
      setDateSubmitted(todayYMD());
      setResponseDueDate(addCalendarDays(todayYMD(), 14) || '');
      setStatus('draft');
      setCurrency(displayCurrency);
      setAmountApproved('0');
      setPaymentReceived(false);
      setAmountReceived('0');
      setDateReceived('');
      setIssueDescription('');
      setPreferredResolution('');

      if (initialPurchaseId) {
        const p = purchases.find((x) => x.id === initialPurchaseId);
        setPurchaseId(initialPurchaseId);
        if (p) {
          setItemSummary(p.productName);
          setSeller(p.seller);
          setPurchaseDate(p.purchaseDate);
          setReceiptRef(p.receiptRef || '');
          setCurrency(p.currency || displayCurrency);
          setAmountRequested(initialClaimType === 'repair' ? '0' : String(p.amount));
          setIssueDescription(p.notes || '');
        }
      } else {
        setPurchaseId('');
        setItemSummary('');
        setSeller('');
        setPurchaseDate(todayYMD());
        setReceiptRef('');
        setAmountRequested('0');
      }
    }
  }, [
    open,
    existing,
    initialPurchaseId,
    initialClaimType,
    purchases,
    displayCurrency,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemSummary.trim()) {
      setError('Item or claim summary is required.');
      return;
    }
    if (!seller.trim()) {
      setError('Seller or service provider name is required.');
      return;
    }

    const req = Number(amountRequested);
    const app = Number(amountApproved);
    const rec = paymentReceived ? Number(amountReceived) : 0;

    if (!Number.isFinite(req) || req < 0) {
      setError('Requested amount must be 0 or greater.');
      return;
    }
    if (!Number.isFinite(app) || app < 0) {
      setError('Seller-approved amount must be 0 or greater.');
      return;
    }
    if (paymentReceived) {
      if (!Number.isFinite(rec) || rec <= 0) {
        setError('Enter the positive payout amount actually received.');
        return;
      }
      if (!parseYMD(dateReceived)) {
        setError('Enter the calendar date when payout funds were received.');
        return;
      }
      if (purchaseDate && parseYMD(purchaseDate) && dateReceived < purchaseDate) {
        setError('Date received cannot be earlier than the purchase date.');
        return;
      }
    }

    if (dateSubmitted && purchaseDate && parseYMD(dateSubmitted) && parseYMD(purchaseDate)) {
      if (dateSubmitted < purchaseDate) {
        setError('Claim submission date cannot precede the purchase date.');
        return;
      }
    }

    const nowIso = new Date().toISOString();
    const linkedPurchase = purchases.find((p) => p.id === purchaseId);
    const checklist = existing
      ? existing.evidenceChecklist
      : buildDefaultEvidenceChecklist(
          claimType,
          receiptRef.trim(),
          Boolean(linkedPurchase?.proofFile)
        );

    const history = existing
      ? [...existing.history]
      : [
          {
            id: `his_${Date.now()}`,
            date: dateSubmitted || todayYMD(),
            note: `Claim created (${claimStatusLabel(status)}).`,
          },
        ];

    if (existing && !existing.paymentReceived && paymentReceived) {
      history.push({
        id: `his_${Date.now()}_pay`,
        date: dateReceived || todayYMD(),
        note: `Confirmed payout received: ${formatCurrency(rec, currency)}.`,
      });
    }

    const draftRecord: ClaimRecord = {
      id: existing ? existing.id : `clm_${Date.now()}`,
      isSample: existing ? existing.isSample : false,
      purchaseId,
      claimType,
      itemSummary: itemSummary.trim(),
      seller: seller.trim(),
      purchaseDate,
      receiptRef: receiptRef.trim(),
      referenceNumber: referenceNumber.trim(),
      dateSubmitted,
      responseDueDate,
      status: paymentReceived && status === 'draft' ? 'resolved' : status,
      currency,
      amountRequested: req,
      amountApproved: app,
      amountReceived: paymentReceived ? rec : 0,
      paymentReceived,
      dateReceived: paymentReceived ? dateReceived : '',
      issueDescription: issueDescription.trim(),
      preferredResolution: preferredResolution.trim(),
      letterDraft: existing ? existing.letterDraft : '',
      letterTone: existing ? existing.letterTone : 'polite_standard',
      senderName: existing ? existing.senderName : '',
      evidenceChecklist: checklist,
      history,
      createdAt: existing ? existing.createdAt : nowIso,
      updatedAt: nowIso,
    };

    if (!draftRecord.letterDraft) {
      draftRecord.letterDraft = generateClaimLetter(draftRecord, displayCurrency);
    }

    onSave(draftRecord);
  };

  const curCfg = getCurrencyConfig(currency);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={existing ? 'Edit Claim & Payout Accounting' : 'Create Recovery Claim'}
      subtitle="Requested, seller-approved, and confirmed received amounts are tracked separately."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
            Link to Purchase Vault Record (Optional)
          </label>
          <select
            value={purchaseId}
            onChange={(e) => applyPurchaseLink(e.target.value)}
            className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
          >
            <option value="">— Standalone Claim (Not linked) —</option>
            {purchases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.productName} — {p.seller} (
                {formatCurrency(p.amount, p.currency || 'USD')})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Claim Type
            </label>
            <select
              value={claimType}
              onChange={(e) => setClaimType(e.target.value as ClaimType)}
              className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
            >
              <option value="refund">Refund Request</option>
              <option value="return">Product Return</option>
              <option value="repair">Warranty Repair</option>
              <option value="replacement">Replacement</option>
              <option value="deposit">Deposit Release</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ClaimStatus)}
              className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
            >
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="awaiting_response">Awaiting Response</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Claim Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] font-mono"
            >
              {CURRENCY_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.code} ({opt.symbol})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Item / Claim Summary *
            </label>
            <input
              type="text"
              value={itemSummary}
              onChange={(e) => setItemSummary(e.target.value)}
              required
              className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Seller / Provider *
            </label>
            <input
              type="text"
              value={seller}
              onChange={(e) => setSeller(e.target.value)}
              required
              className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-slate-600 dark:text-slate-400 mb-1">
              Purchase Date
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full px-2.5 py-2 min-h-[36px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-slate-600 dark:text-slate-400 mb-1">
              Date Submitted
            </label>
            <input
              type="date"
              value={dateSubmitted}
              onChange={(e) => setDateSubmitted(e.target.value)}
              className="w-full px-2.5 py-2 min-h-[36px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-slate-600 dark:text-slate-400 mb-1">
              Response Target
            </label>
            <input
              type="date"
              value={responseDueDate}
              onChange={(e) => setResponseDueDate(e.target.value)}
              className="w-full px-2.5 py-2 min-h-[36px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-slate-600 dark:text-slate-400 mb-1">
              Seller RMA / Claim Ref #
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g., RMA-88210"
              className="w-full px-2.5 py-2 min-h-[36px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] font-mono"
            />
          </div>
        </div>

        {/* Strict Financial Accounting Box */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] space-y-3">
          <div className="font-semibold text-slate-800 dark:text-slate-200">
            Strict Money Accounting ({curCfg.code} {curCfg.symbol})
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1">
                Amount Requested ({curCfg.symbol})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountRequested}
                onChange={(e) => setAmountRequested(e.target.value)}
                className="w-full px-3 py-2 min-h-[36px] rounded-lg bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#293B5C] font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1">
                Seller Approved Amount ({curCfg.symbol})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountApproved}
                onChange={(e) => setAmountApproved(e.target.value)}
                className="w-full px-3 py-2 min-h-[36px] rounded-lg bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#293B5C] font-mono tabular-nums"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 pt-1 font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer">
            <input
              type="checkbox"
              checked={paymentReceived}
              onChange={(e) => {
                const checked = e.target.checked;
                setPaymentReceived(checked);
                if (checked) {
                  if (Number(amountReceived) <= 0) {
                    setAmountReceived(
                      Number(amountApproved) > 0
                        ? amountApproved
                        : amountRequested
                    );
                  }
                  if (!dateReceived) setDateReceived(todayYMD());
                }
              }}
              className="accent-emerald-500 w-4 h-4"
            />
            Confirm payout funds have actually been received
          </label>

          {paymentReceived && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">
                  Confirmed Amount Received ({curCfg.symbol}) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  className="w-full px-3 py-2 min-h-[36px] rounded-lg bg-white dark:bg-[#121A2D] border border-emerald-500/50 font-mono tabular-nums"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">
                  Date Payout Received *
                </label>
                <input
                  type="date"
                  value={dateReceived}
                  onChange={(e) => setDateReceived(e.target.value)}
                  className="w-full px-3 py-2 min-h-[36px] rounded-lg bg-white dark:bg-[#121A2D] border border-emerald-500/50 font-mono tabular-nums"
                  required
                />
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Issue / Basis for Claim
            </label>
            <textarea
              rows={2}
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="Describe the defect, return reason, or deposit release condition..."
              className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Preferred Resolution
            </label>
            <textarea
              rows={2}
              value={preferredResolution}
              onChange={(e) => setPreferredResolution(e.target.value)}
              placeholder="e.g., Full refund to original UPI / card payment method."
              className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 min-h-[38px] rounded-lg border border-slate-200 dark:border-[#293B5C] font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 min-h-[38px] rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold cursor-pointer"
          >
            {existing ? 'Save Claim Updates' : 'Create Claim'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

/* ============================================================================
 * 3. PREP DATE MODAL
 * ========================================================================== */
interface PrepDateModalProps {
  open: boolean;
  deadline: DerivedDeadline | null;
  onClose: () => void;
  onSave: (deadlineId: string, prepDate: string, userNote: string) => void;
}

export const PrepDateModal: React.FC<PrepDateModalProps> = ({
  open,
  deadline,
  onClose,
  onSave,
}) => {
  const [prepDate, setPrepDate] = useState('');
  const [userNote, setUserNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !deadline) return;
    setError('');
    setPrepDate(
      deadline.prepDate ||
        (deadline.dueDate ? addCalendarDays(deadline.dueDate, -3) || '' : todayYMD())
    );
    setUserNote(deadline.userNote || '');
  }, [open, deadline]);

  if (!deadline) return null;

  const applyOffset = (daysBefore: number) => {
    if (!deadline.dueDate) return;
    const candidate = addCalendarDays(deadline.dueDate, -daysBefore);
    if (candidate) setPrepDate(candidate);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prepDate) {
      if (!parseYMD(prepDate)) {
        setError('Enter a valid calendar preparation date.');
        return;
      }
      if (deadline.dueDate && prepDate > deadline.dueDate) {
        setError('Preparation date cannot be after the final cutoff date.');
        return;
      }
    }
    onSave(deadline.id, prepDate, userNote.trim());
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Set Earlier Preparation Date"
      subtitle={`${deadline.title} · Cutoff ${formatHumanDate(deadline.dueDate)}`}
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {deadline.dueDate && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Quick lead time:</span>
            {[3, 7, 14].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => applyOffset(d)}
                className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#19253D] hover:bg-slate-200 dark:hover:bg-[#223252] font-mono font-semibold cursor-pointer"
              >
                -{d}d
              </button>
            ))}
          </div>
        )}

        <div>
          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
            Target Preparation Date
          </label>
          <input
            type="date"
            value={prepDate}
            onChange={(e) => setPrepDate(e.target.value)}
            className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] font-mono tabular-nums"
          />
        </div>

        <div>
          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
            Preparation Action Note
          </label>
          <textarea
            rows={3}
            value={userNote}
            onChange={(e) => setUserNote(e.target.value)}
            placeholder="e.g., Photograph serial plate, pack accessories, request RMA label..."
            className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => onSave(deadline.id, '', userNote.trim())}
            className="text-slate-500 hover:text-red-500 cursor-pointer"
          >
            Clear Prep Date
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-[#293B5C] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold cursor-pointer"
            >
              Save Prep Target
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
};

/* ============================================================================
 * 4. CUSTOM STANDALONE DEADLINE MODAL
 * ========================================================================== */
interface CustomDeadlineModalProps {
  open: boolean;
  displayCurrency: CurrencyCode;
  onClose: () => void;
  onSave: (record: CustomDeadlineRecord) => void;
}

export const CustomDeadlineModal: React.FC<CustomDeadlineModalProps> = ({
  open,
  displayCurrency,
  onClose,
  onSave,
}) => {
  const [type, setType] = useState<DeadlineCategory>('deposit');
  const [title, setTitle] = useState('');
  const [seller, setSeller] = useState('');
  const [startDate, setStartDate] = useState(todayYMD());
  const [dueDate, setDueDate] = useState(addCalendarDays(todayYMD(), 14) || '');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(displayCurrency);
  const [receiptRef, setReceiptRef] = useState('');
  const [policySource, setPolicySource] = useState<PolicySource>('seller_verified');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setTitle('');
    setSeller('');
    setStartDate(todayYMD());
    setDueDate(addCalendarDays(todayYMD(), 14) || '');
    setAmount('');
    setCurrency(displayCurrency);
    setReceiptRef('');
    setNotes('');
  }, [open, displayCurrency]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !seller.trim()) {
      setError('Title and seller/provider name are required.');
      return;
    }
    if (!parseYMD(startDate) || !parseYMD(dueDate)) {
      setError('Enter valid calendar dates.');
      return;
    }
    if (dueDate < startDate) {
      setError('Deadline cutoff date cannot be earlier than start date.');
      return;
    }
    const amt = amount.trim() === '' ? 0 : Number(amount);
    if (!Number.isFinite(amt) || amt < 0) {
      setError('Enter a valid non-negative amount.');
      return;
    }

    onSave({
      id: `cd_${Date.now()}`,
      isSample: false,
      type,
      title: title.trim(),
      seller: seller.trim(),
      startDate,
      dueDate,
      amount: amt,
      currency,
      receiptRef: receiptRef.trim(),
      policySource,
      notes: notes.trim(),
    });
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Log Standalone Deadline"
      subtitle="Track a rental deposit, credit dispute window, or service cancellation cutoff."
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        {error && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-medium mb-1">Deadline Category</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DeadlineCategory)}
              className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
            >
              <option value="deposit">Refundable Deposit</option>
              <option value="refund">Refund Follow-Up</option>
              <option value="return">Return Window</option>
              <option value="warranty">Warranty Expiration</option>
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Policy Verification</label>
            <select
              value={policySource}
              onChange={(e) => setPolicySource(e.target.value as PolicySource)}
              className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
            >
              <option value="seller_verified">Verified written policy</option>
              <option value="user_estimate">User-entered estimate</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-medium mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Apartment Move-Out Security Deposit"
              required
              className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Seller / Provider *</label>
            <input
              type="text"
              value={seller}
              onChange={(e) => setSeller(e.target.value)}
              placeholder="e.g., Skyline Estates"
              required
              className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium mb-1">Start Date *</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Cutoff / Due Date *</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] font-mono tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block font-medium mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="w-full px-2.5 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] font-mono"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Reference #</label>
            <input
              type="text"
              value={receiptRef}
              onChange={(e) => setReceiptRef(e.target.value)}
              placeholder="Agreement #"
              className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block font-medium mb-1">Condition / Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Refundable within 30 days of key handover"
            className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47]"
          />
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-[#293B5C] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold cursor-pointer"
          >
            Add Deadline
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

/* ============================================================================
 * 5. PROOF INSPECTOR MODAL
 * ========================================================================== */
export const ProofInspectorModal: React.FC<{
  purchase: PurchaseRecord | null;
  onClose: () => void;
}> = ({ purchase, onClose }) => {
  if (!purchase || !purchase.proofFile) return null;
  const pf = purchase.proofFile;

  return (
    <ModalShell
      open={Boolean(purchase)}
      onClose={onClose}
      title="Proof-of-Purchase Reference"
      subtitle={`${purchase.productName} · ${purchase.seller}`}
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4 text-xs">
        <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] space-y-2">
          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
            <FileCheck2 className="w-4 h-4 text-cyan-500" />
            <span>{pf.fileName}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400 pt-1">
            <div>
              <span className="block text-slate-400">Receipt Reference</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {purchase.receiptRef || '—'}
              </span>
            </div>
            <div>
              <span className="block text-slate-400">File Size</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {pf.fileSize > 0
                  ? `${(pf.fileSize / 1024).toFixed(1)} KB`
                  : 'Metadata reference'}
              </span>
            </div>
            <div className="col-span-2">
              <span className="block text-slate-400">Local Archive Location</span>
              <span className="text-slate-800 dark:text-slate-200">
                {pf.locationNote || 'Stored on local device'}
              </span>
            </div>
          </div>
        </div>

        {pf.dataUrl && (
          <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-[#1F2D47]">
            <img
              src={pf.dataUrl}
              alt={`Receipt preview for ${purchase.productName}`}
              className="w-full max-h-64 object-contain bg-slate-950"
            />
          </div>
        )}

        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Privacy guarantee: Receipt files and references remain inside your
          local workspace and are never uploaded to external third-party servers.
        </p>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-[#1E2D4A] text-white font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

/* ============================================================================
 * 6. CONFIRMATION DIALOG
 * ========================================================================== */
export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm Delete',
  onCancel,
  onConfirm,
}) => {
  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      title={title}
      maxWidthClass="max-w-md"
    >
      <div className="space-y-5 text-xs">
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {message}
        </p>
        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 min-h-[38px] rounded-lg border border-slate-200 dark:border-[#293B5C] font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 min-h-[38px] rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

/* ============================================================================
 * 7. BACKUPS & DATA PRIVACY MODAL
 * ========================================================================== */
interface BackupPrivacyModalProps {
  open: boolean;
  workspace: WorkspaceState;
  onClose: () => void;
  onImportWorkspace: (next: WorkspaceState) => void;
  onRestoreSamples: () => void;
  onClearAllData: () => void;
  onNotify: (msg: string) => void;
}

export const BackupPrivacyModal: React.FC<BackupPrivacyModalProps> = ({
  open,
  workspace,
  onClose,
  onImportWorkspace,
  onRestoreSamples,
  onClearAllData,
  onNotify,
}) => {
  const [importError, setImportError] = useState('');

  const handleExportJson = () => {
    const payload = {
      app: 'CLAIMBACK',
      version: 1,
      exportedAt: new Date().toISOString(),
      ...workspace,
    };
    downloadTextFile(
      `claimback-workspace-backup-${todayYMD()}.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8;'
    );
    onNotify('Downloaded full JSON workspace backup.');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (!Array.isArray(parsed.purchases) || !Array.isArray(parsed.claims)) {
          setImportError(
            'Invalid backup file: expected purchases and claims arrays.'
          );
          return;
        }
        onImportWorkspace({
          purchases: parsed.purchases,
          deadlineMeta: parsed.deadlineMeta || {},
          customDeadlines: Array.isArray(parsed.customDeadlines)
            ? parsed.customDeadlines
            : [],
          claims: parsed.claims,
        });
        onNotify('Imported workspace backup successfully.');
        onClose();
      } catch {
        setImportError('Could not parse JSON file. Verify the backup file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Workspace Backups & Privacy"
      subtitle="Export portable JSON backups, restore INR sample records, or inspect local storage guarantees."
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-5 text-xs">
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] space-y-2">
          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
            <ShieldCheck className="w-4 h-4 text-cyan-500" />
            <span>Local Storage &amp; Consumer Privacy</span>
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            CLAIMBACK persists your records in browser{' '}
            <code className="font-mono">localStorage</code> (mirrored to your
            local app session). Browser storage is not encrypted cloud storage
            and can be lost if browser site data is cleared — export JSON
            backups periodically for important records.
          </p>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
            Never enter bank credentials, card numbers, UPI PINs, or account
            passwords. Generated claim letters are editable correspondence
            drafts, not legal advice.
          </p>
        </div>

        {importError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400">
            {importError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleExportJson}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export JSON Backup
          </button>

          <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-slate-200 dark:border-[#293B5C] hover:bg-slate-100 dark:hover:bg-[#19253D] font-semibold cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Import JSON Backup</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportJson}
              className="hidden"
            />
          </label>
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onRestoreSamples();
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-[#293B5C] hover:bg-slate-100 dark:hover:bg-[#19253D] font-medium cursor-pointer"
          >
            <Database className="w-3.5 h-3.5 text-cyan-500" />
            Restore Sample Dataset (INR ₹)
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onClearAllData();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-500/10 font-semibold cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All Workspace Data
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
