import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  ClipboardCopy,
  Columns3,
  Download,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  History,
  Mail,
  Plus,
  Printer,
  RefreshCw,
  Search,
  SplitSquareVertical,
  Trash2,
} from 'lucide-react';
import {
  ClaimRecord,
  ClaimStatus,
  ClaimType,
  CurrencyCode,
  LetterTone,
  PurchaseRecord,
} from '../types';
import {
  buildDefaultEvidenceChecklist,
  calculateFinancialTotals,
  claimStatusLabel,
  claimTypeLabel,
  convertCurrencyAmount,
  downloadTextFile,
  formatCurrency,
  formatDisplayMoney,
  formatHumanDate,
  generateClaimDossierHtml,
  generateClaimLetter,
  parseYMD,
  todayYMD,
} from '../utils/dateAndMoney';

interface RecoverySectionProps {
  claims: ClaimRecord[];
  purchases: PurchaseRecord[];
  displayCurrency: CurrencyCode;
  selectedClaimId: string;
  filterPurchaseId: string;
  onSelectClaim: (id: string) => void;
  onClearPurchaseFilter: () => void;
  onOpenNewClaim: () => void;
  onEditClaim: (claim: ClaimRecord) => void;
  onDeleteClaim: (claim: ClaimRecord) => void;
  onUpdateClaim: (updated: ClaimRecord) => void;
  onJumpToPurchase: (purchaseId: string) => void;
  onRestoreSamples: () => void;
  onNotify: (msg: string) => void;
}

