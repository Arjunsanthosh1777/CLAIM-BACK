import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  BellRing,
  Calendar as CalendarIcon,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FilePlus2,
  ListChecks,
  Plus,
  Search,
  Trash2,
  Wrench,
} from 'lucide-react';
import {
  CurrencyCode,
  DeadlineActionState,
  DeadlineCategory,
  DerivedDeadline,
} from '../types';
import {
  convertCurrencyAmount,
  diffCalendarDays,
  downloadTextFile,
  formatCurrency,
  formatDisplayMoney,
  formatHumanDate,
  formatYMD,
  generateIcsCalendar,
  parseYMD,
  todayYMD,
} from '../utils/dateAndMoney';

interface DeadlinesSectionProps {
  deadlines: DerivedDeadline[];
  displayCurrency: CurrencyCode;
  onUpdateActionState: (id: string, state: DeadlineActionState) => void;
  onOpenPrepModal: (deadline: DerivedDeadline) => void;
  onOpenCustomDeadlineModal: () => void;
  onDeleteCustomDeadline: (customId: string, title: string) => void;
  onEditPurchaseById: (purchaseId: string) => void;
  onStartClaimForPurchase: (purchaseId: string, suggestedType?: string) => void;
  onOpenClaimInRecovery: (claimId: string) => void;
  onRestoreSamples: () => void;
  onNotify: (msg: string) => void;
}

interface TimelineMilestone {
  key: string;
  deadlineId: string;
  date: string;
  kind: 'prep' | 'due' | 'start';
  label: string;
  subtitle: string;
  daysFromToday: number;
  isCompleted: boolean;
}

