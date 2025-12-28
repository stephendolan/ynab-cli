import { Command } from 'commander';
import { client } from '../lib/api-client.js';
import { outputJson } from '../lib/output.js';
import { YnabCliError } from '../lib/errors.js';
import {
  amountToMilliunits,
  applyTransactionFilters,
  applyFieldSelection,
  type TransactionLike,
} from '../lib/utils.js';
import { withErrorHandling, requireConfirmation, buildUpdateObject } from '../lib/command-utils.js';
import { validateTransactionSplits } from '../lib/schemas.js';
import { parseDate, todayDate } from '../lib/dates.js';
import type { CommandOptions } from '../types/index.js';

interface TransactionOptions {
  account?: string;
  date?: string;
  amount?: number;
  payeeName?: string;
  payeeId?: string;
  categoryId?: string;
  memo?: string;
  cleared?: string;
  approved?: boolean;
}

function buildTransactionData(options: TransactionOptions): Record<string, unknown> {
  if (!options.account) {
    throw new YnabCliError('--account is required in non-interactive mode', 400);
  }
  if (options.amount === undefined) {
    throw new YnabCliError('--amount is required in non-interactive mode', 400);
  }

  return {
    account_id: options.account,
    date: options.date ? parseDate(options.date) : todayDate(),
    amount: amountToMilliunits(options.amount),
    payee_name: options.payeeName,
    payee_id: options.payeeId,
    category_id: options.categoryId,
    memo: options.memo,
    cleared: options.cleared,
    approved: options.approved,
  };
}

