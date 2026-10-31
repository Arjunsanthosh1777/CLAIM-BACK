/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  Coins,
  Menu,
  Moon,
  Plus,
  Sun,
  Type,
  X,
} from 'lucide-react';
import {
  ActiveTab,
  ClaimRecord,
  ClaimType,
  CurrencyCode,
  CustomDeadlineRecord,
  DeadlineActionState,
  DerivedDeadline,
  PurchaseRecord,
  ThemeMode,
  TypeScale,
  WorkspaceState,
} from './types';
import {
  buildSampleDataset,
  CURRENCY_OPTIONS,
  deriveAllDeadlines,
  ParsedReceiptFields,
  STORAGE_KEYS,
  todayYMD,
} from './utils/dateAndMoney';
import { OverviewSection } from './components/OverviewSection';
import { VaultSection } from './components/VaultSection';
import { DeadlinesSection } from './components/DeadlinesSection';
import { RecoverySection } from './components/RecoverySection';
import {
  BackupPrivacyModal,
  ClaimModal,
  ConfirmDialog,
  CustomDeadlineModal,
  PrepDateModal,
  ProofInspectorModal,
  PurchaseModal,
} from './components/Modals';

interface ToastMessage {
  id: string;
  text: string;
}

function readLocalWorkspace(): WorkspaceState {
  try {
    const initialized = localStorage.getItem(STORAGE_KEYS.INIT);
    if (!initialized) {
      const sample = buildSampleDataset();
      localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(sample.purchases));
      localStorage.setItem(
        STORAGE_KEYS.DEADLINE_META,
        JSON.stringify(sample.deadlineMeta)
      );
      localStorage.setItem(
        STORAGE_KEYS.CUSTOM_DEADLINES,
        JSON.stringify(sample.customDeadlines)
      );
      localStorage.setItem(STORAGE_KEYS.CLAIMS, JSON.stringify(sample.claims));
      localStorage.setItem(
        STORAGE_KEYS.INIT,
        JSON.stringify({ seededAt: new Date().toISOString() })
      );
      return sample;
    }

    const purchases = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.PURCHASES) || '[]'
    );
    const deadlineMeta = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.DEADLINE_META) || '{}'
    );
    const customDeadlines = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.CUSTOM_DEADLINES) || '[]'
    );
    const claims = JSON.parse(localStorage.getItem(STORAGE_KEYS.CLAIMS) || '[]');

    return {
      purchases: Array.isArray(purchases) ? purchases : [],
      deadlineMeta:
        deadlineMeta && typeof deadlineMeta === 'object' ? deadlineMeta : {},
      customDeadlines: Array.isArray(customDeadlines) ? customDeadlines : [],
      claims: Array.isArray(claims) ? claims : [],
    };
  } catch {
    return buildSampleDataset();
  }
}

function persistLocalWorkspace(ws: WorkspaceState) {
  try {
    localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(ws.purchases));
    localStorage.setItem(
      STORAGE_KEYS.DEADLINE_META,
      JSON.stringify(ws.deadlineMeta)
    );
    localStorage.setItem(
      STORAGE_KEYS.CUSTOM_DEADLINES,
      JSON.stringify(ws.customDeadlines)
    );
    localStorage.setItem(STORAGE_KEYS.CLAIMS, JSON.stringify(ws.claims));
    if (!localStorage.getItem(STORAGE_KEYS.INIT)) {
      localStorage.setItem(
        STORAGE_KEYS.INIT,
        JSON.stringify({ seededAt: new Date().toISOString() })
      );
    }
  } catch {
    // Ignore storage quota errors gracefully
  }
}

function tabFromPathname(pathname: string): ActiveTab {
  const clean = pathname.replace(/\/+$/, '').toLowerCase();
  if (clean === '/vault') return 'vault';
  if (clean === '/deadlines') return 'deadlines';
  if (clean === '/recovery') return 'recovery';
  return 'overview';
}