export const DeadlinesSection: React.FC<DeadlinesSectionProps> = ({
  deadlines,
  displayCurrency,
  onUpdateActionState,
  onOpenPrepModal,
  onOpenCustomDeadlineModal,
  onDeleteCustomDeadline,
  onEditPurchaseById,
  onStartClaimForPurchase,
  onOpenClaimInRecovery,
  onRestoreSamples,
  onNotify,
}) => {
  const [viewMode, setViewMode] = useState<'queue' | 'calendar'>('queue');
  const [categoryFilter, setCategoryFilter] = useState<'all' | DeadlineCategory>('all');
  const [stateFilter, setStateFilter] = useState<
    'active' | 'flagged' | 'prep_set' | 'completed' | 'all'
  >('active');
  const [sortBy, setSortBy] = useState<'urgency' | 'prep_asc' | 'amount_desc' | 'title_asc'>(
    'urgency'
  );
  const [search, setSearch] = useState('');
  const [focusedDeadlineId, setFocusedDeadlineId] = useState<string>('');

  // Calendar state
  const todayStr = todayYMD();
  const initialDate = parseYMD(todayStr) || new Date();
  const [calYear, setCalYear] = useState<number>(initialDate.getFullYear());
  const [calMonth, setCalMonth] = useState<number>(initialDate.getMonth()); // 0-indexed
  const [selectedCalendarYMD, setSelectedCalendarYMD] = useState<string>(todayStr);

  // Summary metrics
  const metrics = useMemo(() => {
    let overdueCount = 0;
    let dueSoonCount = 0;
    let missingInfoCount = 0;
    let prepDueCount = 0;

    for (const d of deadlines) {
      const isActive =
        d.actionState === 'needs_action' || d.actionState === 'in_progress';
      if (isActive && d.daysRemaining !== null && d.daysRemaining < 0) {
        overdueCount++;
      }
      if (
        isActive &&
        d.daysRemaining !== null &&
        d.daysRemaining >= 0 &&
        d.daysRemaining <= 14
      ) {
        dueSoonCount++;
      }
      if (isActive && d.missingReasons.length > 0) {
        missingInfoCount++;
      }
      if (
        isActive &&
        d.prepDaysRemaining !== null &&
        d.prepDaysRemaining <= 3
      ) {
        prepDueCount++;
      }
    }

    return { overdueCount, dueSoonCount, missingInfoCount, prepDueCount };
  }, [deadlines]);

  const filteredDeadlines = useMemo(() => {
    const q = search.trim().toLowerCase();

    const list = deadlines.filter((d) => {
      if (categoryFilter !== 'all' && d.type !== categoryFilter) {
        return false;
      }

      const isActive =
        d.actionState === 'needs_action' || d.actionState === 'in_progress';
      const isOverdue = d.daysRemaining !== null && d.daysRemaining < 0;
      const isFlagged = isActive && (isOverdue || d.missingReasons.length > 0);

      if (stateFilter === 'active' && !isActive) return false;
      if (stateFilter === 'flagged' && !isFlagged) return false;
      if (stateFilter === 'prep_set' && !d.prepDate) return false;
      if (
        stateFilter === 'completed' &&
        d.actionState !== 'completed' &&
        d.actionState !== 'not_applicable'
      ) {
        return false;
      }

      if (q) {
        const hay = [
          d.title,
          d.seller,
          d.typeLabel,
          d.receiptRef,
          d.basisText,
          d.userNote,
          ...d.missingReasons,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
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
      if (sortBy === 'prep_asc') {
        const pa = a.prepDaysRemaining ?? 999999;
        const pb = b.prepDaysRemaining ?? 999999;
        if (pa !== pb) return pa - pb;
      }
      if (sortBy === 'title_asc') {
        return a.title.localeCompare(b.title);
      }
      // Urgency sort: active items before completed, missing/overdue at top, then ascending daysRemaining
      const aDone =
        a.actionState === 'completed' || a.actionState === 'not_applicable'
          ? 1
          : 0;
      const bDone =
        b.actionState === 'completed' || b.actionState === 'not_applicable'
          ? 1
          : 0;
      if (aDone !== bDone) return aDone - bDone;

      const aScore =
        a.daysRemaining !== null
          ? a.daysRemaining
          : a.missingReasons.length > 0
          ? -500
          : 999999;
      const bScore =
        b.daysRemaining !== null
          ? b.daysRemaining
          : b.missingReasons.length > 0
          ? -500
          : 999999;
      return aScore - bScore;
    });

    return list;
  }, [deadlines, categoryFilter, stateFilter, sortBy, search, displayCurrency]);

  // Chronological timeline events
  const timelineEvents = useMemo<TimelineMilestone[]>(() => {
    const out: TimelineMilestone[] = [];
    for (const d of deadlines) {
      if (d.actionState === 'not_applicable') continue;
      const isCompleted = d.actionState === 'completed';

      if (d.prepDate && parseYMD(d.prepDate)) {
        const diff = diffCalendarDays(todayStr, d.prepDate) ?? 0;
        out.push({
          key: `prep_${d.id}`,
          deadlineId: d.id,
          date: d.prepDate,
          kind: 'prep',
          label: `Prep Target · ${d.title}`,
          subtitle: d.userNote || `Prepare evidence ahead of ${d.typeLabel.toLowerCase()}`,
          daysFromToday: diff,
          isCompleted,
        });
      }

      if (d.dueDate && parseYMD(d.dueDate)) {
        const diff = diffCalendarDays(todayStr, d.dueDate) ?? 0;
        out.push({
          key: `due_${d.id}`,
          deadlineId: d.id,
          date: d.dueDate,
          kind: 'due',
          label: `${d.typeLabel} · ${d.title}`,
          subtitle: `${d.seller} · ${
            d.policySource === 'seller_verified'
              ? 'Seller-verified cutoff'
              : 'Estimated cutoff'
          }`,
          daysFromToday: diff,
          isCompleted,
        });
      }
    }

    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  }, [deadlines, todayStr]);

  // Calendar grid computation
  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(calYear, calMonth, 1);
    const startWeekday = firstOfMonth.getDay(); // 0 = Sun
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    const cells: Array<{
      ymd: string;
      dayNum: number;
      inCurrentMonth: boolean;
      dueItems: DerivedDeadline[];
      prepItems: DerivedDeadline[];
    }> = [];

    // Leading days from previous month
    for (let i = startWeekday - 1; i >= 0; i--) {
      const dt = new Date(calYear, calMonth, -i);
      const ymd = formatYMD(dt);
      cells.push({
        ymd,
        dayNum: dt.getDate(),
        inCurrentMonth: false,
        dueItems: deadlines.filter((d) => d.dueDate === ymd),
        prepItems: deadlines.filter((d) => d.prepDate === ymd),
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dt = new Date(calYear, calMonth, day);
      const ymd = formatYMD(dt);
      cells.push({
        ymd,
        dayNum: day,
        inCurrentMonth: true,
        dueItems: deadlines.filter((d) => d.dueDate === ymd),
        prepItems: deadlines.filter((d) => d.prepDate === ymd),
      });
    }

    // Trailing days to complete 6 rows or end of week
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      const needed = 7 - remainder;
      for (let j = 1; j <= needed; j++) {
        const dt = new Date(calYear, calMonth + 1, j);
        const ymd = formatYMD(dt);
        cells.push({
          ymd,
          dayNum: dt.getDate(),
          inCurrentMonth: false,
          dueItems: deadlines.filter((d) => d.dueDate === ymd),
          prepItems: deadlines.filter((d) => d.prepDate === ymd),
        });
      }
    }

    return cells;
  }, [calYear, calMonth, deadlines]);

  const selectedDayItems = useMemo(() => {
    return deadlines.filter(
      (d) => d.dueDate === selectedCalendarYMD || d.prepDate === selectedCalendarYMD
    );
  }, [deadlines, selectedCalendarYMD]);

  const stepMonth = (delta: number) => {
    const next = new Date(calYear, calMonth + delta, 1);
    setCalYear(next.getFullYear());
    setCalMonth(next.getMonth());
  };

  const jumpToToday = () => {
    const dt = parseYMD(todayStr) || new Date();
    setCalYear(dt.getFullYear());
    setCalMonth(dt.getMonth());
    setSelectedCalendarYMD(todayStr);
  };

  const handleExportDeadlinesCsv = () => {
    if (filteredDeadlines.length === 0) {
      onNotify('No deadlines match current filters to export.');
      return;
    }
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = [
      'Title',
      'Category',
      'Seller',
      'Start Date',
      'Preparation Date',
      'Cutoff / Due Date',
      'Days Remaining',
      'Workflow Status',
      'Policy Source',
      'Original Amount',
      'Original Currency',
      `Amount (${displayCurrency})`,
      'Reference #',
      'Missing Info Flags',
      'Preparation Note',
    ];
    const rows = [headers.map(cell).join(',')];

    for (const d of filteredDeadlines) {
      const converted = convertCurrencyAmount(d.amount, d.currency, displayCurrency);
      rows.push(
        [
          d.title,
          d.typeLabel,
          d.seller,
          d.startDate || '',
          d.prepDate || '',
          d.dueDate || 'Missing',
          d.daysRemaining !== null ? d.daysRemaining : 'N/A',
          d.actionState,
          d.policySource,
          d.amount.toFixed(2),
          d.currency,
          converted.toFixed(2),
          d.receiptRef || '',
          d.missingReasons.join('; '),
          d.userNote || '',
        ]
          .map(cell)
          .join(',')
      );
    }

    downloadTextFile(
      `claimback-deadlines-${displayCurrency.toLowerCase()}-${todayStr}.csv`,
      rows.join('\r\n'),
      'text/csv;charset=utf-8;'
    );
    onNotify(`Exported ${filteredDeadlines.length} deadlines in ${displayCurrency}.`);
  };

  const handleExportIcs = (items: DerivedDeadline[], filenameSlug = 'all-deadlines') => {
    const activeWithDates = items.filter(
      (d) =>
        d.actionState !== 'completed' &&
        d.actionState !== 'not_applicable' &&
        (Boolean(d.dueDate) || Boolean(d.prepDate))
    );
    if (activeWithDates.length === 0) {
      onNotify('No open deadlines with valid calendar dates to export.');
      return;
    }
    const ics = generateIcsCalendar(activeWithDates, displayCurrency);
    downloadTextFile(
      `claimback-${filenameSlug}-${todayStr}.ics`,
      ics,
      'text/calendar;charset=utf-8;'
    );
    onNotify(
      `Downloaded calendar reminders (.ics) for ${activeWithDates.length} ${
        activeWithDates.length === 1 ? 'deadline' : 'deadlines'
      }.`
    );
  };

  const renderUrgencyLabel = (d: DerivedDeadline) => {
    if (d.actionState === 'completed') {
      return (
        <span className="font-mono tabular-nums text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          ✓ Completed
        </span>
      );
    }
    if (d.actionState === 'not_applicable') {
      return (
        <span className="font-mono tabular-nums text-xs text-slate-400">
          Not applicable
        </span>
      );
    }
    if (d.daysRemaining === null) {
      return (
        <span className="font-mono tabular-nums text-xs font-semibold text-red-600 dark:text-red-400">
          ! Cutoff date missing
        </span>
      );
    }
    if (d.daysRemaining < 0) {
      return (
        <span className="font-mono tabular-nums text-xs font-semibold text-red-600 dark:text-red-400">
          ! {Math.abs(d.daysRemaining)}d overdue
        </span>
      );
    }
    if (d.daysRemaining === 0) {
      return (
        <span className="font-mono tabular-nums text-xs font-semibold text-red-600 dark:text-red-400">
          ! Due today
        </span>
      );
    }
    if (d.daysRemaining <= 14) {
      return (
        <span className="font-mono tabular-nums text-xs font-semibold text-amber-600 dark:text-amber-400">
          ▲ {d.daysRemaining}d remaining
        </span>
      );
    }
    return (
      <span className="font-mono tabular-nums text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        {d.daysRemaining}d remaining
      </span>
    );
  };

  const monthHeading = new Date(calYear, calMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Header & View Switcher */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
            Deadline Radar
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-[70ch]">
            Prioritize upcoming return cutoffs, warranty expirations, refundable
            deposits, and claim follow-ups. Actual eligibility depends on the
            seller&apos;s written policy and applicable consumer regulations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className="inline-flex p-1 rounded-lg bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47]"
            role="group"
            aria-label="Switch deadline view"
          >
            <button
              type="button"
              onClick={() => setViewMode('queue')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'queue'
                  ? 'bg-slate-900 text-white dark:bg-[#1E2D4A] dark:text-slate-50'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              Priority Queue
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-slate-900 text-white dark:bg-[#1E2D4A] dark:text-slate-50'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Calendar Grid
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleExportIcs(filteredDeadlines, 'radar')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] hover:border-slate-400 dark:hover:border-slate-500 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <CalendarPlus className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            Calendar (.ics)
          </button>

          <button
            type="button"
            onClick={handleExportDeadlinesCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] hover:border-slate-400 dark:hover:border-slate-500 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={onOpenCustomDeadlineModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Log Standalone Deadline
          </button>
        </div>
      </div>

      {/* 4-Column Urgency Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-[#1F2D47]">
        <button
          type="button"
          onClick={() => {
            setViewMode('queue');
            setStateFilter('flagged');
          }}
          className="p-4 text-left hover:bg-slate-50 dark:hover:bg-[#172238] transition-colors cursor-pointer"
        >
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Overdue Deadlines
          </div>
          <div
            className={`font-mono tabular-nums text-2xl font-semibold mt-1 ${
              metrics.overdueCount > 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-slate-900 dark:text-slate-50'
            }`}
          >
            {metrics.overdueCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Past cutoff &amp; still open
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setViewMode('queue');
            setStateFilter('active');
            setSortBy('urgency');
          }}
          className="p-4 text-left hover:bg-slate-50 dark:hover:bg-[#172238] transition-colors cursor-pointer"
        >
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Closing Within 14 Days
          </div>
          <div
            className={`font-mono tabular-nums text-2xl font-semibold mt-1 ${
              metrics.dueSoonCount > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-900 dark:text-slate-50'
            }`}
          >
            {metrics.dueSoonCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Prepare evidence &amp; RMA now
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setViewMode('queue');
            setStateFilter('flagged');
          }}
          className="p-4 text-left hover:bg-slate-50 dark:hover:bg-[#172238] transition-colors cursor-pointer"
        >
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Missing Info Flags
          </div>
          <div
            className={`font-mono tabular-nums text-2xl font-semibold mt-1 ${
              metrics.missingInfoCount > 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-slate-900 dark:text-slate-50'
            }`}
          >
            {metrics.missingInfoCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Missing receipt ref or cutoff date
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setViewMode('queue');
            setStateFilter('prep_set');
            setSortBy('prep_asc');
          }}
          className="p-4 text-left hover:bg-slate-50 dark:hover:bg-[#172238] transition-colors cursor-pointer"
        >
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Prep Alerts (≤3 Days)
          </div>
          <div
            className={`font-mono tabular-nums text-2xl font-semibold mt-1 ${
              metrics.prepDueCount > 0
                ? 'text-cyan-600 dark:text-cyan-400'
                : 'text-slate-900 dark:text-slate-50'
            }`}
          >
            {metrics.prepDueCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Earlier user preparation targets
          </div>
        </button>
      </div>

      {viewMode === 'queue' ? (
        <>
          {/* Filter Controls */}
          <div className="bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl p-4 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search item, seller, reference #, or preparation note..."
                  className="w-full pl-9 pr-3 py-2 min-h-[40px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={stateFilter}
                  onChange={(e) =>
                    setStateFilter(e.target.value as typeof stateFilter)
                  }
                  aria-label="Filter by workflow state"
                  className="px-3 py-2 min-h-[40px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] text-xs font-medium text-slate-800 dark:text-slate-200"
                >
                  <option value="active">Workflow: Open (Needs Action / In Progress)</option>
                  <option value="flagged">Workflow: Overdue &amp; Missing Info</option>
                  <option value="prep_set">Workflow: Has Prep Date</option>
                  <option value="completed">Workflow: Completed / N/A</option>
                  <option value="all">Workflow: All Items</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  aria-label="Sort deadlines"
                  className="px-3 py-2 min-h-[40px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1F2D47] text-xs font-medium text-slate-800 dark:text-slate-200"
                >
                  <option value="urgency">Sort: Urgency (Overdue &amp; Soonest First)</option>
                  <option value="prep_asc">Sort: Preparation Date (Soonest)</option>
                  <option value="amount_desc">
                    Sort: Protected Value ({displayCurrency} High → Low)
                  </option>
                  <option value="title_asc">Sort: Item Name (A → Z)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0E1626]"
                role="group"
                aria-label="Filter deadlines by category"
              >
                {(
                  [
                    ['all', 'All Types'],
                    ['return', 'Return Windows'],
                    ['warranty', 'Warranties'],
                    ['refund', 'Refund Follow-Ups'],
                    ['deposit', 'Deposits'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategoryFilter(key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      categoryFilter === key
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
                  Showing {filteredDeadlines.length} of {deadlines.length}
                </span>
                {(search ||
                  categoryFilter !== 'all' ||
                  stateFilter !== 'active') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setCategoryFilter('all');
                      setStateFilter('active');
                    }}
                    className="text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2-Column Split: Priority Queue (col-span-8) + Chronological Event Timeline (col-span-4) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 space-y-3.5">
              {filteredDeadlines.length === 0 ? (
                <div className="bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl p-10 text-center space-y-3">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {deadlines.length === 0
                      ? 'No deadlines tracked yet'
                      : 'No deadlines match current filters'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {deadlines.length === 0
                      ? 'Add a purchase with a return window or warranty, log a standalone deadline, or restore sample records.'
                      : 'Switch workflow filter to "All Items" or clear your search query to view completed or non-applicable milestones.'}
                  </p>
                  <div className="flex justify-center flex-wrap gap-2.5 pt-1">
                    {deadlines.length === 0 ? (
                      <button
                        type="button"
                        onClick={onRestoreSamples}
                        className="px-4 py-2 min-h-[38px] rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs cursor-pointer"
                      >
                        Restore Sample Deadlines
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('');
                          setCategoryFilter('all');
                          setStateFilter('all');
                        }}
                        className="px-4 py-2 min-h-[38px] rounded-lg border border-slate-300 dark:border-[#293B5C] text-xs font-medium cursor-pointer"
                      >
                        Show All Deadlines
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {filteredDeadlines.map((d) => {
                    const isFocused = focusedDeadlineId === d.id;
                    const recCur = d.currency || 'USD';

                    return (
                      <motion.article
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.99 }}
                        transition={{ duration: 0.15 }}
                        key={d.id}
                        id={`deadline-card-${d.id}`}
                        className={`bg-white dark:bg-[#121A2D] border rounded-xl p-5 transition-colors ${
                          isFocused
                            ? 'border-cyan-500 ring-1 ring-cyan-500/40'
                            : 'border-slate-200 dark:border-[#1F2D47] hover:border-slate-300 dark:hover:border-[#2E4268]'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-base text-slate-900 dark:text-slate-50">
                                {d.title}
                              </h3>
                              {renderUrgencyLabel(d)}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {d.typeLabel}
                              </span>
                              <span>·</span>
                              <span>{d.seller}</span>
                              <span>·</span>
                              <span>
                                {d.policySource === 'seller_verified' ? (
                                  <span className="text-emerald-600 dark:text-emerald-400">
                                    Seller-verified policy
                                  </span>
                                ) : (
                                  'User-entered estimate'
                                )}
                              </span>
                              <span>·</span>
                              <span>{d.basisText}</span>
                              {d.isSample && (
                                <>
                                  <span>·</span>
                                  <span className="text-cyan-600 dark:text-cyan-400">
                                    Sample
                                  </span>
                                </>
                              )}
                            </div>

                            {d.missingReasons.length > 0 && (
                              <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium pt-0.5">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>{d.missingReasons.join(' · ')}</span>
                              </div>
                            )}
                          </div>

                          <div className="sm:text-right shrink-0 space-y-1">
                            <div className="font-mono tabular-nums font-semibold text-base text-slate-900 dark:text-slate-50">
                              {d.amount > 0
                                ? formatDisplayMoney(
                                    d.amount,
                                    recCur,
                                    displayCurrency
                                  )
                                : 'Coverage / Repair'}
                            </div>
                            {d.amount > 0 && recCur !== displayCurrency && (
                              <div className="font-mono tabular-nums text-[11px] text-slate-400">
                                Orig: {formatCurrency(d.amount, recCur)}
                              </div>
                            )}
                            <div className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                              Cutoff: {formatHumanDate(d.dueDate)}
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar + Prep Reminder Details */}
                        <div className="mt-3.5 space-y-2">
                          {d.dueDate && (
                            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-[#0B1120] overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  d.actionState === 'completed'
                                    ? 'bg-emerald-500'
                                    : d.daysRemaining !== null &&
                                      d.daysRemaining < 0
                                    ? 'bg-red-500'
                                    : d.daysRemaining !== null &&
                                      d.daysRemaining <= 14
                                    ? 'bg-amber-400'
                                    : 'bg-cyan-500'
                                }`}
                                style={{ width: `${d.progressPct}%` }}
                              />
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="font-mono tabular-nums">
                                Started: {formatHumanDate(d.startDate)}
                              </span>
                              {d.receiptRef && (
                                <span className="font-mono">
                                  Ref: {d.receiptRef}
                                </span>
                              )}
                              {d.prepDate && (
                                <span className="inline-flex items-center gap-1 font-mono tabular-nums text-cyan-600 dark:text-cyan-400 font-medium">
                                  <BellRing className="w-3.5 h-3.5" />
                                  Prep target: {formatHumanDate(d.prepDate)} (
                                  {d.prepDaysRemaining !== null
                                    ? d.prepDaysRemaining < 0
                                      ? `${Math.abs(d.prepDaysRemaining)}d ago`
                                      : d.prepDaysRemaining === 0
                                      ? 'today'
                                      : `in ${d.prepDaysRemaining}d`
                                    : ''}
                                  )
                                </span>
                              )}
                            </div>
                          </div>

                          {d.userNote && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 pt-0.5">
                              Note: {d.userNote}
                            </p>
                          )}
                        </div>

                        {/* Interactive Workflow Bar */}
                        <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor={`status-${d.id}`}
                              className="text-xs font-medium text-slate-500 dark:text-slate-400"
                            >
                              Status:
                            </label>
                            <select
                              id={`status-${d.id}`}
                              value={d.actionState}
                              onChange={(e) =>
                                onUpdateActionState(
                                  d.id,
                                  e.target.value as DeadlineActionState
                                )
                              }
                              className="px-2.5 py-1.5 min-h-[34px] rounded-md bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#293B5C] text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                            >
                              <option value="needs_action">Needs Action</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                              <option value="not_applicable">Not Applicable</option>
                            </select>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenPrepModal(d)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-md border border-slate-200 dark:border-[#293B5C] hover:bg-slate-100 dark:hover:bg-[#1E2D4A] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              {d.prepDate ? 'Edit Prep Date' : 'Set Prep Date'}
                            </button>

                            {d.dueDate &&
                              d.actionState !== 'completed' &&
                              d.actionState !== 'not_applicable' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleExportIcs(
                                      [d],
                                      d.title
                                        .toLowerCase()
                                        .replace(/[^a-z0-9]+/g, '-')
                                        .slice(0, 28)
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] rounded-md border border-slate-200 dark:border-[#293B5C] hover:bg-slate-100 dark:hover:bg-[#1E2D4A] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                                  title="Download .ics calendar reminder for Google, Apple, or Outlook Calendar"
                                >
                                  <CalendarPlus className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                                  .ics
                                </button>
                              )}

                            {d.purchaseId && d.missingReasons.length > 0 && (
                              <button
                                type="button"
                                onClick={() => onEditPurchaseById(d.purchaseId)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-md border border-amber-400/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 text-xs font-medium transition-colors cursor-pointer"
                              >
                                <Wrench className="w-3.5 h-3.5" />
                                Fix Missing Info
                              </button>
                            )}

                            {d.purchaseId && (
                              <button
                                type="button"
                                onClick={() =>
                                  onStartClaimForPurchase(
                                    d.purchaseId,
                                    d.type === 'warranty'
                                      ? 'repair'
                                      : d.type === 'deposit'
                                      ? 'deposit'
                                      : 'return'
                                  )
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-[#1E2D4A] dark:hover:bg-[#273B60] text-white text-xs font-semibold transition-colors cursor-pointer"
                              >
                                <FilePlus2 className="w-3.5 h-3.5" />
                                Prepare Claim
                              </button>
                            )}

                            {d.claimId && (
                              <button
                                type="button"
                                onClick={() => onOpenClaimInRecovery(d.claimId)}
                                className="px-3 py-1.5 min-h-[34px] rounded-md bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/25 text-xs font-semibold transition-colors cursor-pointer"
                              >
                                Open Claim →
                              </button>
                            )}

                            {d.customId && (
                              <button
                                type="button"
                                onClick={() =>
                                  onDeleteCustomDeadline(d.customId, d.title)
                                }
                                aria-label={`Delete ${d.title}`}
                                className="p-1.5 min-h-[34px] min-w-[34px] rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>

            {/* Right Column: Chronological Event Timeline */}
            <aside className="lg:col-span-4 bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl p-5 space-y-4">
              <div>
                <h2 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                  Chronological Event Timeline
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Click any milestone to focus its record in the radar queue.
                </p>
              </div>

              {timelineEvents.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                  No scheduled preparation dates or cutoffs to plot yet.
                </p>
              ) : (
                <div className="relative pl-5 space-y-4 max-h-[620px] overflow-y-auto pr-1 before:content-[''] before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
                  {timelineEvents.map((ev) => {
                    const dotColor = ev.isCompleted
                      ? 'bg-emerald-500'
                      : ev.kind === 'prep'
                      ? 'bg-cyan-500'
                      : ev.daysFromToday < 0
                      ? 'bg-red-500'
                      : ev.daysFromToday <= 14
                      ? 'bg-amber-400'
                      : 'bg-slate-400';

                    return (
                      <button
                        key={ev.key}
                        type="button"
                        onClick={() => {
                          setStateFilter('all');
                          setCategoryFilter('all');
                          setFocusedDeadlineId(ev.deadlineId);
                          const el = document.getElementById(
                            `deadline-card-${ev.deadlineId}`
                          );
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className="relative w-full text-left group cursor-pointer block"
                      >
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${dotColor} absolute -left-[17px] top-1.5 ring-4 ring-white dark:ring-[#121A2D]`}
                        />
                        <div className="flex items-center justify-between gap-2 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          <span>{formatHumanDate(ev.date)}</span>
                          <span>
                            {ev.isCompleted
                              ? 'Done'
                              : ev.daysFromToday < 0
                              ? `${Math.abs(ev.daysFromToday)}d ago`
                              : ev.daysFromToday === 0
                              ? 'Today'
                              : `in ${ev.daysFromToday}d`}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors mt-0.5">
                          {ev.label}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          {ev.subtitle}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>
          </div>
        </>
      ) : (
        /* Interactive Monthly Calendar Grid View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
                {monthHeading}
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => stepMonth(-1)}
                  aria-label="Previous month"
                  className="p-2 rounded-lg border border-slate-200 dark:border-[#293B5C] hover:bg-slate-100 dark:hover:bg-[#1E2D4A] cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={jumpToToday}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#293B5C] hover:bg-slate-100 dark:hover:bg-[#1E2D4A] text-xs font-semibold cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => stepMonth(1)}
                  aria-label="Next month"
                  className="p-2 rounded-lg border border-slate-200 dark:border-[#293B5C] hover:bg-slate-100 dark:hover:bg-[#1E2D4A] cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 pb-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((cell) => {
                const isToday = cell.ymd === todayStr;
                const isSelected = cell.ymd === selectedCalendarYMD;
                const totalEvents = cell.dueItems.length + cell.prepItems.length;

                return (
                  <button
                    key={cell.ymd}
                    type="button"
                    onClick={() => setSelectedCalendarYMD(cell.ymd)}
                    className={`min-h-[76px] p-2 rounded-lg border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : cell.inCurrentMonth
                        ? 'border-slate-200/80 dark:border-[#1F2D47] bg-slate-50/50 dark:bg-[#0E1626]/60 hover:border-slate-300 dark:hover:border-slate-600'
                        : 'border-transparent opacity-45 hover:opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-mono tabular-nums text-xs font-semibold ${
                          isToday
                            ? 'text-cyan-600 dark:text-cyan-400 underline underline-offset-4'
                            : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {cell.dayNum}
                      </span>
                      {totalEvents > 0 && (
                        <span className="font-mono tabular-nums text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {totalEvents}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 mt-1">
                      {cell.dueItems.slice(0, 2).map((di) => (
                        <div
                          key={`due_${di.id}`}
                          className={`text-[10px] leading-tight truncate font-medium ${
                            di.actionState === 'completed'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : di.daysRemaining !== null && di.daysRemaining < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          • {di.title}
                        </div>
                      ))}
                      {cell.prepItems.slice(0, 1).map((pi) => (
                        <div
                          key={`prep_${pi.id}`}
                          className="text-[10px] leading-tight truncate font-medium text-cyan-600 dark:text-cyan-400"
                        >
                          ◦ Prep: {pi.title}
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="lg:col-span-4 bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl p-5 space-y-4">
            <div>
              <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                Selected Date
              </div>
              <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100 mt-0.5">
                {formatHumanDate(selectedCalendarYMD)}
              </h3>
            </div>

            {selectedDayItems.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
                No cutoff dates or preparation reminders fall on this date.
              </p>
            ) : (
              <div className="divide-y divide-slate-200/70 dark:divide-slate-800/80 space-y-3">
                {selectedDayItems.map((item) => (
                  <div key={item.id} className="pt-3 first:pt-0 space-y-2">
                    <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      {item.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {item.typeLabel} · {item.seller} ·{' '}
                      {formatDisplayMoney(
                        item.amount,
                        item.currency,
                        displayCurrency
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={item.actionState}
                        onChange={(e) =>
                          onUpdateActionState(
                            item.id,
                            e.target.value as DeadlineActionState
                          )
                        }
                        className="px-2.5 py-1 rounded-md bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#293B5C] text-xs font-medium"
                      >
                        <option value="needs_action">Needs Action</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="not_applicable">Not Applicable</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => onOpenPrepModal(item)}
                        className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-[#293B5C] text-xs font-medium cursor-pointer"
                      >
                        Prep Date
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};
