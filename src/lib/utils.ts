import { YnabCliError } from './errors.js';

export function milliunitsToAmount(milliunits: number): number {
  return milliunits / 1000;
}

export function amountToMilliunits(amount: number): number {
  return Math.round(amount * 1000);
}

export function convertMilliunitsToAmounts(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) return data.map(convertMilliunitsToAmounts);
  if (typeof data !== 'object') return data;

  const converted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (isAmountField(key) && typeof value === 'number') {
      converted[key] = milliunitsToAmount(value);
    } else if (
      isDebtAmountMapField(key) &&
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      const convertedMap: Record<string, unknown> = {};
      for (const [dateKey, amountValue] of Object.entries(value)) {
        convertedMap[dateKey] =
          typeof amountValue === 'number' ? milliunitsToAmount(amountValue) : amountValue;
      }
      converted[key] = convertedMap;
    } else {
      converted[key] = convertMilliunitsToAmounts(value);
    }
  }
  return converted;
}

function isAmountField(fieldName: string): boolean {
  const amountFields = [
    'amount',
    'balance',
    'cleared_balance',
    'uncleared_balance',
    'budgeted',
    'activity',
    'available',
    'goal_target',
    'goal_under_funded',
    'goal_overall_funded',
    'goal_overall_left',
    'income',
    'to_be_budgeted',
    'debt_original_balance',
  ];

  return amountFields.includes(fieldName) || fieldName.endsWith('_amount');
}

function isDebtAmountMapField(fieldName: string): boolean {
  const debtAmountMapFields = [
    'debt_minimum_payments',
    'debt_escrow_amounts',
    'debt_interest_rates',
  ];

  return debtAmountMapFields.includes(fieldName);
}

export function parseApprovedFilter(value: string): boolean {
  const normalized = value.toLowerCase();
  if (normalized !== 'true' && normalized !== 'false') {
    throw new YnabCliError(`--approved must be 'true' or 'false', got '${value}'`, 400);
  }
  return normalized === 'true';
}

export function parseStatusFilter(value: string): string[] {
  const statuses = value.split(',').map((s) => s.trim().toLowerCase());
  const validStatuses = ['cleared', 'uncleared', 'reconciled'];

  for (const status of statuses) {
    if (!validStatuses.includes(status)) {
      throw new YnabCliError(
        `Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}`,
        400
      );
    }
  }

  return statuses;
}

export type TransactionLike = {
  date: string;
  amount: number;
  approved: boolean;
  cleared: string;
};

export function applyTransactionFilters<T extends TransactionLike>(
  transactions: T[],
  filters: {
    until?: string;
    approved?: string;
    status?: string;
    minAmount?: number;
    maxAmount?: number;
  }
): T[] {
  let filtered = transactions;

  if (filters.until) {
    filtered = filtered.filter((t) => t.date <= filters.until!);
  }

  if (filters.approved !== undefined) {
    const approvedValue = parseApprovedFilter(filters.approved);
    filtered = filtered.filter((t) => t.approved === approvedValue);
  }

  if (filters.status) {
    const statuses = parseStatusFilter(filters.status);
    filtered = filtered.filter((t) => statuses.includes(t.cleared.toLowerCase()));
  }

  if (filters.minAmount !== undefined) {
    const minMilliunits = amountToMilliunits(filters.minAmount);
    filtered = filtered.filter((t) => t.amount >= minMilliunits);
  }

  if (filters.maxAmount !== undefined) {
    const maxMilliunits = amountToMilliunits(filters.maxAmount);
    filtered = filtered.filter((t) => t.amount <= maxMilliunits);
  }

  return filtered;
}

export type SummaryTransaction = TransactionLike & {
  payee_id?: string | null;
  payee_name?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  account_id: string;
  transfer_account_id?: string | null;
  transfer_transaction_id?: string | null;
};

interface BreakdownEntry {
  count: number;
  total_amount: number;
}

