import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Download,
  Edit3,
  FileCheck2,
  LayoutGrid,
  List,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  ClaimRecord,
  CurrencyCode,
  DeadlineMetaEntry,
  PurchaseRecord,
} from '../types';
import {
  categoryLabel,
  computeDepositDeadline,
  computeReturnDeadline,
  computeWarrantyDeadline,
  convertCurrencyAmount,
  downloadTextFile,
  formatCurrency,
  formatDisplayMoney,
  formatHumanDate,
  todayYMD,
} from '../utils/dateAndMoney';

interface VaultSectionProps {
  purchases: PurchaseRecord[];
  claims: ClaimRecord[];
  deadlineMeta: Record<string, DeadlineMetaEntry>;
  displayCurrency: CurrencyCode;
  highlightedPurchaseId: string;
  onAddPurchase: () => void;
  onEditPurchase: (purchase: PurchaseRecord) => void;
  onDeletePurchase: (purchase: PurchaseRecord) => void;
  onInspectProof: (purchase: PurchaseRecord) => void;
  onStartClaim: (purchaseId: string, suggestedType?: string) => void;
  onViewLinkedClaims: (purchaseId: string) => void;
  onRestoreSamples: () => void;
  onNotify: (msg: string) => void;
}

export const VaultSection: React.FC<VaultSectionProps> = ({
  purchases,
  claims,
  deadlineMeta,
  displayCurrency,
  highlightedPurchaseId,
  onAddPurchase,
  onEditPurchase,
  onDeletePurchase,
  onInspectProof,
  onStartClaim,
  onViewLinkedClaims,
  onRestoreSamples,
  onNotify,
}) => {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [search, setSearch] = useState('');
  const [coverageFilter, setCoverageFilter] = useState<
    'all' | 'open_return' | 'active_warranty' | 'deposits' | 'flagged'
  >('all');
  const [policySource, setPolicySource] = useState<
    'all' | 'seller_verified' | 'user_estimate'
  >('all');
  const [sortBy, setSortBy] = useState<
    'date_desc' | 'return_asc' | 'warranty_asc' | 'amount_desc'
  >('date_desc');

  const hasIssue = (p: PurchaseRecord) => {
    const ret = computeReturnDeadline(p);
    const war = computeWarrantyDeadline(p);
    const dep = computeDepositDeadline(p);
    const retState = deadlineMeta[`ret_${p.id}`]?.actionState;
    const depState = deadlineMeta[`dep_${p.id}`]?.actionState;
    const missingReceipt = !p.receiptRef || !p.receiptRef.trim();
    const missingDate = ret.missingInfo || war.missingInfo || dep.missingInfo;
    const overdueRet =
      ret.applicable &&
      ret.daysRemaining !== null &&
      ret.daysRemaining < 0 &&
      retState !== 'completed' &&
      retState !== 'not_applicable';
    const overdueDep =
      dep.applicable &&
      dep.daysRemaining !== null &&
      dep.daysRemaining < 0 &&
      depState !== 'completed' &&
      depState !== 'not_applicable';
    return missingReceipt || missingDate || overdueRet || overdueDep;
  };

  const filteredPurchases = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = purchases.filter((p) => {
      const ret = computeReturnDeadline(p);
      const war = computeWarrantyDeadline(p);
      const retState = deadlineMeta[`ret_${p.id}`]?.actionState;

      if (q) {
        const hay = [
          p.productName,
          p.seller,
          p.receiptRef,
          p.notes,
          categoryLabel(p.category),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (policySource === 'seller_verified') {
        const ok =
          (p.hasReturnWindow && p.returnPolicySource === 'seller_verified') ||
          (p.hasWarranty && p.warrantyPolicySource === 'seller_verified');
        if (!ok) return false;
      } else if (policySource === 'user_estimate') {
        const ok =
          (p.hasReturnWindow && p.returnPolicySource === 'user_estimate') ||
          (p.hasWarranty && p.warrantyPolicySource === 'user_estimate');
        if (!ok) return false;
      }

      if (coverageFilter === 'open_return') {
        return (
          ret.applicable &&
          ret.daysRemaining !== null &&
          ret.daysRemaining >= 0 &&
          retState !== 'completed' &&
          retState !== 'not_applicable'
        );
      }
      if (coverageFilter === 'active_warranty') {
        return war.applicable && war.daysRemaining !== null && war.daysRemaining >= 0;
      }
      if (coverageFilter === 'deposits') {
        return p.purchaseType === 'deposit' || p.hasDeposit;
      }
      if (coverageFilter === 'flagged') {
        return hasIssue(p);
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'amount_desc') {
        return (
          convertCurrencyAmount(b.amount, b.currency, displayCurrency) -
          convertCurrencyAmount(a.amount, a.currency, displayCurrency)
        );
      }
      if (sortBy === 'return_asc') {
        const ra = computeReturnDeadline(a);
        const rb = computeReturnDeadline(b);
        return (ra.daysRemaining ?? 999999) - (rb.daysRemaining ?? 999999);
      }
      if (sortBy === 'warranty_asc') {
        const wa = computeWarrantyDeadline(a);
        const wb = computeWarrantyDeadline(b);
        return (wa.daysRemaining ?? 999999) - (wb.daysRemaining ?? 999999);
      }
      return (b.purchaseDate || '').localeCompare(a.purchaseDate || '');
    });
    return list;
  }, [
    purchases,
    search,
    coverageFilter,
    policySource,
    sortBy,
    deadlineMeta,
    displayCurrency,
  ]);

  const handleExportCsv = () => {
    if (filteredPurchases.length === 0) {
      onNotify('No purchase records to export.');
      return;
    }
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = [
      'Product Name',
      'Seller',
      'Type',
      'Category',
      'Purchase Date',
      'Original Amount',
      'Original Currency',
      `Amount (${displayCurrency})`,
      'Receipt Ref',
      'Return Cutoff',
      'Return Days Left',
      'Return Policy Source',
      'Warranty End',
      'Warranty Days Left',
      'Warranty Policy Source',
      'Deposit Due Date',
      'Sample Record',
    ];
    const rows = [headers.map(cell).join(',')];
    for (const p of filteredPurchases) {
      const ret = computeReturnDeadline(p);
      const war = computeWarrantyDeadline(p);
      const dep = computeDepositDeadline(p);
      const converted = convertCurrencyAmount(
        p.amount,
        p.currency,
        displayCurrency
      );
      rows.push(
        [
          p.productName,
          p.seller,
          p.purchaseType,
          categoryLabel(p.category),
          p.purchaseDate,
          Number(p.amount).toFixed(2),
          p.currency || 'USD',
          converted.toFixed(2),
          p.receiptRef || '',
          ret.applicable ? ret.dueDate || 'Missing' : 'N/A',
          ret.applicable && ret.daysRemaining !== null ? ret.daysRemaining : 'N/A',
          p.hasReturnWindow ? p.returnPolicySource : 'N/A',
          war.applicable ? war.dueDate || 'Missing' : 'N/A',
          war.applicable && war.daysRemaining !== null ? war.daysRemaining : 'N/A',
          p.hasWarranty ? p.warrantyPolicySource : 'N/A',
          dep.applicable ? dep.dueDate || 'Missing' : 'N/A',
          p.isSample ? 'Yes' : 'No',
        ]
          .map(cell)
          .join(',')
      );
    }
    downloadTextFile(
      `claimback-vault-${displayCurrency.toLowerCase()}-${todayYMD()}.csv`,
      rows.join('\r\n'),
      'text/csv;charset=utf-8;'
    );
    onNotify(
      `Exported ${filteredPurchases.length} records in ${displayCurrency} to CSV.`
    );
  };

  const renderCountdownText = (days: number | null, actionState?: string) => {
    if (actionState === 'completed') {
      return (
        <span className="font-mono tabular-nums text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          ✓ Completed
        </span>
      );
    }
    if (actionState === 'not_applicable') {
      return (
        <span className="font-mono tabular-nums text-xs text-slate-400">
          Marked N/A
        </span>
      );
    }
    if (days === null) {
      return (
        <span className="font-mono tabular-nums text-xs font-semibold text-red-600 dark:text-red-400">
          ! Date missing
        </span>
      );
    }
    if (days < 0) {
      return (
        <span className="font-mono tabular-nums text-xs font-semibold text-red-600 dark:text-red-400">
          ! {Math.abs(days)}d past
        </span>
      );
    }
    if (days === 0) {
      return (
        <span className="font-mono tabular-nums text-xs font-semibold text-red-600 dark:text-red-400">
          ! Due today
        </span>
      );
    }
    if (days <= 14) {
      return (
        <span className="font-mono tabular-nums text-xs font-semibold text-amber-600 dark:text-amber-400">
          ▲ {days}d left
        </span>
      );
    }
    return (
      <span className="font-mono tabular-nums text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        {days}d left
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
            Purchase Vault
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-[68ch]">
            Track receipts, return windows, warranty terms, and refundable
            deposits. Seller-verified policies are distinguished from
            user-entered estimates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className="inline-flex p-1 rounded-lg bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47]"
            role="group"
            aria-label="Switch vault layout"
          >
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-slate-900 text-white dark:bg-[#1E2D4A] dark:text-slate-50'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-slate-900 text-white dark:bg-[#1E2D4A] dark:text-slate-50'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Ledger
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] hover:border-slate-400 dark:hover:border-slate-500 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV ({displayCurrency})
          </button>

          <button
            type="button"
            onClick={onAddPurchase}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Purchase
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product, seller, receipt reference, or serial notes..."
              className="w-full pl-9 pr-3 py-2 min-h-[40px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={policySource}
              onChange={(e) =>
                setPolicySource(e.target.value as typeof policySource)
              }
              aria-label="Filter by policy source"
              className="px-3 py-2 min-h-[40px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Policy Sources</option>
              <option value="seller_verified">Seller-Verified Only</option>
              <option value="user_estimate">User Estimates Only</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Sort purchases"
              className="px-3 py-2 min-h-[40px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              <option value="date_desc">Sort: Purchase Date (Newest)</option>
              <option value="return_asc">Sort: Return Cutoff (Soonest)</option>
              <option value="warranty_asc">Sort: Warranty End (Soonest)</option>
              <option value="amount_desc">Sort: Amount (High → Low)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0E1626]"
            role="group"
            aria-label="Filter purchases by coverage"
          >
            {(
              [
                ['all', 'All Records'],
                ['open_return', 'Open Returns'],
                ['active_warranty', 'Active Warranties'],
                ['deposits', 'Deposits'],
                ['flagged', 'Missing Info / Overdue'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCoverageFilter(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  coverageFilter === key
                    ? 'bg-white dark:bg-[#1C2A45] text-slate-900 dark:text-slate-50 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono tabular-nums">
              Showing {filteredPurchases.length} of {purchases.length}
            </span>
            {(search || coverageFilter !== 'all' || policySource !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCoverageFilter('all');
                  setPolicySource('all');
                }}
                className="text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredPurchases.length === 0 ? (
        <div className="bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl p-12 text-center space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {purchases.length === 0
              ? 'Your Purchase Vault is empty'
              : 'No purchases match these filters'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {purchases.length === 0
              ? 'Add a product receipt or refundable deposit, or load fictional sample data to explore live countdowns.'
              : 'Try broadening your search query or switching coverage filters.'}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onAddPurchase}
              className="px-4 py-2 min-h-[40px] rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs cursor-pointer"
            >
              + Add Purchase
            </button>
            {purchases.length === 0 && (
              <button
                type="button"
                onClick={onRestoreSamples}
                className="px-4 py-2 min-h-[40px] rounded-lg border border-slate-300 dark:border-[#293B5C] text-xs font-medium cursor-pointer"
              >
                Restore Sample Records
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
        >
          <AnimatePresence mode="popLayout">
            {filteredPurchases.map((p) => {
              const ret = computeReturnDeadline(p);
              const war = computeWarrantyDeadline(p);
              const dep = computeDepositDeadline(p);
              const retState = deadlineMeta[`ret_${p.id}`]?.actionState;
              const warState = deadlineMeta[`war_${p.id}`]?.actionState;
              const depState = deadlineMeta[`dep_${p.id}`]?.actionState;
              const linkedClaims = claims.filter((c) => c.purchaseId === p.id);
              const isHighlighted = highlightedPurchaseId === p.id;
              const recCurrency = p.currency || 'USD';

              return (
                <motion.article
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  key={p.id}
                  className={`bg-white dark:bg-[#121A2D] border rounded-xl p-5 flex flex-col justify-between gap-4 transition-colors ${
                    isHighlighted
                      ? 'border-cyan-500 ring-1 ring-cyan-500/40'
                      : 'border-slate-200 dark:border-[#1F2D47] hover:border-slate-300 dark:hover:border-[#2E4268]'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-base text-slate-900 dark:text-slate-50 leading-snug">
                          {p.productName}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span>{p.seller}</span>
                          <span>·</span>
                          <span>{categoryLabel(p.category)}</span>
                          {p.isSample && (
                            <>
                              <span>·</span>
                              <span className="text-cyan-600 dark:text-cyan-400 font-medium">
                                Sample
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono tabular-nums font-semibold text-base text-slate-900 dark:text-slate-50">
                          {formatDisplayMoney(p.amount, recCurrency, displayCurrency)}
                        </div>
                        {recCurrency !== displayCurrency && (
                          <div className="font-mono tabular-nums text-[11px] text-slate-400">
                            Orig: {formatCurrency(p.amount, recCurrency)}
                          </div>
                        )}
                        <div className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                          {formatHumanDate(p.purchaseDate)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      {p.receiptRef ? (
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          Ref: {p.receiptRef}
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400 font-semibold">
                          ! Missing receipt ref
                        </span>
                      )}

                      {p.proofFile ? (
                        <button
                          type="button"
                          onClick={() => onInspectProof(p)}
                          className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400 hover:underline font-medium cursor-pointer truncate max-w-[180px]"
                        >
                          <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{p.proofFile.fileName}</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">No file linked</span>
                      )}
                    </div>

                    <div className="space-y-2.5 pt-1">
                      {ret.applicable ? (
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-600 dark:text-slate-400">
                              Return ·{' '}
                              {p.returnPolicySource === 'seller_verified' ? (
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  Seller-verified
                                </span>
                              ) : (
                                'Estimate'
                              )}
                            </span>
                            {renderCountdownText(ret.daysRemaining, retState)}
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-[#0B1120] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                retState === 'completed'
                                  ? 'bg-emerald-500'
                                  : ret.daysRemaining !== null &&
                                    ret.daysRemaining < 0
                                  ? 'bg-red-500'
                                  : ret.daysRemaining !== null &&
                                    ret.daysRemaining <= 14
                                  ? 'bg-amber-400'
                                  : 'bg-cyan-500'
                              }`}
                              style={{ width: `${ret.progressPct}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">
                          Return window: Non-returnable / Deposit hold
                        </div>
                      )}

                      {war.applicable && (
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-600 dark:text-slate-400">
                              Warranty ({formatHumanDate(war.dueDate)}) ·{' '}
                              {p.warrantyPolicySource === 'seller_verified' ? (
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  Verified
                                </span>
                              ) : (
                                'Estimate'
                              )}
                            </span>
                            {renderCountdownText(war.daysRemaining, warState)}
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-[#0B1120] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                war.daysRemaining !== null &&
                                war.daysRemaining <= 14
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-500/80'
                              }`}
                              style={{ width: `${war.progressPct}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {dep.applicable && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 dark:text-slate-400">
                            Deposit due {formatHumanDate(dep.dueDate)}
                          </span>
                          {renderCountdownText(dep.daysRemaining, depState)}
                        </div>
                      )}
                    </div>

                    {p.notes && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {p.notes}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onStartClaim(
                            p.id,
                            p.purchaseType === 'deposit' ? 'deposit' : 'return'
                          )
                        }
                        className="px-3 py-1.5 min-h-[34px] rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-[#19253D] dark:hover:bg-[#223252] text-xs font-semibold text-slate-800 dark:text-slate-100 transition-colors cursor-pointer"
                      >
                        Start Claim
                      </button>
                      {linkedClaims.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onViewLinkedClaims(p.id)}
                          className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                        >
                          {linkedClaims.length}{' '}
                          {linkedClaims.length === 1 ? 'claim' : 'claims'}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEditPurchase(p)}
                        aria-label={`Edit ${p.productName}`}
                        className="p-2 min-h-[34px] min-w-[34px] rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#19253D] transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeletePurchase(p)}
                        aria-label={`Delete ${p.productName}`}
                        className="p-2 min-h-[34px] min-w-[34px] rounded-md text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1F2D47] bg-slate-50/80 dark:bg-[#0E1626]/60 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Product &amp; Seller</th>
                  <th className="py-3 px-4">Purchased</th>
                  <th className="py-3 px-4 text-right">
                    Amount ({displayCurrency})
                  </th>
                  <th className="py-3 px-4">Receipt &amp; Proof</th>
                  <th className="py-3 px-4">Return Cutoff</th>
                  <th className="py-3 px-4">Warranty / Deposit</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/80 text-sm">
                {filteredPurchases.map((p) => {
                  const ret = computeReturnDeadline(p);
                  const war = computeWarrantyDeadline(p);
                  const dep = computeDepositDeadline(p);
                  const retState = deadlineMeta[`ret_${p.id}`]?.actionState;
                  const warState = deadlineMeta[`war_${p.id}`]?.actionState;
                  const depState = deadlineMeta[`dep_${p.id}`]?.actionState;
                  const recCurrency = p.currency || 'USD';

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-[#172238]/60 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {p.productName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {p.seller} · {categoryLabel(p.category)}
                          {p.isSample ? ' · Sample' : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-xs whitespace-nowrap">
                        {formatHumanDate(p.purchaseDate)}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums font-semibold text-right whitespace-nowrap">
                        <div>
                          {formatDisplayMoney(
                            p.amount,
                            recCurrency,
                            displayCurrency
                          )}
                        </div>
                        {recCurrency !== displayCurrency && (
                          <div className="text-[11px] font-normal text-slate-400">
                            {formatCurrency(p.amount, recCurrency)}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        {p.receiptRef ? (
                          <div className="font-mono">{p.receiptRef}</div>
                        ) : (
                          <div className="text-red-600 dark:text-red-400 font-semibold">
                            ! Missing ref
                          </div>
                        )}
                        {p.proofFile && (
                          <button
                            type="button"
                            onClick={() => onInspectProof(p)}
                            className="text-cyan-600 dark:text-cyan-400 hover:underline mt-0.5 cursor-pointer"
                          >
                            View proof meta
                          </button>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        {ret.applicable ? (
                          <div>
                            {renderCountdownText(ret.daysRemaining, retState)}
                            <div className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                              {formatHumanDate(ret.dueDate)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">N/A</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        {war.applicable && (
                          <div>
                            {renderCountdownText(war.daysRemaining, warState)}
                            <div className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                              Ends {formatHumanDate(war.dueDate)}
                            </div>
                          </div>
                        )}
                        {dep.applicable && (
                          <div>
                            {renderCountdownText(dep.daysRemaining, depState)}
                            <div className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                              Deposit {formatHumanDate(dep.dueDate)}
                            </div>
                          </div>
                        )}
                        {!war.applicable && !dep.applicable && (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onStartClaim(p.id)}
                            className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-[#293B5C] text-xs font-medium hover:bg-slate-100 dark:hover:bg-[#1E2D4A] cursor-pointer"
                          >
                            Claim
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditPurchase(p)}
                            className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-[#293B5C] text-xs font-medium hover:bg-slate-100 dark:hover:bg-[#1E2D4A] cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeletePurchase(p)}
                            className="px-2.5 py-1.5 rounded-md text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
