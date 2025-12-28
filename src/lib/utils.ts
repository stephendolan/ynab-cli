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