export const RecoverySection: React.FC<RecoverySectionProps> = ({
  claims,
  purchases,
  displayCurrency,
  selectedClaimId,
  filterPurchaseId,
  onSelectClaim,
  onClearPurchaseFilter,
  onOpenNewClaim,
  onEditClaim,
  onDeleteClaim,
  onUpdateClaim,
  onJumpToPurchase,
  onRestoreSamples,
  onNotify,
}) => {
  const [viewMode, setViewMode] = useState<'studio' | 'kanban'>('studio');
  const [studioTab, setStudioTab] = useState<'letter' | 'evidence' | 'history'>('letter');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ClaimStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ClaimType>('all');

  // Evidence & History inline inputs
  const [newEvidenceLabel, setNewEvidenceLabel] = useState('');
  const [newHistoryDate, setNewHistoryDate] = useState(todayYMD());
  const [newHistoryNote, setNewHistoryNote] = useState('');
  const [historyError, setHistoryError] = useState('');

  const fin = useMemo(
    () => calculateFinancialTotals(claims, displayCurrency),
    [claims, displayCurrency]
  );

  const filteredClaims = useMemo(() => {
    const q = search.trim().toLowerCase();
    return claims.filter((c) => {
      if (filterPurchaseId && c.purchaseId !== filterPurchaseId) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (typeFilter !== 'all' && c.claimType !== typeFilter) return false;
      if (q) {
        const hay = [
          c.itemSummary,
          c.seller,
          c.referenceNumber,
          c.receiptRef,
          c.issueDescription,
          claimTypeLabel(c.claimType),
          claimStatusLabel(c.status),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [claims, filterPurchaseId, statusFilter, typeFilter, search]);

  const activeClaim: ClaimRecord | null = useMemo(() => {
    if (filteredClaims.length === 0) return null;
    return (
      filteredClaims.find((c) => c.id === selectedClaimId) || filteredClaims[0]
    );
  }, [filteredClaims, selectedClaimId]);

  useEffect(() => {
    if (activeClaim && activeClaim.id !== selectedClaimId) {
      onSelectClaim(activeClaim.id);
    }
  }, [activeClaim, selectedClaimId, onSelectClaim]);

  const effectiveLetterText = useMemo(() => {
    if (!activeClaim) return '';
    if (activeClaim.letterDraft && activeClaim.letterDraft.trim()) {
      return activeClaim.letterDraft;
    }
    return generateClaimLetter(activeClaim, displayCurrency);
  }, [activeClaim, displayCurrency]);

  const linkedPurchase = useMemo(() => {
    if (!activeClaim || !activeClaim.purchaseId) return null;
    return purchases.find((p) => p.id === activeClaim.purchaseId) || null;
  }, [activeClaim, purchases]);

  const filterPurchaseObj = useMemo(() => {
    if (!filterPurchaseId) return null;
    return purchases.find((p) => p.id === filterPurchaseId) || null;
  }, [filterPurchaseId, purchases]);

  const handleQuickStatusChange = (claim: ClaimRecord, nextStatus: ClaimStatus) => {
    if (claim.status === nextStatus) return;
    const nowIso = new Date().toISOString();
    const entry = {
      id: `his_${Date.now()}`,
      date: todayYMD(),
      note: `Status updated from ${claimStatusLabel(claim.status)} to ${claimStatusLabel(
        nextStatus
      )}.`,
    };
    onUpdateClaim({
      ...claim,
      status: nextStatus,
      dateSubmitted:
        nextStatus !== 'draft' && !claim.dateSubmitted
          ? todayYMD()
          : claim.dateSubmitted,
      history: [...(claim.history || []), entry],
      updatedAt: nowIso,
    });
    onNotify(`Updated claim status to ${claimStatusLabel(nextStatus)}.`);
  };

  const handleLetterToneOrSenderChange = (
    nextTone: LetterTone,
    nextSender: string
  ) => {
    if (!activeClaim) return;
    const nextClaim: ClaimRecord = {
      ...activeClaim,
      letterTone: nextTone,
      senderName: nextSender,
      updatedAt: new Date().toISOString(),
    };
    nextClaim.letterDraft = generateClaimLetter(nextClaim, displayCurrency);
    onUpdateClaim(nextClaim);
  };

  const handleRefreshLetter = () => {
    if (!activeClaim) return;
    const regenerated = generateClaimLetter(activeClaim, displayCurrency);
    onUpdateClaim({
      ...activeClaim,
      letterDraft: regenerated,
      updatedAt: new Date().toISOString(),
    });
    onNotify('Regenerated correspondence draft from latest claim fields.');
  };

  const handleCopyLetter = async () => {
    if (!effectiveLetterText) return;
    try {
      await navigator.clipboard.writeText(effectiveLetterText);
      onNotify('Copied claim letter to clipboard.');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = effectiveLetterText;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      onNotify('Copied claim letter to clipboard.');
    }
  };

  const handleDownloadLetter = () => {
    if (!activeClaim || !effectiveLetterText) return;
    const safeSlug = activeClaim.itemSummary
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 36);
    downloadTextFile(
      `claim-letter-${safeSlug || 'draft'}-${todayYMD()}.txt`,
      effectiveLetterText
    );
    onNotify('Downloaded letter draft (.txt).');
  };

  const handleDownloadDossier = () => {
    if (!activeClaim) return;
    const safeSlug = activeClaim.itemSummary
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 36);
    const html = generateClaimDossierHtml(
      activeClaim,
      linkedPurchase,
      displayCurrency
    );
    downloadTextFile(
      `claimback-dossier-${safeSlug || 'claim'}-${todayYMD()}.html`,
      html,
      'text/html;charset=utf-8;'
    );
    onNotify('Downloaded printable Claim Evidence Dossier (.html).');
  };

  const handleToggleChecklistItem = (itemId: string) => {
    if (!activeClaim) return;
    const nextList = (activeClaim.evidenceChecklist || []).map((it) =>
      it.id === itemId ? { ...it, checked: !it.checked } : it
    );
    onUpdateClaim({
      ...activeClaim,
      evidenceChecklist: nextList,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClaim || !newEvidenceLabel.trim()) return;
    const nextList = [
      ...(activeClaim.evidenceChecklist || []),
      {
        id: `ev_${Date.now()}`,
        label: newEvidenceLabel.trim(),
        checked: false,
      },
    ];
    onUpdateClaim({
      ...activeClaim,
      evidenceChecklist: nextList,
      updatedAt: new Date().toISOString(),
    });
    setNewEvidenceLabel('');
    onNotify('Added supporting evidence checklist item.');
  };

  const handleDeleteChecklistItem = (itemId: string) => {
    if (!activeClaim) return;
    const nextList = (activeClaim.evidenceChecklist || []).filter(
      (it) => it.id !== itemId
    );
    onUpdateClaim({
      ...activeClaim,
      evidenceChecklist: nextList,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleResetDefaultChecklist = () => {
    if (!activeClaim) return;
    const defaults = buildDefaultEvidenceChecklist(
      activeClaim.claimType,
      activeClaim.receiptRef,
      Boolean(linkedPurchase?.proofFile)
    );
    onUpdateClaim({
      ...activeClaim,
      evidenceChecklist: defaults,
      updatedAt: new Date().toISOString(),
    });
    onNotify('Reset checklist to recommended items for this claim type.');
  };

  const handleAddHistoryEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClaim) return;
    if (!parseYMD(newHistoryDate)) {
      setHistoryError('Enter a valid calendar date (YYYY-MM-DD).');
      return;
    }
    if (!newHistoryNote.trim()) {
      setHistoryError('Enter an activity note describing what happened.');
      return;
    }
    setHistoryError('');
    const nextHistory = [
      ...(activeClaim.history || []),
      {
        id: `his_${Date.now()}`,
        date: newHistoryDate,
        note: newHistoryNote.trim(),
      },
    ].sort((a, b) => a.date.localeCompare(b.date));

    onUpdateClaim({
      ...activeClaim,
      history: nextHistory,
      updatedAt: new Date().toISOString(),
    });
    setNewHistoryNote('');
    onNotify('Recorded dated activity log entry.');
  };

  const handleDeleteHistoryEntry = (entryId: string) => {
    if (!activeClaim) return;
    onUpdateClaim({
      ...activeClaim,
      history: (activeClaim.history || []).filter((h) => h.id !== entryId),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleExportClaimsCsv = () => {
    if (claims.length === 0) {
      onNotify('No claim records to export.');
      return;
    }
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = [
      'Item Summary',
      'Seller',
      'Claim Type',
      'Status',
      'Reference / RMA #',
      'Receipt Ref',
      'Date Submitted',
      'Original Currency',
      'Requested (Orig)',
      'Seller Approved (Orig)',
      'Confirmed Received (Orig)',
      `Requested (${displayCurrency})`,
      `Seller Approved (${displayCurrency})`,
      `Confirmed Received (${displayCurrency})`,
      'Payout Confirmed',
      'Date Received',
    ];
    const rows = [headers.map(cell).join(',')];

    for (const c of claims) {
      const cur = c.currency || 'USD';
      const reqConv = convertCurrencyAmount(c.amountRequested, cur, displayCurrency);
      const appConv = convertCurrencyAmount(c.amountApproved, cur, displayCurrency);
      const recConv = c.paymentReceived
        ? convertCurrencyAmount(c.amountReceived, cur, displayCurrency)
        : 0;

      rows.push(
        [
          c.itemSummary,
          c.seller,
          claimTypeLabel(c.claimType),
          claimStatusLabel(c.status),
          c.referenceNumber || '',
          c.receiptRef || '',
          c.dateSubmitted || '',
          cur,
          c.amountRequested.toFixed(2),
          c.amountApproved.toFixed(2),
          (c.paymentReceived ? c.amountReceived : 0).toFixed(2),
          reqConv.toFixed(2),
          appConv.toFixed(2),
          recConv.toFixed(2),
          c.paymentReceived ? 'Yes' : 'No',
          c.paymentReceived ? c.dateReceived || '' : '',
        ]
          .map(cell)
          .join(',')
      );
    }

    downloadTextFile(
      `claimback-claims-${displayCurrency.toLowerCase()}-${todayYMD()}.csv`,
      rows.join('\r\n'),
      'text/csv;charset=utf-8;'
    );
    onNotify(`Exported ${claims.length} claims in ${displayCurrency} to CSV.`);
  };

  const handleExportSummaryReport = () => {
    const lines = [
      'CLAIMBACK — CONSUMER RECOVERY SUMMARY REPORT',
      `Generated: ${formatHumanDate(todayYMD())}`,
      `Reporting Currency: ${displayCurrency}`,
      '============================================================',
      `Total Requested:                 ${formatCurrency(fin.totalRequested, displayCurrency)}`,
      `Pending Seller Review (Unpaid):  ${formatCurrency(fin.unapprovedPending, displayCurrency)}`,
      `Seller Approved · Awaiting Pay:  ${formatCurrency(fin.approvedAwaitingPayout, displayCurrency)}`,
      `Confirmed Money Recovered:       ${formatCurrency(fin.confirmedReceived, displayCurrency)}`,
      '',
      'Accounting Rule: Requested and approved amounts are tracked separately',
      'and are never counted as money recovered until payout receipt is confirmed.',
      '============================================================',
      '',
    ];

    claims.forEach((c, idx) => {
      const cur = c.currency || 'USD';
      lines.push(
        `${idx + 1}. ${c.itemSummary} — ${c.seller}`,
        `   Type: ${claimTypeLabel(c.claimType)} | Status: ${claimStatusLabel(c.status)}`,
        `   Reference #: ${c.referenceNumber || 'Pending'} | Receipt: ${c.receiptRef || '—'}`,
        `   Submitted: ${formatHumanDate(c.dateSubmitted)}`,
        `   Requested: ${formatDisplayMoney(c.amountRequested, cur, displayCurrency)} | Approved: ${formatDisplayMoney(
          c.amountApproved,
          cur,
          displayCurrency
        )} | Confirmed Received: ${
          c.paymentReceived
            ? `${formatDisplayMoney(c.amountReceived, cur, displayCurrency)} on ${formatHumanDate(
                c.dateReceived
              )}`
            : formatCurrency(0, displayCurrency)
        }`,
        ''
      );
    });

    downloadTextFile(
      `claimback-recovery-summary-${displayCurrency.toLowerCase()}-${todayYMD()}.txt`,
      lines.join('\n')
    );
    onNotify(`Downloaded Recovery Summary Report (${displayCurrency}).`);
  };

  const kanbanColumns: Array<{
    key: string;
    title: string;
    statuses: ClaimStatus[];
    nextStatus?: ClaimStatus;
    nextLabel?: string;
  }> = [
    {
      key: 'draft',
      title: 'Draft',
      statuses: ['draft'],
      nextStatus: 'submitted',
      nextLabel: 'Mark Submitted →',
    },
    {
      key: 'submitted',
      title: 'Submitted',
      statuses: ['submitted'],
      nextStatus: 'awaiting_response',
      nextLabel: 'Awaiting Reply →',
    },
    {
      key: 'awaiting_response',
      title: 'Awaiting Response',
      statuses: ['awaiting_response'],
      nextStatus: 'resolved',
      nextLabel: 'Mark Resolved →',
    },
    {
      key: 'resolved',
      title: 'Resolved',
      statuses: ['resolved'],
    },
    {
      key: 'closed_rejected',
      title: 'Rejected / Closed',
      statuses: ['rejected', 'closed'],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & View Mode Toggle */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
            Recovery Center
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-[70ch]">
            Manage refund, return, repair, replacement, and deposit claims.
            Prepare evidence checklists, customize correspondence letters, and
            separate requested amounts from confirmed payouts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className="inline-flex p-1 rounded-lg bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47]"
            role="group"
            aria-label="Switch recovery layout"
          >
            <button
              type="button"
              onClick={() => setViewMode('studio')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'studio'
                  ? 'bg-slate-900 text-white dark:bg-[#1E2D4A] dark:text-slate-50'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              Claim Studio
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-slate-900 text-white dark:bg-[#1E2D4A] dark:text-slate-50'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              Pipeline Board
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportClaimsCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] hover:border-slate-400 dark:hover:border-slate-500 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={handleExportSummaryReport}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] hover:border-slate-400 dark:hover:border-slate-500 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Summary (.txt)
          </button>

          <button
            type="button"
            onClick={onOpenNewClaim}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Claim
          </button>
        </div>
      </div>

      {/* 4-Column Financial Separation Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-[#1F2D47]">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Requested ({displayCurrency})
          </div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-50 mt-1.5">
            {formatCurrency(fin.totalRequested, displayCurrency)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Across {claims.length} total claims
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Pending Seller Review
          </div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-cyan-600 dark:text-cyan-400 mt-1.5">
            {formatCurrency(fin.unapprovedPending, displayCurrency)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Unapproved balance in {fin.openClaimsCount} open claims
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Seller Approved · Awaiting Payout
          </div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-amber-600 dark:text-amber-400 mt-1.5">
            {formatCurrency(fin.approvedAwaitingPayout, displayCurrency)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Not counted as recovered until received
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Confirmed Money Recovered
          </div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5">
            {formatCurrency(fin.confirmedReceived, displayCurrency)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {fin.receivedClaimsCount} confirmed payouts received
          </div>
        </div>
      </div>

      {/* Purchase Filter Banner if navigated from Vault */}
      {filterPurchaseId && (
        <div className="bg-white dark:bg-[#121A2D] border border-cyan-500/40 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-700 dark:text-slate-200">
            Showing claims linked to:{' '}
            <strong className="font-semibold">
              {filterPurchaseObj?.productName || filterPurchaseId}
            </strong>
          </span>
          <button
            type="button"
            onClick={onClearPurchaseFilter}
            className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline cursor-pointer"
          >
            Show all claims
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search claim item, seller, RMA / reference #, or description..."
            className="w-full pl-9 pr-3 py-2 min-h-[40px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            aria-label="Filter claims by status"
            className="px-3 py-2 min-h-[40px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] text-xs font-medium text-slate-800 dark:text-slate-200"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="awaiting_response">Awaiting Response</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            aria-label="Filter claims by type"
            className="px-3 py-2 min-h-[40px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] text-xs font-medium text-slate-800 dark:text-slate-200"
          >
            <option value="all">All Claim Types</option>
            <option value="refund">Refund Request</option>
            <option value="return">Product Return</option>
            <option value="repair">Warranty Repair</option>
            <option value="replacement">Replacement</option>
            <option value="deposit">Deposit Release</option>
          </select>
        </div>
      </div>

      {filteredClaims.length === 0 ? (
        <div className="bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl p-12 text-center space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {claims.length === 0
              ? 'No recovery claims created yet'
              : 'No claims match current filters'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {claims.length === 0
              ? 'Open a refund, return, warranty repair, replacement, or deposit release claim to prepare correspondence and evidence.'
              : 'Clear your filters to inspect all claims in your workspace.'}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onOpenNewClaim}
              className="px-4 py-2 min-h-[40px] rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs cursor-pointer"
            >
              + New Claim
            </button>
            {claims.length === 0 && (
              <button
                type="button"
                onClick={onRestoreSamples}
                className="px-4 py-2 min-h-[40px] rounded-lg border border-slate-300 dark:border-[#293B5C] text-xs font-medium cursor-pointer"
              >
                Restore Sample Claims
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'kanban' ? (
        /* Interactive Kanban Pipeline Board */
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
          {kanbanColumns.map((col) => {
            const colClaims = filteredClaims.filter((c) =>
              col.statuses.includes(c.status)
            );
            return (
              <div
                key={col.key}
                className="bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-800">
                  <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {col.title}
                  </h3>
                  <span className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                    {colClaims.length}
                  </span>
                </div>

                {colClaims.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    No claims in stage
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {colClaims.map((c) => {
                      const cur = c.currency || 'USD';
                      return (
                        <div
                          key={c.id}
                          className="p-3 rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200/80 dark:border-[#1F2D47] space-y-2"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onSelectClaim(c.id);
                              setViewMode('studio');
                            }}
                            className="text-left w-full cursor-pointer group"
                          >
                            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                              {c.itemSummary}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {c.seller} · {claimTypeLabel(c.claimType)}
                            </div>
                          </button>

                          <div className="text-xs font-mono tabular-nums">
                            {c.paymentReceived ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                ✓{' '}
                                {formatDisplayMoney(
                                  c.amountReceived,
                                  cur,
                                  displayCurrency
                                )}{' '}
                                received
                              </span>
                            ) : c.amountApproved > 0 ? (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                ▲{' '}
                                {formatDisplayMoney(
                                  c.amountApproved,
                                  cur,
                                  displayCurrency
                                )}{' '}
                                approved
                              </span>
                            ) : c.amountRequested > 0 ? (
                              <span className="text-slate-600 dark:text-slate-300">
                                {formatDisplayMoney(
                                  c.amountRequested,
                                  cur,
                                  displayCurrency
                                )}{' '}
                                req
                              </span>
                            ) : (
                              <span className="text-slate-400">
                                Repair / Replacement
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/70">
                            <button
                              type="button"
                              onClick={() => onEditClaim(c)}
                              className="text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                            >
                              Edit
                            </button>
                            {col.nextStatus && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleQuickStatusChange(c, col.nextStatus!)
                                }
                                className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                              >
                                {col.nextLabel}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Split Claim Studio View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Claims List */}
          <div className="lg:col-span-5 space-y-3">
            {filteredClaims.map((c) => {
              const isSelected = activeClaim?.id === c.id;
              const cur = c.currency || 'USD';
              const checkedCount = (c.evidenceChecklist || []).filter(
                (i) => i.checked
              ).length;
              const totalEv = (c.evidenceChecklist || []).length;

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectClaim(c.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer block ${
                    isSelected
                      ? 'bg-white dark:bg-[#16223A] border-cyan-500 ring-1 ring-cyan-500/35'
                      : 'bg-white dark:bg-[#121A2D] border-slate-200 dark:border-[#1F2D47] hover:border-slate-300 dark:hover:border-[#2E4268]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-900 dark:text-slate-50 truncate">
                        {c.itemSummary}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {c.seller} · {claimTypeLabel(c.claimType)}
                        {c.isSample ? ' · Sample' : ''}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold shrink-0 ${
                        c.paymentReceived
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : c.status === 'rejected'
                          ? 'text-red-600 dark:text-red-400'
                          : c.status === 'awaiting_response' ||
                            c.status === 'submitted'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {claimStatusLabel(c.status)}
                    </span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      {c.referenceNumber
                        ? `Ref: ${c.referenceNumber}`
                        : 'No RMA ref yet'}{' '}
                      · Evidence {checkedCount}/{totalEv}
                    </span>

                    <span className="font-mono tabular-nums font-semibold">
                      {c.paymentReceived ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          ✓{' '}
                          {formatDisplayMoney(
                            c.amountReceived,
                            cur,
                            displayCurrency
                          )}{' '}
                          received
                        </span>
                      ) : c.amountApproved > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400">
                          ▲{' '}
                          {formatDisplayMoney(
                            c.amountApproved,
                            cur,
                            displayCurrency
                          )}{' '}
                          approved
                        </span>
                      ) : c.amountRequested > 0 ? (
                        <span className="text-slate-700 dark:text-slate-200">
                          {formatDisplayMoney(
                            c.amountRequested,
                            cur,
                            displayCurrency
                          )}{' '}
                          req
                        </span>
                      ) : (
                        <span className="text-slate-400">Warranty service</span>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Active Claim Studio */}
          {activeClaim && (
            <div className="lg:col-span-7 bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl overflow-hidden">
              {/* Studio Header */}
              <div className="p-6 border-b border-slate-200 dark:border-[#1F2D47] space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {claimTypeLabel(activeClaim.claimType)} · {activeClaim.seller}
                      {activeClaim.referenceNumber
                        ? ` · Ref ${activeClaim.referenceNumber}`
                        : ''}
                    </div>
                    <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                      {activeClaim.itemSummary}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={activeClaim.status}
                      onChange={(e) =>
                        handleQuickStatusChange(
                          activeClaim,
                          e.target.value as ClaimStatus
                        )
                      }
                      aria-label="Update claim status"
                      className="px-3 py-1.5 min-h-[36px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#293B5C] text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                    >
                      <option value="draft">Status: Draft</option>
                      <option value="submitted">Status: Submitted</option>
                      <option value="awaiting_response">
                        Status: Awaiting Response
                      </option>
                      <option value="resolved">Status: Resolved</option>
                      <option value="rejected">Status: Rejected</option>
                      <option value="closed">Status: Closed</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => onEditClaim(activeClaim)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg border border-slate-200 dark:border-[#293B5C] hover:bg-slate-100 dark:hover:bg-[#1E2D4A] text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit / Payout
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteClaim(activeClaim)}
                      aria-label="Delete claim"
                      className="p-2 min-h-[36px] min-w-[36px] rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Claim Money Breakdown Row */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">
                      Requested
                    </div>
                    <div className="font-mono tabular-nums font-semibold text-sm text-slate-900 dark:text-slate-100 mt-0.5">
                      {formatDisplayMoney(
                        activeClaim.amountRequested,
                        activeClaim.currency,
                        displayCurrency
                      )}
                    </div>
                    {activeClaim.currency &&
                      activeClaim.currency !== displayCurrency && (
                        <div className="font-mono tabular-nums text-[11px] text-slate-400">
                          Orig:{' '}
                          {formatCurrency(
                            activeClaim.amountRequested,
                            activeClaim.currency
                          )}
                        </div>
                      )}
                  </div>

                  <div>
                    <div className="text-slate-500 dark:text-slate-400">
                      Seller Approved
                    </div>
                    <div className="font-mono tabular-nums font-semibold text-sm text-amber-600 dark:text-amber-400 mt-0.5">
                      {formatDisplayMoney(
                        activeClaim.amountApproved,
                        activeClaim.currency,
                        displayCurrency
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500 dark:text-slate-400">
                      Confirmed Received
                    </div>
                    <div className="font-mono tabular-nums font-semibold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {activeClaim.paymentReceived
                        ? formatDisplayMoney(
                            activeClaim.amountReceived,
                            activeClaim.currency,
                            displayCurrency
                          )
                        : formatCurrency(0, displayCurrency)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {activeClaim.paymentReceived
                        ? `Received ${formatHumanDate(activeClaim.dateReceived)}`
                        : 'Not yet received'}
                    </div>
                  </div>
                </div>

                {linkedPurchase && (
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">
                      Linked Purchase:{' '}
                      <strong className="font-medium text-slate-800 dark:text-slate-200">
                        {linkedPurchase.productName}
                      </strong>{' '}
                      ({linkedPurchase.receiptRef || 'No receipt ref'})
                    </span>
                    <button
                      type="button"
                      onClick={() => onJumpToPurchase(linkedPurchase.id)}
                      className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-medium hover:underline cursor-pointer"
                    >
                      Inspect in Vault
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Studio Sub-Navigation */}
                <div
                  className="inline-flex p-1 rounded-lg bg-slate-100 dark:bg-[#0E1626]"
                  role="tablist"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={studioTab === 'letter'}
                    onClick={() => setStudioTab('letter')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      studioTab === 'letter'
                        ? 'bg-white dark:bg-[#1C2A45] text-slate-900 dark:text-slate-50 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Request Letter
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={studioTab === 'evidence'}
                    onClick={() => setStudioTab('evidence')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      studioTab === 'evidence'
                        ? 'bg-white dark:bg-[#1C2A45] text-slate-900 dark:text-slate-50 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    Evidence Checklist (
                    {(activeClaim.evidenceChecklist || []).filter((e) => e.checked)
                      .length}
                    /{(activeClaim.evidenceChecklist || []).length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={studioTab === 'history'}
                    onClick={() => setStudioTab('history')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      studioTab === 'history'
                        ? 'bg-white dark:bg-[#1C2A45] text-slate-900 dark:text-slate-50 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    Activity Log ({(activeClaim.history || []).length})
                  </button>
                </div>
              </div>

              {/* Studio Body */}
              <div className="p-6">
                {studioTab === 'letter' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Correspondence Tone
                        </label>
                        <select
                          value={activeClaim.letterTone}
                          onChange={(e) =>
                            handleLetterToneOrSenderChange(
                              e.target.value as LetterTone,
                              activeClaim.senderName || ''
                            )
                          }
                          className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] text-xs font-medium text-slate-800 dark:text-slate-100"
                        >
                          <option value="polite_standard">
                            Polite Standard Request
                          </option>
                          <option value="firm_followup">
                            Firm Follow-Up (5-Business-Day Update)
                          </option>
                          <option value="clarification_request">
                            Policy &amp; Deduction Clarification Request
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Sender Sign-Off Name
                        </label>
                        <input
                          type="text"
                          value={activeClaim.senderName || ''}
                          onChange={(e) =>
                            handleLetterToneOrSenderChange(
                              activeClaim.letterTone,
                              e.target.value
                            )
                          }
                          placeholder="Your full name"
                          className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <textarea
                      rows={13}
                      value={effectiveLetterText}
                      onChange={(e) =>
                        onUpdateClaim({
                          ...activeClaim,
                          letterDraft: e.target.value,
                          updatedAt: new Date().toISOString(),
                        })
                      }
                      aria-label="Editable claim request letter"
                      className="w-full p-4 rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] text-xs font-mono leading-relaxed text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyLetter}
                          className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          <ClipboardCopy className="w-3.5 h-3.5" />
                          Copy to Clipboard
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadLetter}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-lg border border-slate-200 dark:border-[#293B5C] hover:bg-slate-100 dark:hover:bg-[#1E2D4A] text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Download .txt
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadDossier}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-lg border border-slate-200 dark:border-[#293B5C] hover:bg-slate-100 dark:hover:bg-[#1E2D4A] text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                          Claim Dossier (.html)
                        </button>
                        <button
                          type="button"
                          onClick={handleRefreshLetter}
                          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Reset Template
                        </button>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Editable correspondence draft — not legal advice; seller
                        terms govern approval.
                      </p>
                    </div>
                  </div>
                )}

                {studioTab === 'evidence' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Checked items are automatically listed in your generated
                        request letter when refreshed.
                      </p>
                      <button
                        type="button"
                        onClick={handleResetDefaultChecklist}
                        className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                      >
                        Reset Recommended Items
                      </button>
                    </div>

                    <div className="divide-y divide-slate-200/70 dark:divide-slate-800/80 border border-slate-200 dark:border-[#1F2D47] rounded-lg">
                      {(activeClaim.evidenceChecklist || []).map((item) => (
                        <div
                          key={item.id}
                          className="px-3.5 py-2.5 flex items-center justify-between gap-3"
                        >
                          <label className="flex items-center gap-2.5 text-xs text-slate-800 dark:text-slate-200 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={() => handleToggleChecklistItem(item.id)}
                              className="rounded accent-cyan-500 w-4 h-4 cursor-pointer"
                            />
                            <span
                              className={
                                item.checked
                                  ? 'line-through text-slate-400 dark:text-slate-500'
                                  : ''
                              }
                            >
                              {item.label}
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleDeleteChecklistItem(item.id)}
                            aria-label={`Remove ${item.label}`}
                            className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleAddChecklistItem} className="flex gap-2">
                      <input
                        type="text"
                        value={newEvidenceLabel}
                        onChange={(e) => setNewEvidenceLabel(e.target.value)}
                        placeholder="Add custom supporting evidence (e.g., Unboxing photo, technician report)..."
                        className="flex-1 px-3 py-2 min-h-[38px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 min-h-[38px] rounded-lg bg-slate-900 dark:bg-[#1E2D4A] text-white text-xs font-semibold cursor-pointer"
                      >
                        Add Item
                      </button>
                    </form>
                  </div>
                )}

                {studioTab === 'history' && (
                  <div className="space-y-4">
                    <form
                      onSubmit={handleAddHistoryEntry}
                      className="space-y-2.5 bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] rounded-lg p-3.5"
                    >
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Record Dated Activity Note
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="date"
                          value={newHistoryDate}
                          onChange={(e) => setNewHistoryDate(e.target.value)}
                          className="px-2.5 py-2 min-h-[38px] rounded-md bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#293B5C] text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100"
                        />
                        <input
                          type="text"
                          value={newHistoryNote}
                          onChange={(e) => setNewHistoryNote(e.target.value)}
                          placeholder="e.g., Spoke with agent Priya (#4412); return courier scheduled."
                          className="flex-1 px-3 py-2 min-h-[38px] rounded-md bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#293B5C] text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 min-h-[38px] rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs cursor-pointer whitespace-nowrap"
                        >
                          Add Log
                        </button>
                      </div>
                      {historyError && (
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {historyError}
                        </p>
                      )}
                    </form>

                    {(activeClaim.history || []).length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-6">
                        No dated history entries recorded yet.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-200/70 dark:divide-slate-800/80">
                        {[...(activeClaim.history || [])]
                          .reverse()
                          .map((entry) => (
                            <div
                              key={entry.id}
                              className="py-3 flex items-start justify-between gap-3 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="font-mono tabular-nums font-semibold text-cyan-600 dark:text-cyan-400">
                                  {formatHumanDate(entry.date)}
                                </div>
                                <div className="text-slate-700 dark:text-slate-200">
                                  {entry.note}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteHistoryEntry(entry.id)}
                                aria-label="Delete log entry"
                                className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
