import { Command } from 'commander';
import { client } from '../lib/api-client.js';
import { outputJson } from '../lib/output.js';
import { YnabCliError } from '../lib/errors.js';
import { amountToMilliunits, applyFieldSelection } from '../lib/utils.js';
import { withErrorHandling } from '../lib/command-utils.js';
import { parseDate } from '../lib/dates.js';
import type { CommandOptions } from '../types/index.js';

export function createCategoriesCommand(): Command {
  const cmd = new Command('categories').description('Category operations');

  cmd
    .command('list')
    .description('List all categories')
    .option('-b, --budget <id>', 'Budget ID')
    .option('--last-knowledge <number>', 'Last knowledge of server', parseInt)
    .action(
      withErrorHandling(
        async (options: { budget?: string; lastKnowledge?: number } & CommandOptions) => {
          const result = await client.getCategories(options.budget, options.lastKnowledge);
          outputJson(result?.category_groups);
        }
      )
    );

  cmd
    .command('view')
    .description('View category details')
    .argument('<id>', 'Category ID')
    .option('-b, --budget <id>', 'Budget ID')
    .action(
      withErrorHandling(async (id: string, options: CommandOptions) => {
        const category = await client.getCategory(id, options.budget);
        outputJson(category);
      })
    );

  cmd
    .command('update')
    .description('Update category details')
    .argument('<id>', 'Category ID')
    .option('--name <name>', 'New category name')
    .option('--note <note>', 'Category note (use empty string to clear)')
    .option('--category-group-id <id>', 'Move to a different category group')
    .option('--goal-target <amount>', 'Goal target amount in dollars (ignored if category has no goal)', parseFloat)
    .option('-b, --budget <id>', 'Budget ID')
    .action(
      withErrorHandling(
        async (
          id: string,
          options: {
            name?: string;
            note?: string;
            categoryGroupId?: string;
            goalTarget?: number;
            budget?: string;
          } & CommandOptions
        ) => {
          if (options.name === undefined && options.note === undefined && options.categoryGroupId === undefined && options.goalTarget === undefined) {
            throw new YnabCliError(
              'At least one field to update must be provided (--name, --note, --category-group-id, or --goal-target)',
              400
            );
          }

          if (options.name !== undefined && options.name.trim() === '') {
            throw new YnabCliError('Category name cannot be empty or whitespace', 400);
          }

          const updateData: {
            name?: string;
            note?: string | null;
            category_group_id?: string;
            goal_target?: number | null;
          } = {};

          if (options.name !== undefined) {
            updateData.name = options.name.trim();
          }
          if (options.note !== undefined) {
            updateData.note = options.note.trim() || null;
          }
          if (options.categoryGroupId !== undefined) {
            updateData.category_group_id = options.categoryGroupId;
          }
          if (options.goalTarget !== undefined) {
            updateData.goal_target = amountToMilliunits(options.goalTarget);
          }

          const category = await client.updateCategory(id, { category: updateData }, options.budget);
          outputJson(category);
        }
      )
    );

  cmd
    .command('budget')
    .description('Set category budgeted amount for a month (overrides existing amount)')
    .argument('<id>', 'Category ID')
    .requiredOption('--month <month>', 'Budget month (e.g., 2025-07-01)')
    .requiredOption('--amount <amount>', 'Total budgeted amount to set (e.g., 100.50)', parseFloat)
    .option('-b, --budget <id>', 'Budget ID')
    .action(
      withErrorHandling(
        async (
          id: string,
          options: {
            month: string;
            amount: number;
            budget?: string;
          } & CommandOptions
        ) => {
          if (isNaN(options.amount)) {
            throw new YnabCliError('Amount must be a valid number', 400);
          }

          const milliunits = amountToMilliunits(options.amount);
          const category = await client.updateMonthCategory(
            parseDate(options.month),
            id,
            { category: { budgeted: milliunits } },
            options.budget
          );
          outputJson(category);
        }
      )
    );

  cmd
    .command('transactions')
    .description('List transactions for category')
    .argument('<id>', 'Category ID')
    .option('-b, --budget <id>', 'Budget ID')
    .option('--since <date>', 'Filter transactions since date')
    .option('--type <type>', 'Filter by transaction type')
    .option('--last-knowledge <number>', 'Last knowledge of server', parseInt)
    .option(
      '--fields <fields>',
      'Comma-separated list of fields to include (e.g., id,date,amount,memo)'
    )
    .action(
      withErrorHandling(
        async (
          id: string,
          options: {
            budget?: string;
            since?: string;
            type?: string;
            lastKnowledge?: number;
            fields?: string;
          } & CommandOptions
        ) => {
          const result = await client.getTransactionsByCategory(id, {
            budgetId: options.budget,
            sinceDate: options.since ? parseDate(options.since) : undefined,
            type: options.type,
            lastKnowledgeOfServer: options.lastKnowledge,
          });
          const transactions = result?.transactions || [];
          outputJson(applyFieldSelection(transactions, options.fields));
        }
      )
    );

  return cmd;
}
