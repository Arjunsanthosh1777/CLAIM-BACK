import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  Plus,
  Receipt,
  SlidersHorizontal,
} from 'lucide-react';
import {
  ActiveTab,
  ClaimRecord,
  CurrencyCode,
  DeadlineActionState,
  DerivedDeadline,
  PurchaseRecord,
} from '../types';
import {
  addCalendarDays,
  addCalendarMonths,
  calculateFinancialTotals,
  convertCurrencyAmount,
  diffCalendarDays,
  formatCurrency,
  formatDisplayMoney,
  formatHumanDate,
  getCurrencyConfig,
  ParsedReceiptFields,
  parseReceiptSnippet,
  todayYMD,
} from '../utils/dateAndMoney';

interface OverviewSectionProps {
  purchases: PurchaseRecord[];
  deadlines: DerivedDeadline[];
  claims: ClaimRecord[];
  displayCurrency: CurrencyCode;
  onNavigate: (tab: ActiveTab) => void;
  onOpenNewPurchase: (prefill?: Partial<ParsedReceiptFields>) => void;
  onQuickCreateSimulatedPurchase: (p: {
    productName: string;
    seller: string;
    purchaseDate: string;
    amount: number;
    currency: CurrencyCode;
    returnDays: number;
    warrantyMonths: number;
  }) => void;
  onUpdateDeadlineState: (id: string, state: DeadlineActionState) => void;
  onStartClaimForPurchase: (purchaseId: string, suggestedType?: string) => void;
  onSelectClaimInRecovery: (claimId: string) => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  purchases,
  deadlines,
  claims,
  displayCurrency,
  onNavigate,
  onOpenNewPurchase,
  onQuickCreateSimulatedPurchase,
  onUpdateDeadlineState,
  onStartClaimForPurchase,
  onSelectClaimInRecovery,
}) => {
  const curCfg = getCurrencyConfig(displayCurrency);

  // Interactive Live Deadline Simulator State
  const [simName, setSimName] = useState('Wireless Mechanical Keyboard');
  const [simSeller, setSimSeller] = useState('Keycraft Studio');
  const [simAmount, setSimAmount] = useState(
    displayCurrency === 'INR' ? '12999' : '169.00'
  );
  const [simDate, setSimDate] = useState(todayYMD());
  const [simReturnDays, setSimReturnDays] = useState(30);
  const [simWarrantyMonths, setSimWarrantyMonths] = useState(12);

  useEffect(() => {
    setSimAmount(displayCurrency === 'INR' ? '12999' : '169.00');
  }, [displayCurrency]);

  // Smart Receipt Snippet Parser State
  const [snippetText, setSnippetText] = useState('');
  const parsedSnippet = snippetText.trim()
    ? parseReceiptSnippet(snippetText, displayCurrency)
    : null;

  const sampleSnippet =
    displayCurrency === 'INR'
      ? `Seller: Croma Electronics\nItem: Studio Reference ANC Headphones\nOrder #: CRM-2026-904812\nDate: ${addCalendarDays(
          todayYMD(),
          -9
        )}\nTotal Paid: ₹24,990.00\nPolicy: 14-day return window · 2-year warranty`
      : `Seller: Meridian Audio Lab\nItem: Studio Reference ANC Headphones\nOrder #: MAL-904812\nDate: ${addCalendarDays(
          todayYMD(),
          -9
        )}\nTotal Paid: ${curCfg.symbol}279.00\nPolicy: 30-day return window · 2-year warranty`;

  const simReturnDate =
    simReturnDays > 0 ? addCalendarDays(simDate, simReturnDays) : null;
  const simPrepDate =
    simReturnDate && simReturnDays >= 4
      ? addCalendarDays(simReturnDate, -3)
      : simReturnDate;
  const simWarrantyDate =
    simWarrantyMonths > 0 ? addCalendarMonths(simDate, simWarrantyMonths) : null;
  const simReturnLeft = simReturnDate
    ? diffCalendarDays(todayYMD(), simReturnDate)
    : null;

  // Derived Metrics in active displayCurrency
  const totalProtectedValue = purchases.reduce(
    (acc, p) =>
      acc +
      convertCurrencyAmount(Number(p.amount) || 0, p.currency, displayCurrency),
    0
  );
  const openDeadlines = deadlines.filter(
    (d) => d.actionState === 'needs_action' || d.actionState === 'in_progress'
  );
  const urgentOrOverdue = openDeadlines
    .filter(
      (d) =>
        (d.daysRemaining !== null && d.daysRemaining <= 14) ||
        d.missingReasons.length > 0
    )
    .sort((a, b) => (a.daysRemaining ?? -999) - (b.daysRemaining ?? -999));

  const fin = calculateFinancialTotals(claims, displayCurrency);
  const barTotal = Math.max(
    1,
    fin.confirmedReceived + fin.approvedAwaitingPayout + fin.unapprovedPending
  );
  const pctConfirmed = Math.round((fin.confirmedReceived / barTotal) * 100);
  const pctApproved = Math.round((fin.approvedAwaitingPayout / barTotal) * 100);
  const pctPending = Math.max(0, 100 - pctConfirmed - pctApproved);

  const handleSaveSimulation = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(simAmount);
    if (!simName.trim() || !simSeller.trim() || !Number.isFinite(amt) || amt <= 0) {
      return;
    }
    onQuickCreateSimulatedPurchase({
      productName: simName.trim(),
      seller: simSeller.trim(),
      purchaseDate: simDate,
      amount: amt,
      currency: displayCurrency,
      returnDays: simReturnDays,
      warrantyMonths: simWarrantyMonths,
    });
  };

  return (
    <div className="space-y-8">
      {/* 2-Column Hero Split: Proposition + Live Interactive Coverage Simulator */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl p-7 sm:p-9 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Consumer Protection Command</span>
              <span aria-hidden="true">·</span>
              <span>Active Currency: {curCfg.code} ({curCfg.symbol})</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Today {formatHumanDate(todayYMD())}
              </span>
            </div>

            <h1
              className="font-display font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-[1.12]"
              style={{
                fontSize: 'clamp(2rem, 3.4vw, 3.1rem)',
                textWrap: 'balance',
              }}
            >
              Never lose a refund to a silent deadline or missing receipt.
            </h1>

            <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed max-w-[62ch]">
              Track return cutoffs, manufacturer warranties, and refundable
              deposits in real time across INR (₹), USD, EUR, GBP, and global
              currencies. Build evidence checklists, generate customizable claim
              letters, and separate requested amounts from confirmed payouts.
            </p>
          </div>

          <div className="pt-7 mt-7 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onOpenNewPurchase()}
                className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[42px] rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                Log Purchase Receipt
              </button>
              <button
                type="button"
                onClick={() => onNavigate('deadlines')}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-lg border border-slate-300 dark:border-[#293B5C] hover:border-slate-400 dark:hover:border-slate-500 text-slate-800 dark:text-slate-200 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Open Deadline Radar
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Seller written policies govern actual eligibility.
            </p>
          </div>
        </div>

        {/* Right Column: Live Interactive Deadline & Coverage Simulator */}
        <form
          onSubmit={handleSaveSimulation}
          className="lg:col-span-5 bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl p-6 sm:p-7 flex flex-col justify-between gap-5"
        >
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <h2 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                  Live Coverage Simulator
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {curCfg.code} ({curCfg.symbol})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Seller &amp; Price ({curCfg.symbol})
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={simSeller}
                    onChange={(e) => setSimSeller(e.target.value)}
                    className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
                    required
                  />
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={simAmount}
                    onChange={(e) => setSimAmount(e.target.value)}
                    className="w-28 px-2.5 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] text-sm font-mono tabular-nums text-right text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Purchase Date
                </label>
                <input
                  type="date"
                  value={simDate}
                  onChange={(e) => setSimDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    Return Window
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-cyan-600 dark:text-cyan-400">
                    {simReturnDays === 0 ? 'Final Sale (0d)' : `${simReturnDays} days`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={90}
                  step={1}
                  value={simReturnDays}
                  onChange={(e) => setSimReturnDays(Number(e.target.value))}
                  aria-label="Simulate return window days"
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    Manufacturer Warranty
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-cyan-600 dark:text-cyan-400">
                    {simWarrantyMonths === 0
                      ? 'No Warranty'
                      : `${simWarrantyMonths} mos`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={36}
                  step={3}
                  value={simWarrantyMonths}
                  onChange={(e) => setSimWarrantyMonths(Number(e.target.value))}
                  aria-label="Simulate warranty months"
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-slate-500 dark:text-slate-400">Prep Alert</div>
                <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {simPrepDate ? formatHumanDate(simPrepDate) : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">Return Cutoff</div>
                <div className="font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                  {simReturnDate ? formatHumanDate(simReturnDate) : 'None'}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">Warranty Ends</div>
                <div className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {simWarrantyDate ? formatHumanDate(simWarrantyDate) : 'None'}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 min-h-[40px] rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-[#1C2A45] dark:hover:bg-[#243556] text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              Save Simulated Item to Vault (
              {simReturnLeft !== null
                ? simReturnLeft < 0
                  ? `${Math.abs(simReturnLeft)}d past`
                  : `${simReturnLeft}d return left`
                : 'No return window'}
              )
            </button>
          </div>
        </form>
      </section>

      {/* Full-Width 4-Column Interactive KPI Strip Below Hero Split */}
      <section
        aria-label="Live Workspace Summary"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-[#1F2D47]"
      >
        <button
          type="button"
          onClick={() => onNavigate('vault')}
          className="p-5 text-left hover:bg-slate-50 dark:hover:bg-[#172238] transition-colors cursor-pointer"
        >
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Protected Purchase Value ({displayCurrency})
          </div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-50 mt-1.5">
            {formatCurrency(totalProtectedValue, displayCurrency)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {purchases.length} tracked receipts &amp; deposits →
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('deadlines')}
          className="p-5 text-left hover:bg-slate-50 dark:hover:bg-[#172238] transition-colors cursor-pointer"
        >
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Urgent &amp; Flagged Windows
          </div>
          <div
            className={`font-mono tabular-nums text-2xl font-semibold mt-1.5 ${
              urgentOrOverdue.length > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-900 dark:text-slate-50'
            }`}
          >
            {urgentOrOverdue.length}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Due ≤14d, overdue, or missing proof →
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('recovery')}
          className="p-5 text-left hover:bg-slate-50 dark:hover:bg-[#172238] transition-colors cursor-pointer"
        >
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Approved · Awaiting Payout
          </div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-amber-600 dark:text-amber-400 mt-1.5">
            {formatCurrency(fin.approvedAwaitingPayout, displayCurrency)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Approved by seller, not yet received →
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('recovery')}
          className="p-5 text-left hover:bg-slate-50 dark:hover:bg-[#172238] transition-colors cursor-pointer"
        >
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Confirmed Money Recovered
          </div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5">
            {formatCurrency(fin.confirmedReceived, displayCurrency)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {fin.receivedClaimsCount} verified payouts received →
          </div>
        </button>
      </section>

      {/* Asymmetric Bento Workspace */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          {/* Interactive Financial Recovery Stage Breakdown */}
          <div className="bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                  Live Recovery Accounting Pipeline
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Requested funds are never labeled recovered until payout
                  receipt is confirmed.
                </p>
              </div>
              <span className="font-mono tabular-nums text-xs text-slate-600 dark:text-slate-300">
                Total Requested:{' '}
                {formatCurrency(fin.totalRequested, displayCurrency)}
              </span>
            </div>

            <div className="h-3.5 w-full rounded-full bg-slate-100 dark:bg-[#0B1120] overflow-hidden flex">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pctConfirmed}%` }}
                transition={{ duration: 0.4 }}
                className="bg-emerald-500 h-full"
                title={`Confirmed Received: ${formatCurrency(
                  fin.confirmedReceived,
                  displayCurrency
                )}`}
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pctApproved}%` }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="bg-amber-400 h-full"
                title={`Approved Awaiting Payout: ${formatCurrency(
                  fin.approvedAwaitingPayout,
                  displayCurrency
                )}`}
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pctPending}%` }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="bg-cyan-500/60 h-full"
                title={`Pending Seller Review: ${formatCurrency(
                  fin.unapprovedPending,
                  displayCurrency
                )}`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-200/70 dark:border-slate-800/70 text-xs">
              <div>
                <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Confirmed Received ({pctConfirmed}%)
                </div>
                <div className="font-mono tabular-nums text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {formatCurrency(fin.confirmedReceived, displayCurrency)}
                </div>
              </div>
              <div>
                <div className="text-amber-600 dark:text-amber-400 font-semibold">
                  Approved · Unpaid ({pctApproved}%)
                </div>
                <div className="font-mono tabular-nums text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {formatCurrency(fin.approvedAwaitingPayout, displayCurrency)}
                </div>
              </div>
              <div>
                <div className="text-cyan-600 dark:text-cyan-400 font-semibold">
                  Pending Review ({pctPending}%)
                </div>
                <div className="font-mono tabular-nums text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {formatCurrency(fin.unapprovedPending, displayCurrency)}
                </div>
              </div>
            </div>

            {claims.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-800/70 divide-y divide-slate-200/60 dark:divide-slate-800/60">
                {claims.slice(0, 3).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectClaimInRecovery(c.id)}
                    className="w-full py-2.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-[#172238] px-2 -mx-2 rounded-md transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {c.itemSummary}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {c.seller} · {c.referenceNumber || 'Draft claim'}
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono tabular-nums text-xs">
                      {c.paymentReceived ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          ✓{' '}
                          {formatDisplayMoney(
                            c.amountReceived,
                            c.currency,
                            displayCurrency
                          )}{' '}
                          received
                        </span>
                      ) : c.amountApproved > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          ▲{' '}
                          {formatDisplayMoney(
                            c.amountApproved,
                            c.currency,
                            displayCurrency
                          )}{' '}
                          approved (unpaid)
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">
                          {formatDisplayMoney(
                            c.amountRequested,
                            c.currency,
                            displayCurrency
                          )}{' '}
                          requested
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Priority Action Feed */}
          <div className="bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1F2D47] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-amber-500" />
                <h2 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                  Immediate Action Queue
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('deadlines')}
                className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
              >
                View all {deadlines.length} deadlines →
              </button>
            </div>

            {urgentOrOverdue.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  All imminent deadlines are clear
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  No overdue cutoffs or missing receipt references right now.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200/70 dark:divide-slate-800/80">
                {urgentOrOverdue.slice(0, 4).map((item) => {
                  const isOverdue =
                    item.daysRemaining !== null && item.daysRemaining < 0;
                  return (
                    <div
                      key={item.id}
                      className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-[#172238]/60 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {item.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <span>{item.typeLabel}</span>
                          <span>·</span>
                          <span>{item.seller}</span>
                          <span>·</span>
                          <span className="font-mono tabular-nums">
                            {formatDisplayMoney(
                              item.amount,
                              item.currency,
                              displayCurrency
                            )}
                          </span>
                          {item.isSample && (
                            <>
                              <span>·</span>
                              <span className="text-cyan-600 dark:text-cyan-400">
                                Sample
                              </span>
                            </>
                          )}
                        </div>
                        {item.missingReasons.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{item.missingReasons.join(' · ')}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
                        <span
                          className={`font-mono tabular-nums text-xs font-semibold ${
                            isOverdue
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {item.daysRemaining === null
                            ? '! Date missing'
                            : isOverdue
                            ? `! ${Math.abs(item.daysRemaining)}d overdue`
                            : item.daysRemaining === 0
                            ? '! Due today'
                            : `▲ ${item.daysRemaining}d left`}
                        </span>

                        {item.purchaseId && (
                          <button
                            type="button"
                            onClick={() =>
                              onStartClaimForPurchase(
                                item.purchaseId,
                                item.type === 'warranty'
                                  ? 'repair'
                                  : item.type === 'deposit'
                                  ? 'deposit'
                                  : 'return'
                              )
                            }
                            className="px-3 py-1.5 min-h-[34px] rounded-md border border-slate-200 dark:border-[#293B5C] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E2D4A] transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Start Claim
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            onUpdateDeadlineState(item.id, 'completed')
                          }
                          className="px-3 py-1.5 min-h-[34px] rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (col-span-4): Live Receipt Text Quick-Parser */}
        <div className="lg:col-span-4 bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <h2 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                Smart Receipt Quick-Parser
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSnippetText(sampleSnippet)}
              className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer whitespace-nowrap"
            >
              Try Sample ({curCfg.code})
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Paste an order confirmation email or GST/retail invoice snippet (supports ₹, Rs., INR, $, €, £). Parsed locally in your browser.
          </p>

          <textarea
            rows={6}
            value={snippetText}
            onChange={(e) => setSnippetText(e.target.value)}
            placeholder={`Seller: Croma Electronics\nItem: USB-C Hub\nOrder #: INV-40219\nDate: ${todayYMD()}\nTotal Paid: ₹4,999.00\n14-day return · 1-year warranty`}
            className="w-full p-3 rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          />

          {parsedSnippet ? (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-cyan-500" />
                Live Extracted Fields
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-slate-400 block">Item:</span>
                  <span className="font-medium">
                    {parsedSnippet.productName || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Seller:</span>
                  <span className="font-medium">
                    {parsedSnippet.seller || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Amount:</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {parsedSnippet.amount
                      ? formatCurrency(
                          Number(parsedSnippet.amount),
                          parsedSnippet.currency || displayCurrency
                        )
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Order Ref:</span>
                  <span className="font-mono">
                    {parsedSnippet.receiptRef || '—'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onOpenNewPurchase(parsedSnippet);
                  setSnippetText('');
                }}
                className="w-full mt-2 py-2.5 min-h-[40px] rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
              >
                Open Pre-Filled Purchase Form →
              </button>
            </div>
          ) : (
            <div className="text-xs text-slate-400 dark:text-slate-500 pt-1">
              Click &ldquo;Try Sample ({curCfg.code})&rdquo; above to test instant extraction.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