function pathnameFromTab(tab: ActiveTab): string {
  if (tab === 'vault') return '/vault';
  if (tab === 'deadlines') return '/deadlines';
  if (tab === 'recovery') return '/recovery';
  return '/';
}

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(() =>
    readLocalWorkspace()
  );
  const [activeTab, setActiveTabState] = useState<ActiveTab>(() =>
    typeof window !== 'undefined'
      ? tabFromPathname(window.location.pathname)
      : 'overview'
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const setActiveTab = useCallback((nextTab: ActiveTab) => {
    setActiveTabState(nextTab);
    try {
      const targetPath = pathnameFromTab(nextTab);
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ tab: nextTab }, '', targetPath);
      }
    } catch {
      // Ignore history restrictions in sandboxed environments
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setActiveTabState(tabFromPathname(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Dynamic UI Preferences: Currency (INR default), Theme, Dynamic Type Scale
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENCY) as CurrencyCode | null;
      if (saved && CURRENCY_OPTIONS.some((c) => c.code === saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'INR';
  });

  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.THEME);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // ignore
    }
    return 'dark';
  });

  const [typeScale, setTypeScale] = useState<TypeScale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SCALE);
      if (saved === 'compact' || saved === 'standard' || saved === 'large') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'standard';
  });

  // Cross-module focus & filtering
  const [highlightedPurchaseId, setHighlightedPurchaseId] = useState('');
  const [selectedClaimId, setSelectedClaimId] = useState('');
  const [recoveryPurchaseFilterId, setRecoveryPurchaseFilterId] = useState('');

  // Modal states
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseRecord | null>(
    null
  );
  const [purchasePrefill, setPurchasePrefill] =
    useState<Partial<ParsedReceiptFields> | null>(null);

  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [editingClaim, setEditingClaim] = useState<ClaimRecord | null>(null);
  const [claimModalPurchaseId, setClaimModalPurchaseId] = useState('');
  const [claimModalSuggestedType, setClaimModalSuggestedType] =
    useState<ClaimType>('return');

  const [prepModalDeadline, setPrepModalDeadline] =
    useState<DerivedDeadline | null>(null);
  const [customDeadlineModalOpen, setCustomDeadlineModalOpen] = useState(false);
  const [inspectProofPurchase, setInspectProofPurchase] =
    useState<PurchaseRecord | null>(null);
  const [backupModalOpen, setBackupModalOpen] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    onConfirm: () => {},
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const syncTimerRef = useRef<number | null>(null);

  const notify = useCallback((text: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  // Apply Theme, TypeScale, and Currency to DOM & localStorage
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.typeScale = typeScale;
    try {
      localStorage.setItem(STORAGE_KEYS.SCALE, typeScale);
    } catch {
      // ignore
    }
  }, [typeScale]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENCY, displayCurrency);
    } catch {
      // ignore
    }
  }, [displayCurrency]);

  // Persist workspace to localStorage and sync to Express `/api/workspace`
  useEffect(() => {
    persistLocalWorkspace(workspace);
    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = window.setTimeout(() => {
      fetch('/api/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workspace),
      }).catch(() => {
        // Offline / static fallback works seamlessly via localStorage
      });
    }, 350);
  }, [workspace]);

  // Listen to cross-tab localStorage updates (keeps standalone HTML pages synced)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === STORAGE_KEYS.PURCHASES ||
        e.key === STORAGE_KEYS.DEADLINE_META ||
        e.key === STORAGE_KEYS.CUSTOM_DEADLINES ||
        e.key === STORAGE_KEYS.CLAIMS
      ) {
        setWorkspace(readLocalWorkspace());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const derivedDeadlines = useMemo(
    () => deriveAllDeadlines(workspace),
    [workspace]
  );

  /* ==========================================================================
   * MUTATION HANDLERS
   * ======================================================================== */
  const handleSavePurchase = (record: PurchaseRecord) => {
    setWorkspace((prev) => {
      const exists = prev.purchases.some((p) => p.id === record.id);
      const purchases = exists
        ? prev.purchases.map((p) => (p.id === record.id ? record : p))
        : [record, ...prev.purchases];
      return { ...prev, purchases };
    });
    setPurchaseModalOpen(false);
    setEditingPurchase(null);
    setPurchasePrefill(null);
    setHighlightedPurchaseId(record.id);
    notify(
      editingPurchase
        ? `Updated "${record.productName}".`
        : `Saved "${record.productName}" (${record.currency || displayCurrency}) to Purchase Vault.`
    );
  };

  const handleQuickCreateSimulatedPurchase = (sim: {
    productName: string;
    seller: string;
    purchaseDate: string;
    amount: number;
    currency: CurrencyCode;
    returnDays: number;
    warrantyMonths: number;
  }) => {
    const nowIso = new Date().toISOString();
    const record: PurchaseRecord = {
      id: `pur_${Date.now()}`,
      isSample: false,
      productName: sim.productName,
      seller: sim.seller,
      category: 'electronics',
      purchaseType: 'purchase',
      purchaseDate: sim.purchaseDate,
      amount: sim.amount,
      currency: sim.currency,
      receiptRef: `SIM-${String(Date.now()).slice(-5)}`,
      hasReturnWindow: sim.returnDays > 0,
      returnDurationDays: sim.returnDays > 0 ? sim.returnDays : null,
      returnExactDate: '',
      returnPolicySource: 'user_estimate',
      hasWarranty: sim.warrantyMonths > 0,
      warrantyDurationValue: sim.warrantyMonths > 0 ? sim.warrantyMonths : null,
      warrantyDurationUnit: 'months',
      warrantyExactDate: '',
      warrantyPolicySource: 'user_estimate',
      hasDeposit: false,
      depositDueDate: '',
      depositCondition: '',
      proofFile: null,
      notes: 'Created from Live Coverage Simulator.',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setWorkspace((prev) => ({
      ...prev,
      purchases: [record, ...prev.purchases],
    }));
    setHighlightedPurchaseId(record.id);
    setActiveTab('vault');
    notify(`Added simulated item "${record.productName}" to Purchase Vault.`);
  };

  const handleDeletePurchase = (purchase: PurchaseRecord) => {
    setConfirmState({
      open: true,
      title: 'Delete Purchase Record?',
      message: `Remove "${purchase.productName}" (${purchase.seller}) from your Purchase Vault? Any existing recovery claims will remain on file as standalone records.`,
      confirmLabel: 'Delete Purchase',
      onConfirm: () => {
        setWorkspace((prev) => ({
          ...prev,
          purchases: prev.purchases.filter((p) => p.id !== purchase.id),
        }));
        setConfirmState((s) => ({ ...s, open: false }));
        notify(`Deleted "${purchase.productName}".`);
      },
    });
  };

  const handleUpdateDeadlineState = (
    deadlineId: string,
    actionState: DeadlineActionState
  ) => {
    setWorkspace((prev) => {
      const existingMeta = prev.deadlineMeta[deadlineId] || {
        actionState: 'needs_action',
        prepDate: '',
        userNote: '',
        updatedAt: '',
      };
      return {
        ...prev,
        deadlineMeta: {
          ...prev.deadlineMeta,
          [deadlineId]: {
            ...existingMeta,
            actionState,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
    notify('Updated deadline workflow status.');
  };

  const handleSavePrepDate = (
    deadlineId: string,
    prepDate: string,
    userNote: string
  ) => {
    setWorkspace((prev) => {
      const existingMeta = prev.deadlineMeta[deadlineId] || {
        actionState: 'needs_action' as DeadlineActionState,
        prepDate: '',
        userNote: '',
        updatedAt: '',
      };
      return {
        ...prev,
        deadlineMeta: {
          ...prev.deadlineMeta,
          [deadlineId]: {
            ...existingMeta,
            prepDate,
            userNote,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
    setPrepModalDeadline(null);
    notify(
      prepDate
        ? `Set earlier preparation target for ${prepDate}.`
        : 'Cleared preparation date.'
    );
  };

  const handleSaveCustomDeadline = (cd: CustomDeadlineRecord) => {
    setWorkspace((prev) => ({
      ...prev,
      customDeadlines: [cd, ...prev.customDeadlines],
    }));
    setCustomDeadlineModalOpen(false);
    notify(`Logged standalone deadline "${cd.title}".`);
  };

  const handleDeleteCustomDeadline = (customId: string, title: string) => {
    setConfirmState({
      open: true,
      title: 'Delete Standalone Deadline?',
      message: `Remove "${title}" from Deadline Radar?`,
      confirmLabel: 'Delete Deadline',
      onConfirm: () => {
        setWorkspace((prev) => ({
          ...prev,
          customDeadlines: prev.customDeadlines.filter((c) => c.id !== customId),
        }));
        setConfirmState((s) => ({ ...s, open: false }));
        notify(`Deleted deadline "${title}".`);
      },
    });
  };

  const handleSaveClaim = (claim: ClaimRecord) => {
    setWorkspace((prev) => {
      const exists = prev.claims.some((c) => c.id === claim.id);
      const claims = exists
        ? prev.claims.map((c) => (c.id === claim.id ? claim : c))
        : [claim, ...prev.claims];
      return { ...prev, claims };
    });
    setClaimModalOpen(false);
    setEditingClaim(null);
    setSelectedClaimId(claim.id);
    setActiveTab('recovery');
    notify(
      editingClaim
        ? `Saved updates to "${claim.itemSummary}".`
        : `Created claim for "${claim.itemSummary}".`
    );
  };

  const handleUpdateClaimInline = (updated: ClaimRecord) => {
    setWorkspace((prev) => ({
      ...prev,
      claims: prev.claims.map((c) => (c.id === updated.id ? updated : c)),
    }));
  };

  const handleDeleteClaim = (claim: ClaimRecord) => {
    setConfirmState({
      open: true,
      title: 'Delete Recovery Claim?',
      message: `Permanently delete the claim for "${claim.itemSummary}" (${claim.seller}) and its correspondence draft?`,
      confirmLabel: 'Delete Claim',
      onConfirm: () => {
        setWorkspace((prev) => ({
          ...prev,
          claims: prev.claims.filter((c) => c.id !== claim.id),
        }));
        setConfirmState((s) => ({ ...s, open: false }));
        notify(`Deleted claim "${claim.itemSummary}".`);
      },
    });
  };

  const handleStartClaimForPurchase = (
    purchaseId: string,
    suggestedType = 'return'
  ) => {
    const validType: ClaimType =
      suggestedType === 'refund' ||
      suggestedType === 'return' ||
      suggestedType === 'repair' ||
      suggestedType === 'replacement' ||
      suggestedType === 'deposit'
        ? suggestedType
        : 'return';
    setEditingClaim(null);
    setClaimModalPurchaseId(purchaseId);
    setClaimModalSuggestedType(validType);
    setClaimModalOpen(true);
  };

  const handleRestoreSamples = () => {
    const sample = buildSampleDataset();
    setWorkspace(sample);
    setDisplayCurrency('INR');
    notify('Restored fictional INR (₹) sample purchases, deadlines, and claims.');
  };

  const handleClearAllData = () => {
    setConfirmState({
      open: true,
      title: 'Clear All Local Workspace Data?',
      message:
        'This removes all purchases, deadlines, and claims from your browser storage. Export a JSON backup first if you want to keep your records.',
      confirmLabel: 'Clear Workspace',
      onConfirm: () => {
        setWorkspace({
          purchases: [],
          deadlineMeta: {},
          customDeadlines: [],
          claims: [],
        });
        setConfirmState((s) => ({ ...s, open: false }));
        notify('Cleared all workspace records.');
      },
    });
  };

  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'vault', label: 'Purchase Vault' },
    { id: 'deadlines', label: 'Deadline Radar' },
    { id: 'recovery', label: 'Recovery Center' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Strict 3-Zone Top Bar: Brand | Single-Row Navigation | Primary Action */}
      <header className="sticky top-0 z-40 h-16 bg-white/95 dark:bg-[#0E1626]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#1F2D47]">
        <div className="max-w-[1360px] mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className="font-display font-bold text-lg tracking-tight text-slate-950 dark:text-white whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
          >
            <span className="w-2.5 h-2.5 rounded-xs bg-cyan-500 inline-block" />
            CLAIMBACK
          </button>

          {/* Zone 2: Desktop Navigation */}
          <nav
            aria-label="Primary Workspace Navigation"
            className="hidden md:flex items-center gap-6 h-full"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    if (item.id !== 'recovery') setRecoveryPurchaseFilterId('');
                  }}
                  className={`relative h-full inline-flex items-center text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    isActive
                      ? 'text-slate-950 dark:text-white font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <motion.span
                      layoutId="activeNavUnderline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500"
                    />
                  )}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setBackupModalOpen(true)}
              className="h-full inline-flex items-center text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 whitespace-nowrap transition-colors cursor-pointer"
            >
              Backups
            </button>
          </nav>

          {/* Zone 3: Single Primary Action + Mobile Menu Trigger */}
          <div className="flex items-center gap-2.5 shrink-0">
            {activeTab === 'recovery' ? (
              <button
                type="button"
                onClick={() => {
                  setEditingClaim(null);
                  setClaimModalPurchaseId('');
                  setClaimModalSuggestedType('refund');
                  setClaimModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                New Claim
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingPurchase(null);
                  setPurchasePrefill(null);
                  setPurchaseModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Purchase
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 rounded-lg border border-slate-200 dark:border-[#293B5C] text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              {mobileNavOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileNavOpen && (
          <div className="md:hidden bg-white dark:bg-[#0E1626] border-b border-slate-200 dark:border-[#1F2D47] px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileNavOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                  activeTab === item.id
                    ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-semibold'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                setBackupModalOpen(true);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Backups &amp; Privacy
            </button>
          </div>
        )}
      </header>

      {/* Main Dynamic Workspace */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Dynamic Workspace Controls Bar: Currency (INR ₹ + Global), Dynamic Type Scale, Light/Dark Theme */}
        <div
          aria-label="Dynamic Workspace Preferences"
          className="bg-white dark:bg-[#121A2D] border border-slate-200 dark:border-[#1F2D47] rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
        >
          {/* Currency Selector */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
              <Coins className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <label htmlFor="workspace-currency-select">Display Currency:</label>
            </div>
            <select
              id="workspace-currency-select"
              value={displayCurrency}
              onChange={(e) => {
                const next = e.target.value as CurrencyCode;
                setDisplayCurrency(next);
                notify(`Switched workspace display currency to ${next}.`);
              }}
              className="px-2.5 py-1.5 min-h-[34px] rounded-lg bg-slate-50 dark:bg-[#0E1626] border border-slate-200 dark:border-[#293B5C] font-mono font-semibold text-slate-900 dark:text-slate-100 cursor-pointer focus:border-cyan-500 focus:outline-none"
            >
              {CURRENCY_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>

            {displayCurrency !== 'INR' && (
              <button
                type="button"
                onClick={() => {
                  setDisplayCurrency('INR');
                  notify('Switched display currency to INR (₹).');
                }}
                className="px-2.5 py-1 min-h-[30px] rounded-md bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/25 font-mono font-semibold cursor-pointer"
              >
                INR (₹)
              </button>
            )}
          </div>

          {/* Dynamic Typography Scale + Theme Switch */}
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-[#0E1626] border border-slate-200/80 dark:border-[#1F2D47]"
              role="group"
              aria-label="Dynamic typography scale"
            >
              <span className="pl-2 pr-1 text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                <Type className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Text</span>
              </span>
              {(
                [
                  ['compact', 'A-'],
                  ['standard', 'A'],
                  ['large', 'A+'],
                ] as const
              ).map(([scaleKey, label]) => (
                <button
                  key={scaleKey}
                  type="button"
                  onClick={() => setTypeScale(scaleKey)}
                  aria-pressed={typeScale === scaleKey}
                  className={`px-2.5 py-1 rounded-md font-mono font-semibold transition-colors cursor-pointer ${
                    typeScale === scaleKey
                      ? 'bg-white dark:bg-[#1C2A45] text-slate-900 dark:text-slate-50 shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
              }
              aria-label="Toggle color theme"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#0E1626] dark:hover:bg-[#19253D] border border-slate-200/80 dark:border-[#1F2D47] font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-700" />
                  <span>Dark</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Animated View Transitions */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
          >
            {activeTab === 'overview' && (
              <OverviewSection
                purchases={workspace.purchases}
                deadlines={derivedDeadlines}
                claims={workspace.claims}
                displayCurrency={displayCurrency}
                onNavigate={(tab) => setActiveTab(tab)}
                onOpenNewPurchase={(prefill) => {
                  setEditingPurchase(null);
                  setPurchasePrefill(prefill || null);
                  setPurchaseModalOpen(true);
                }}
                onQuickCreateSimulatedPurchase={handleQuickCreateSimulatedPurchase}
                onUpdateDeadlineState={handleUpdateDeadlineState}
                onStartClaimForPurchase={handleStartClaimForPurchase}
                onSelectClaimInRecovery={(claimId) => {
                  setSelectedClaimId(claimId);
                  setRecoveryPurchaseFilterId('');
                  setActiveTab('recovery');
                }}
              />
            )}

            {activeTab === 'vault' && (
              <VaultSection
                purchases={workspace.purchases}
                claims={workspace.claims}
                deadlineMeta={workspace.deadlineMeta}
                displayCurrency={displayCurrency}
                highlightedPurchaseId={highlightedPurchaseId}
                onAddPurchase={() => {
                  setEditingPurchase(null);
                  setPurchasePrefill(null);
                  setPurchaseModalOpen(true);
                }}
                onEditPurchase={(p) => {
                  setEditingPurchase(p);
                  setPurchasePrefill(null);
                  setPurchaseModalOpen(true);
                }}
                onDeletePurchase={handleDeletePurchase}
                onInspectProof={(p) => setInspectProofPurchase(p)}
                onStartClaim={handleStartClaimForPurchase}
                onViewLinkedClaims={(purchaseId) => {
                  setRecoveryPurchaseFilterId(purchaseId);
                  setActiveTab('recovery');
                }}
                onRestoreSamples={handleRestoreSamples}
                onNotify={notify}
              />
            )}

            {activeTab === 'deadlines' && (
              <DeadlinesSection
                deadlines={derivedDeadlines}
                displayCurrency={displayCurrency}
                onUpdateActionState={handleUpdateDeadlineState}
                onOpenPrepModal={(d) => setPrepModalDeadline(d)}
                onOpenCustomDeadlineModal={() => setCustomDeadlineModalOpen(true)}
                onDeleteCustomDeadline={handleDeleteCustomDeadline}
                onEditPurchaseById={(purchaseId) => {
                  const found = workspace.purchases.find(
                    (p) => p.id === purchaseId
                  );
                  if (found) {
                    setEditingPurchase(found);
                    setPurchasePrefill(null);
                    setPurchaseModalOpen(true);
                  }
                }}
                onStartClaimForPurchase={handleStartClaimForPurchase}
                onOpenClaimInRecovery={(claimId) => {
                  setSelectedClaimId(claimId);
                  setRecoveryPurchaseFilterId('');
                  setActiveTab('recovery');
                }}
                onRestoreSamples={handleRestoreSamples}
                onNotify={notify}
              />
            )}

            {activeTab === 'recovery' && (
              <RecoverySection
                claims={workspace.claims}
                purchases={workspace.purchases}
                displayCurrency={displayCurrency}
                selectedClaimId={selectedClaimId}
                filterPurchaseId={recoveryPurchaseFilterId}
                onSelectClaim={(id) => setSelectedClaimId(id)}
                onClearPurchaseFilter={() => setRecoveryPurchaseFilterId('')}
                onOpenNewClaim={() => {
                  setEditingClaim(null);
                  setClaimModalPurchaseId('');
                  setClaimModalSuggestedType('refund');
                  setClaimModalOpen(true);
                }}
                onEditClaim={(c) => {
                  setEditingClaim(c);
                  setClaimModalOpen(true);
                }}
                onDeleteClaim={handleDeleteClaim}
                onUpdateClaim={handleUpdateClaimInline}
                onJumpToPurchase={(purchaseId) => {
                  setHighlightedPurchaseId(purchaseId);
                  setActiveTab('vault');
                }}
                onRestoreSamples={handleRestoreSamples}
                onNotify={notify}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Restrained Consumer Utility Footer */}
      <footer className="border-t border-slate-200 dark:border-[#1F2D47] bg-white/60 dark:bg-[#0E1626]/60 mt-12">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <p className="max-w-[74ch]">
            CLAIMBACK stores purchase and claim records locally in your browser
            (unencrypted local storage; export backups regularly). Actual return,
            warranty, and deposit eligibility is governed by seller terms.
            Correspondence templates are editable drafts, not legal advice.
          </p>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <a
              href="/claimback.html"
              className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            >
              Standalone Vault
            </a>
            <span>·</span>
            <a
              href="/deadlines.html"
              className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            >
              Standalone Radar
            </a>
            <span>·</span>
            <a
              href="/recovery-center.html"
              className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            >
              Standalone Recovery
            </a>
            <span>·</span>
            <span className="font-mono tabular-nums">{todayYMD()}</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <PurchaseModal
        open={purchaseModalOpen}
        existing={editingPurchase}
        prefill={purchasePrefill}
        displayCurrency={displayCurrency}
        onClose={() => {
          setPurchaseModalOpen(false);
          setEditingPurchase(null);
          setPurchasePrefill(null);
        }}
        onSave={handleSavePurchase}
      />

      <ClaimModal
        open={claimModalOpen}
        existing={editingClaim}
        initialPurchaseId={claimModalPurchaseId}
        initialClaimType={claimModalSuggestedType}
        purchases={workspace.purchases}
        displayCurrency={displayCurrency}
        onClose={() => {
          setClaimModalOpen(false);
          setEditingClaim(null);
        }}
        onSave={handleSaveClaim}
      />

      <PrepDateModal
        open={Boolean(prepModalDeadline)}
        deadline={prepModalDeadline}
        onClose={() => setPrepModalDeadline(null)}
        onSave={handleSavePrepDate}
      />

      <CustomDeadlineModal
        open={customDeadlineModalOpen}
        displayCurrency={displayCurrency}
        onClose={() => setCustomDeadlineModalOpen(false)}
        onSave={handleSaveCustomDeadline}
      />

      <ProofInspectorModal
        purchase={inspectProofPurchase}
        onClose={() => setInspectProofPurchase(null)}
      />

      <BackupPrivacyModal
        open={backupModalOpen}
        workspace={workspace}
        onClose={() => setBackupModalOpen(false)}
        onImportWorkspace={(next) => setWorkspace(next)}
        onRestoreSamples={handleRestoreSamples}
        onClearAllData={handleClearAllData}
        onNotify={notify}
      />

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        onCancel={() => setConfirmState((s) => ({ ...s, open: false }))}
        onConfirm={confirmState.onConfirm}
      />

      {/* Toast Notification Stack */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.16 }}
              className="pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 dark:bg-[#18253F] border border-slate-700 dark:border-cyan-500/40 text-white text-xs font-medium shadow-xl"
            >
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="flex-1">{toast.text}</span>
              <button
                type="button"
                onClick={() =>
                  setToasts((prev) => prev.filter((t) => t.id !== toast.id))
                }
                aria-label="Dismiss notification"
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
