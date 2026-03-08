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

export interface BatchTransactionUpdate {
  id?: string | null;
  import_id?: string | null;
  account_id?: string;
  date?: string;
  amount?: number;
  payee_id?: string | null;
  payee_name?: string | null;
  category_id?: string | null;
  memo?: string | null;
  cleared?: string;
  approved?: boolean;
  flag_color?: string | null;
}

const BATCH_UPDATE_FIELDS: (keyof BatchTransactionUpdate)[] = [
  'id', 'import_id', 'account_id', 'date', 'amount',
  'payee_id', 'payee_name', 'category_id', 'memo',
  'cleared', 'approved', 'flag_color',
];

export function validateBatchUpdates(data: unknown): BatchTransactionUpdate[] {
  if (!Array.isArray(data)) {
    throw new YnabCliError('Batch updates must be an array', 400);
  }

  return data.map((item, index) => {
    if (typeof item !== 'object' || item === null) {
      throw new YnabCliError(`Update at index ${index} must be an object`, 400);
    }

    const update = item as Record<string, unknown>;

    if (!update.id && !update.import_id) {
      throw new YnabCliError(
        `Update at index ${index} must have either "id" or "import_id"`,
        400
      );
    }

    const result: Record<string, unknown> = {};
    for (const field of BATCH_UPDATE_FIELDS) {
      if (update[field] !== undefined) {
        result[field] = update[field];
      }
    }
    return result as BatchTransactionUpdate;
  });
}

export function validateApiData(data: unknown): Record<string, unknown> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new YnabCliError('API data must be an object', 400);
  }
  return data as Record<string, unknown>;
}