export function createTransactionsCommand(): Command {
  const cmd = new Command('transactions').description('Transaction operations');

  cmd
    .command('list')
    .description('List transactions')
    .option('-b, --budget <id>', 'Budget ID')
    .option('--account <id>', 'Filter by account ID')
    .option('--category <id>', 'Filter by category ID')
    .option('--payee <id>', 'Filter by payee ID')
    .option('--since <date>', 'Filter transactions since date')
    .option('--until <date>', 'Filter transactions until date')
    .option('--type <type>', 'Filter by transaction type')
    .option('--approved <value>', 'Filter by approval status: true or false')
    .option(
      '--status <statuses>',
      'Filter by cleared status: cleared, uncleared, reconciled (comma-separated for multiple)'
    )
    .option('--min-amount <amount>', 'Minimum amount in currency units (e.g., 10.50)', parseFloat)
    .option('--max-amount <amount>', 'Maximum amount in currency units (e.g., 100.00)', parseFloat)
    .option(
      '--fields <fields>',
      'Comma-separated list of fields to include (e.g., id,date,amount,memo)'
    )
    .action(
      withErrorHandling(
        async (
          options: {
            budget?: string;
            account?: string;
            category?: string;
            payee?: string;
            since?: string;
            until?: string;
            type?: string;
            approved?: string;
            status?: string;
            minAmount?: number;
            maxAmount?: number;
            fields?: string;
          } & CommandOptions
        ) => {
          const params = {
            budgetId: options.budget,
            sinceDate: options.since ? parseDate(options.since) : undefined,
            type: options.type,
          };

          const result = options.account
            ? await client.getTransactionsByAccount(options.account, params)
            : options.category
              ? await client.getTransactionsByCategory(options.category, params)
              : options.payee
                ? await client.getTransactionsByPayee(options.payee, params)
                : await client.getTransactions(params);

          const transactions = result?.transactions || [];

          const filtered = applyTransactionFilters(transactions as TransactionLike[], {
            until: options.until ? parseDate(options.until) : undefined,
            approved: options.approved,
            status: options.status,
            minAmount: options.minAmount,
            maxAmount: options.maxAmount,
          });

          const selected = applyFieldSelection(filtered, options.fields);

          outputJson(selected);
        }
      )
    );

  cmd
    .command('view')
    .description('View single transaction')
    .argument('<id>', 'Transaction ID')
    .option('-b, --budget <id>', 'Budget ID')
    .action(
      withErrorHandling(async (id: string, options: CommandOptions) => {
        const transaction = await client.getTransaction(id, options.budget);
        outputJson(transaction);
      })
    );

  cmd
    .command('create')
    .description('Create transaction')
    .option('-b, --budget <id>', 'Budget ID')
    .option('--account <id>', 'Account ID')
    .option('--date <date>', 'Transaction date')
    .option('--amount <amount>', 'Amount in currency units (e.g., 10.50)', parseFloat)
    .option('--payee-name <name>', 'Payee name')
    .option('--payee-id <id>', 'Payee ID')
    .option('--category-id <id>', 'Category ID')
    .option('--memo <memo>', 'Memo')
    .option('--cleared <status>', 'Cleared status (cleared, uncleared, reconciled)')
    .option('--approved', 'Mark as approved')
    .action(
      withErrorHandling(
        async (
          options: {
            budget?: string;
            account?: string;
            date?: string;
            amount?: number;
            payeeName?: string;
            payeeId?: string;
            categoryId?: string;
            memo?: string;
            cleared?: string;
            approved?: boolean;
          } & CommandOptions
        ) => {
          const transactionData = buildTransactionData(options);
          const transaction = await client.createTransaction(
            { transaction: transactionData },
            options.budget
          );
          outputJson(transaction);
        }
      )
    );

  cmd
    .command('update')
    .description('Update transaction')
    .argument('<id>', 'Transaction ID')
    .option('-b, --budget <id>', 'Budget ID')
    .option('--account <id>', 'Account ID')
    .option('--date <date>', 'Transaction date')
    .option('--amount <amount>', 'Amount in currency units', parseFloat)
    .option('--payee-name <name>', 'Payee name')
    .option('--payee-id <id>', 'Payee ID')
    .option('--category-id <id>', 'Category ID')
    .option('--memo <memo>', 'Memo')
    .option('--cleared <status>', 'Cleared status')
    .option('--approved', 'Mark as approved')
    .action(
      withErrorHandling(
        async (id: string, options: TransactionOptions & { budget?: string } & CommandOptions) => {
          const transactionData = buildUpdateObject(options, {
            account: 'account_id',
            date: 'date',
            payeeName: 'payee_name',
            payeeId: 'payee_id',
            categoryId: 'category_id',
            memo: 'memo',
            cleared: 'cleared',
            approved: 'approved',
          });

          if (options.amount !== undefined) {
            transactionData.amount = amountToMilliunits(options.amount);
          }

          const transaction = await client.updateTransaction(
            id,
            { transaction: transactionData },
            options.budget
          );
          outputJson(transaction);
        }
      )
    );

  cmd
    .command('delete')
    .description('Delete transaction')
    .argument('<id>', 'Transaction ID')
    .option('-b, --budget <id>', 'Budget ID')
    .option('-y, --yes', 'Skip confirmation')
    .action(
      withErrorHandling(
        async (id: string, options: { budget?: string; yes?: boolean } & CommandOptions) => {
          requireConfirmation('transaction', options.yes);
          const transaction = await client.deleteTransaction(id, options.budget);
          outputJson({ message: 'Transaction deleted', transaction });
        }
      )
    );

  cmd
    .command('import')
    .description('Import transactions')
    .option('-b, --budget <id>', 'Budget ID')
    .action(
      withErrorHandling(async (options: CommandOptions) => {
        const transactionIds = await client.importTransactions(options.budget);
        outputJson({ transaction_ids: transactionIds });
      })
    );

  cmd
    .command('split')
    .description(
      'Split transaction into multiple categories. Amounts should be in dollars (e.g., 10.50).'
    )
    .argument('<id>', 'Transaction ID')
    .requiredOption(
      '--splits <json>',
      'JSON array of splits with dollar amounts: [{"amount": -21.40, "category_id": "xxx", "memo": "..."}]'
    )
    .option('-b, --budget <id>', 'Budget ID')
    .option('-f, --force', 'Force update of already-split transactions by deleting and recreating')
    .action(
      withErrorHandling(
        async (
          id: string,
          options: { splits: string; budget?: string; force?: boolean } & CommandOptions
        ) => {
          let parsedSplits;
          try {
            parsedSplits = JSON.parse(options.splits);
          } catch {
            throw new YnabCliError('Invalid JSON in --splits parameter', 400);
          }

          const splits = validateTransactionSplits(parsedSplits);

          const splitsInMilliunits = splits.map((split) => ({
            ...split,
            amount: amountToMilliunits(split.amount),
          }));

          const existingTransaction = await client.getTransaction(id, options.budget);
          const isAlreadySplit =
            existingTransaction.subtransactions && existingTransaction.subtransactions.length > 0;

          if (isAlreadySplit && !options.force) {
            throw new YnabCliError(
              'Transaction is already split. YNAB API does not support updating split transactions. ' +
                'Use --force to delete and recreate the transaction with new splits.',
              400
            );
          }

          if (isAlreadySplit) {
            await client.deleteTransaction(id, options.budget);

            const recreatedTransaction = await client.createTransaction(
              {
                transaction: {
                  account_id: existingTransaction.account_id,
                  date: existingTransaction.date,
                  amount: existingTransaction.amount,
                  payee_id: existingTransaction.payee_id,
                  payee_name: existingTransaction.payee_name,
                  category_id: null,
                  memo: existingTransaction.memo,
                  cleared: existingTransaction.cleared,
                  approved: existingTransaction.approved,
                  flag_color: existingTransaction.flag_color,
                  subtransactions: splitsInMilliunits,
                },
              },
              options.budget
            );
            outputJson(recreatedTransaction);
          } else {
            const transaction = await client.updateTransaction(
              id,
              {
                transaction: {
                  category_id: null,
                  subtransactions: splitsInMilliunits,
                },
              },
              options.budget
            );
            outputJson(transaction);
          }
        }
      )
    );

  cmd
    .command('search')
    .description('Search transactions')
    .option('-b, --budget <id>', 'Budget ID')
    .option('--memo <text>', 'Search in memo field')
    .option('--payee-name <name>', 'Search in payee name')
    .option('--amount <amount>', 'Search for exact amount in currency units', parseFloat)
    .option('--since <date>', 'Search transactions since date')
    .option('--until <date>', 'Search transactions until date')
    .option('--approved <value>', 'Filter by approval status: true or false')
    .option(
      '--status <statuses>',
      'Filter by cleared status: cleared, uncleared, reconciled (comma-separated)'
    )
    .option('--fields <fields>', 'Comma-separated list of fields to include')
    .action(
      withErrorHandling(
        async (
          options: {
            budget?: string;
            memo?: string;
            payeeName?: string;
            amount?: number;
            since?: string;
            until?: string;
            approved?: string;
            status?: string;
            fields?: string;
          } & CommandOptions
        ) => {
          if (!options.memo && !options.payeeName && options.amount === undefined) {
            throw new YnabCliError(
              'At least one search criteria required: --memo, --payee-name, or --amount',
              400
            );
          }

          const params = {
            budgetId: options.budget,
            sinceDate: options.since ? parseDate(options.since) : undefined,
          };

          const result = await client.getTransactions(params);
          let transactions = result?.transactions || [];

          if (options.memo) {
            const searchTerm = options.memo.toLowerCase();
            transactions = transactions.filter((t) => t.memo?.toLowerCase().includes(searchTerm));
          }

          if (options.payeeName) {
            const searchTerm = options.payeeName.toLowerCase();
            transactions = transactions.filter((t) =>
              t.payee_name?.toLowerCase().includes(searchTerm)
            );
          }

          if (options.amount !== undefined) {
            const amountMilliunits = amountToMilliunits(options.amount);
            transactions = transactions.filter((t) => t.amount === amountMilliunits);
          }

          transactions = applyTransactionFilters(transactions, {
            until: options.until ? parseDate(options.until) : undefined,
            approved: options.approved,
            status: options.status,
          });

          const filteredTransactions = applyFieldSelection(transactions, options.fields);

          outputJson(filteredTransactions);
        }
      )
    );

  return cmd;
}
