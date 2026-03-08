import { Command } from 'commander';
import { client } from '../lib/api-client.js';
import { outputJson } from '../lib/output.js';
import { YnabCliError } from '../lib/errors.js';
import dayjs from 'dayjs';
import {
  amountToMilliunits,
  applyTransactionFilters,
  applyFieldSelection,
  summarizeTransactions,
  findTransferCandidates,
  type TransactionLike,
  type SummaryTransaction,
} from '../lib/utils.js';
import { withErrorHandling, requireConfirmation, buildUpdateObject } from '../lib/command-utils.js';
import { validateTransactionSplits, validateBatchUpdates } from '../lib/schemas.js';
import { parseDate, todayDate } from '../lib/dates.js';
import type { CommandOptions } from '../types/index.js';

async function fetchTransactions(options: {
  budget?: string;
  account?: string;
  category?: string;
  payee?: string;
  since?: string;
  type?: string;
  lastKnowledge?: number;
}) {
  const params = {
    budgetId: options.budget,
    sinceDate: options.since ? parseDate(options.since) : undefined,
    type: options.type,
    lastKnowledgeOfServer: options.lastKnowledge,
  };

  if (options.account) return client.getTransactionsByAccount(options.account, params);
  if (options.category) return client.getTransactionsByCategory(options.category, params);
  if (options.payee) return client.getTransactionsByPayee(options.payee, params);
  return client.getTransactions(params);
}

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
    .option('--last-knowledge <number>', 'Last server knowledge for delta requests. When used, output includes server_knowledge.', parseInt)
    .option('--limit <number>', 'Maximum number of transactions to return', parseInt)
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
            lastKnowledge?: number;
            limit?: number;
          } & CommandOptions
        ) => {
          const result = await fetchTransactions(options);
          const transactions = result?.transactions || [];

          let filtered = applyTransactionFilters(transactions as TransactionLike[], {
            until: options.until ? parseDate(options.until) : undefined,
            approved: options.approved,
            status: options.status,
            minAmount: options.minAmount,
            maxAmount: options.maxAmount,
          });

          if (options.limit && options.limit > 0) {
            filtered = filtered.slice(0, options.limit);
          }

          const selected = applyFieldSelection(filtered, options.fields);

          if (options.lastKnowledge !== undefined) {
            outputJson({ transactions: selected, server_knowledge: result?.server_knowledge });
          } else {
            outputJson(selected);
          }
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
    .command('batch-update')
    .description(
      'Update multiple transactions in a single API call. Amounts should be in dollars (e.g., -21.40).'
    )
    .requiredOption(
      '--transactions <json>',
      'JSON array of transaction updates. Each must have "id" or "import_id". Example: [{"id": "tx1", "approved": true, "category_id": "cat1"}]'
    )
    .option('-b, --budget <id>', 'Budget ID')
    .action(
      withErrorHandling(
        async (options: { transactions: string; budget?: string } & CommandOptions) => {
          let parsed;
          try {
            parsed = JSON.parse(options.transactions);
          } catch {
            throw new YnabCliError('Invalid JSON in --transactions parameter', 400);
          }

          const updates = validateBatchUpdates(parsed);

          const transactionsInMilliunits = updates.map((update) => ({
            ...update,
            ...(update.amount !== undefined
              ? { amount: amountToMilliunits(update.amount) }
              : {}),
          }));

          const result = await client.updateTransactions(
            { transactions: transactionsInMilliunits as Parameters<typeof client.updateTransactions>[0]['transactions'] },
            options.budget
          );
          outputJson(result);
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

  cmd
    .command('summary')
    .description('Summarize transactions with aggregate counts by payee, category, and status')
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
      'Filter by cleared status: cleared, uncleared, reconciled (comma-separated)'
    )
    .option('--min-amount <amount>', 'Minimum amount in currency units', parseFloat)
    .option('--max-amount <amount>', 'Maximum amount in currency units', parseFloat)
    .option('--top <number>', 'Limit payee/category breakdowns to top N entries', parseInt)
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
            top?: number;
          } & CommandOptions
        ) => {
          const result = await fetchTransactions(options);
          const transactions = result?.transactions || [];

          const filtered = applyTransactionFilters(transactions as TransactionLike[], {
            until: options.until ? parseDate(options.until) : undefined,
            approved: options.approved,
            status: options.status,
            minAmount: options.minAmount,
            maxAmount: options.maxAmount,
          });

          const summary = summarizeTransactions(
            filtered as SummaryTransaction[],
            options.top ? { top: options.top } : undefined
          );
          outputJson(summary);
        }
      )
    );

  cmd
    .command('find-transfers')
    .description('Find candidate transfer matches for a transaction across accounts')
    .argument('<id>', 'Transaction ID')
    .option('-b, --budget <id>', 'Budget ID')
    .option('--days <number>', 'Maximum date difference in days (default: 3)', parseInt)
    .option('--since <date>', 'Search transactions since date (defaults to source date minus --days)')
    .action(
      withErrorHandling(
        async (
          id: string,
          options: {
            budget?: string;
            days?: number;
            since?: string;
          } & CommandOptions
        ) => {
          const maxDays = options.days ?? 3;
          const source = await client.getTransaction(id, options.budget);

          const sinceDate = options.since
            ? parseDate(options.since)
            : dayjs(source.date).subtract(maxDays, 'day').format('YYYY-MM-DD');

          const result = await client.getTransactions({
            budgetId: options.budget,
            sinceDate,
          });

          const allTransactions = result?.transactions || [];
          const candidates = findTransferCandidates(
            source as SummaryTransaction,
            allTransactions as SummaryTransaction[],
            { maxDays }
          );

          outputJson({ source, candidates });
        }
      )
    );

  return cmd;
}
