import { Command } from 'commander';
import { client } from '../lib/api-client.js';
import { outputJson } from '../lib/output.js';
import { withErrorHandling } from '../lib/command-utils.js';
import { parseDate } from '../lib/dates.js';
import type { CommandOptions } from '../types/index.js';

export function createMonthsCommand(): Command {
  const cmd = new Command('months').description('Monthly budget operations');

  cmd
    .command('list')
    .description('List all budget months')
    .option('-b, --budget <id>', 'Budget ID')
    .option('--last-knowledge <number>', 'Last knowledge of server', parseInt)
    .action(
      withErrorHandling(
        async (options: { budget?: string; lastKnowledge?: number } & CommandOptions) => {
          const result = await client.getBudgetMonths(options.budget, options.lastKnowledge);
          outputJson(result?.months);
        }
      )
    );

  cmd
    .command('view')
    .description('View specific month details')
    .argument('<month>', 'Budget month (e.g., 2025-07-01)')
    .option('-b, --budget <id>', 'Budget ID')
    .action(
      withErrorHandling(async (month: string, options: CommandOptions) => {
        const monthData = await client.getBudgetMonth(parseDate(month), options.budget);
        outputJson(monthData);
      })
    );

  return cmd;
}
