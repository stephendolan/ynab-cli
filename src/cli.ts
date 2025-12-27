#!/usr/bin/env bun

import { Command } from 'commander';
import { setOutputOptions } from './lib/output.js';
import { createAuthCommand } from './commands/auth.js';
import { createUserCommand } from './commands/user.js';
import { createBudgetsCommand } from './commands/budgets.js';
import { createAccountsCommand } from './commands/accounts.js';
import { createCategoriesCommand } from './commands/categories.js';
import { createTransactionsCommand } from './commands/transactions.js';
import { createScheduledCommand } from './commands/scheduled.js';
import { createPayeesCommand } from './commands/payees.js';
import { createMonthsCommand } from './commands/months.js';
import { createApiCommand } from './commands/api.js';

declare const __VERSION__: string;

const program = new Command();

program
  .name('ynab')
  .description('A command-line interface for You Need a Budget (YNAB)')
  .version(__VERSION__)
  .option('-c, --compact', 'Minified JSON output (single line)')
  .hook('preAction', (thisCommand) => {
    const options = thisCommand.opts();
    setOutputOptions({
      compact: options.compact,
    });
  });

program.addCommand(createAuthCommand());
program.addCommand(createUserCommand());
program.addCommand(createBudgetsCommand());
program.addCommand(createAccountsCommand());
program.addCommand(createCategoriesCommand());
program.addCommand(createTransactionsCommand());
program.addCommand(createScheduledCommand());
program.addCommand(createPayeesCommand());
program.addCommand(createMonthsCommand());
program.addCommand(createApiCommand());

program.parse();