export function summarizeTransactions(
  transactions: SummaryTransaction[],
  options?: { top?: number }
) {
  let totalAmount = 0;
  const dates: string[] = [];
  const byPayee = new Map<string, { payee_id: string | null; payee_name: string | null } & BreakdownEntry>();
  const byCategory = new Map<string, { category_id: string | null; category_name: string | null } & BreakdownEntry>();
  const byCleared = new Map<string, BreakdownEntry>();
  const byApproval = new Map<string, BreakdownEntry>();

  for (const t of transactions) {
    totalAmount += t.amount;
    dates.push(t.date);

    const payeeKey = t.payee_id || t.payee_name || '(none)';
    const payeeEntry = byPayee.get(payeeKey) || {
      payee_id: t.payee_id || null,
      payee_name: t.payee_name || null,
      count: 0,
      total_amount: 0,
    };
    payeeEntry.count++;
    payeeEntry.total_amount += t.amount;
    byPayee.set(payeeKey, payeeEntry);

    const catKey = t.category_id || t.category_name || '(uncategorized)';
    const catEntry = byCategory.get(catKey) || {
      category_id: t.category_id || null,
      category_name: t.category_name || null,
      count: 0,
      total_amount: 0,
    };
    catEntry.count++;
    catEntry.total_amount += t.amount;
    byCategory.set(catKey, catEntry);

    const clearedEntry = byCleared.get(t.cleared) || { count: 0, total_amount: 0 };
    clearedEntry.count++;
    clearedEntry.total_amount += t.amount;
    byCleared.set(t.cleared, clearedEntry);

    const approvalKey = String(t.approved);
    const approvalEntry = byApproval.get(approvalKey) || { count: 0, total_amount: 0 };
    approvalEntry.count++;
    approvalEntry.total_amount += t.amount;
    byApproval.set(approvalKey, approvalEntry);
  }

  const sortByAbsAmount = <T extends BreakdownEntry>(entries: T[]): T[] =>
    entries.sort((a, b) => Math.abs(b.total_amount) - Math.abs(a.total_amount));

  const truncate = <T extends BreakdownEntry>(entries: T[], rollupFactory: (entry: BreakdownEntry) => T): T[] => {
    const top = options?.top;
    if (!top || top <= 0 || entries.length <= top) return entries;
    const kept = entries.slice(0, top);
    const rest = entries.slice(top);
    const rollup = rollupFactory({
      count: rest.reduce((sum, e) => sum + e.count, 0),
      total_amount: rest.reduce((sum, e) => sum + e.total_amount, 0),
    });
    return [...kept, rollup];
  };

  const payeeBreakdown = sortByAbsAmount([...byPayee.values()]);
  const categoryBreakdown = sortByAbsAmount([...byCategory.values()]);

  return {
    total_count: transactions.length,
    total_amount: totalAmount,
    date_range: dates.length > 0
      ? {
          from: dates.reduce((a, b) => (a < b ? a : b)),
          to: dates.reduce((a, b) => (a > b ? a : b)),
        }
      : null,
    by_payee: truncate(payeeBreakdown, (e) => ({ payee_id: null, payee_name: '(other)', ...e })),
    by_category: truncate(categoryBreakdown, (e) => ({ category_id: null, category_name: '(other)', ...e })),
    by_cleared_status: [...byCleared.entries()].map(([status, entry]) => ({ status, ...entry })),
    by_approval_status: [...byApproval.entries()].map(([approved, entry]) => ({ approved: approved === 'true', ...entry })),
  };
}

export function findTransferCandidates(
  source: SummaryTransaction,
  allTransactions: SummaryTransaction[],
  options: { maxDays: number }
) {
  const sourceAmount = Math.abs(source.amount);
  const sourceDateMs = new Date(source.date).getTime();
  const msPerDay = 86400000;

  function daysBetween(t: SummaryTransaction): number {
    return Math.abs(new Date(t.date).getTime() - sourceDateMs) / msPerDay;
  }

  return allTransactions
    .filter((t) => {
      if (t.account_id === source.account_id) return false;
      if (Math.abs(t.amount) !== sourceAmount) return false;
      if (Math.sign(t.amount) === Math.sign(source.amount)) return false;
      return daysBetween(t) <= options.maxDays;
    })
    .map((t) => ({
      transaction: t,
      already_linked: !!t.transfer_transaction_id,
      date_difference_days: Math.round(daysBetween(t)),
      has_transfer_payee: !!t.payee_name?.startsWith('Transfer :'),
    }))
    .sort((a, b) => a.date_difference_days - b.date_difference_days);
}

export function applyFieldSelection<T>(items: T[], fields?: string): Partial<T>[] {
  if (!fields) return items;

  const fieldList = fields.split(',').map((f) => f.trim());
  return items.map((item) => {
    const filtered: Partial<T> = {};
    const itemRecord = item as Record<string, unknown>;
    for (const field of fieldList) {
      if (field in itemRecord) {
        (filtered as Record<string, unknown>)[field] = itemRecord[field];
      }
    }
    return filtered;
  });
}
