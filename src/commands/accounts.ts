import { Command } from 'commander';
import { client } from '../lib/api-client.js';
import { outputJson } from '../lib/output.js';
import { withErrorHandling } from '../lib/command-utils.js';
import { parseDate } from '../lib/dates.js';
import type { CommandOptions } from '../types/index.js';

export function createAccountsCommand(): Command {
  const cmd = new Command('accounts').description('Account operations');

  cmd
    .command('list')
    .description('List all accounts')
    .option('-b, --budget <id>', 'Budget ID')
    .action(
      withErrorHandling(async (options: CommandOptions) => {
        const result = await client.getAccounts(options.budget);
        outputJson(result?.accounts);
      })
    );

  cmd
    .command('view')
    .description('View account details')
    .argument('<id>', 'Account ID')
    .option('-b, --budget <id>', 'Budget ID')
    .action(
      withErrorHandling(async (id: string, options: CommandOptions) => {
        const account = await client.getAccount(id, options.budget);
        outputJson(account);
      })
    );

  cmd
    .command('transactions')
    .description('List transactions for account')
    .argument('<id>', 'Account ID')
    .option('-b, --budget <id>', 'Budget ID')
    .option('--since <date>', 'Filter transactions since date')
    .option('--type <type>', 'Filter by transaction type')
    .action(
      withErrorHandling(
        async (
          id: string,
          options: {
            budget?: string;
            since?: string;
            type?: string;
          } & CommandOptions
        ) => {
          const result = await client.getTransactionsByAccount(id, {
            budgetId: options.budget,
            sinceDate: options.since ? parseDate(options.since) : undefined,
            type: options.type,
          });
          outputJson(result?.transactions);
        }
      )
    );

  return cmd;
}
