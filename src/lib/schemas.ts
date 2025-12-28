import { YnabCliError } from './errors.js';

export interface TransactionSplit {
  amount: number;
  category_id?: string | null;
  memo?: string;
  payee_id?: string;
}

export function validateTransactionSplits(data: unknown): TransactionSplit[] {
  if (!Array.isArray(data)) {
    throw new YnabCliError('Transaction splits must be an array', 400);
  }

  return data.map((item, index) => {
    if (typeof item !== 'object' || item === null) {
      throw new YnabCliError(`Split at index ${index} must be an object`, 400);
    }

    const split = item as Record<string, unknown>;

    if (typeof split.amount !== 'number') {
      throw new YnabCliError(`Split at index ${index} must have a numeric amount`, 400);
    }

    return {
      amount: split.amount,
      category_id: split.category_id as string | null | undefined,
      memo: split.memo as string | undefined,
      payee_id: split.payee_id as string | undefined,
    };
  });
}

export function validateApiData(data: unknown): Record<string, unknown> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new YnabCliError('API data must be an object', 400);
  }
  return data as Record<string, unknown>;
}
