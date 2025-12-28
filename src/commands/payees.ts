import { Command } from 'commander';
import { client } from '../lib/api-client.js';
import { outputJson } from '../lib/output.js';
import { YnabCliError } from '../lib/errors.js';
import { withErrorHandling } from '../lib/command-utils.js';
import { parseDate } from '../lib/dates.js';
import type { CommandOptions } from '../types/index.js';

export function createPayeesCommand(): Command {
  const cmd = new Command('payees').description('Payee operations');

  cmd
    .command('list')
    .description('List all payees')
    .option('-b, --budget <id>', 'Budget ID')
    .option('--last-knowledge <number>', 'Last knowledge of server', parseInt)
    .action(
      withErrorHandling(
        async (options: { budget?: string; lastKnowledge?: number } & CommandOptions) => {
          const result = await client.getPayees(options.budget, options.lastKnowledge);
          outputJson(result?.payees);
        }
      )
    );

  cmd
    .command('view')
    .description('View payee details')
    .argument('<id>', 'Payee ID')
    .option('-b, --budget <id>', 'Budget ID')
    .action(
      withErrorHandling(async (id: string, options: CommandOptions) => {
        const payee = await client.getPayee(id, options.budget);
        outputJson(payee);
      })
    );

  cmd
    .command('update')
    .description('Rename payee')
    .argument('<id>', 'Payee ID')
    .requiredOption('--name <name>', 'New payee name')
    .option('-b, --budget <id>', 'Budget ID')
    .action(
      withErrorHandling(
        async (id: string, options: { name: string; budget?: string } & CommandOptions) => {
          if (!options.name?.trim()) {
            throw new YnabCliError('Name cannot be empty', 400);
          }

          const payee = await client.updatePayee(
            id,
            { payee: { name: options.name } },
            options.budget
          );
          outputJson(payee);
        }
      )
    );

  cmd
    .command('locations')
    .description('List locations for payee')
    .argument('<id>', 'Payee ID')
    .option('-b, --budget <id>', 'Budget ID')
    .action(
      withErrorHandling(async (id: string, options: CommandOptions) => {
        const locations = await client.getPayeeLocationsByPayee(id, options.budget);
        outputJson(locations);
      })
    );

  cmd
    .command('transactions')
    .description('List transactions for payee')
    .argument('<id>', 'Payee ID')
    .option('-b, --budget <id>', 'Budget ID')
    .option('--since <date>', 'Filter transactions since date')
    .option('--type <type>', 'Filter by transaction type')
    .option('--last-knowledge <number>', 'Last knowledge of server', parseInt)
    .action(
      withErrorHandling(
        async (
          id: string,
          options: {
            budget?: string;
            since?: string;
            type?: string;
            lastKnowledge?: number;
          } & CommandOptions
        ) => {
          const result = await client.getTransactionsByPayee(id, {
            budgetId: options.budget,
            sinceDate: options.since ? parseDate(options.since) : undefined,
            type: options.type,
            lastKnowledgeOfServer: options.lastKnowledge,
          });
          outputJson(result?.transactions);
        }
      )
    );

  return cmd;
}
