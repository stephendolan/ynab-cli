import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { client } from '../lib/api-client.js';
import { auth } from '../lib/auth.js';
import { amountToMilliunits, applyFieldSelection, applyTransactionFilters, convertMilliunitsToAmounts, summarizeTransactions, findTransferCandidates, type SummaryTransaction, type TransactionLike } from '../lib/utils.js';

const toolRegistry = [
  { name: 'list_budgets', description: 'List all budgets in the YNAB account' },
  { name: 'get_budget', description: 'Get detailed information about a specific budget' },
  { name: 'get_budget_settings', description: 'Get budget settings (date format, currency format, etc.)' },
  { name: 'list_accounts', description: 'List all accounts in a budget' },
  { name: 'get_account', description: 'Get detailed information about a specific account' },
  { name: 'list_categories', description: 'List all category groups and categories in a budget' },
  { name: 'get_category', description: 'Get detailed information about a specific category' },
  { name: 'update_category', description: 'Update category name, note, group, or goal target' },
  { name: 'update_month_category', description: 'Set the budgeted amount for a category in a specific month' },
  { name: 'list_transactions', description: 'List transactions with optional filtering' },
  { name: 'get_transaction', description: 'Get detailed information about a specific transaction' },
  { name: 'create_transaction', description: 'Create a new transaction' },
  { name: 'update_transaction', description: 'Update an existing transaction' },
  { name: 'delete_transaction', description: 'Delete a transaction' },
  { name: 'import_transactions', description: 'Trigger import of linked bank transactions' },
  { name: 'batch_update_transactions', description: 'Update multiple transactions in a single API call' },
  { name: 'summarize_transactions', description: 'Get aggregate summary of transactions by payee, category, and status' },
  { name: 'find_transfer_candidates', description: 'Find candidate transfer matches for a transaction across accounts' },
  { name: 'list_transactions_by_account', description: 'List transactions for a specific account' },
  { name: 'list_transactions_by_category', description: 'List transactions for a specific category' },
  { name: 'list_transactions_by_payee', description: 'List transactions for a specific payee' },
  { name: 'list_payees', description: 'List all payees in a budget' },
  { name: 'update_payee', description: 'Rename a payee' },
  { name: 'list_payee_locations', description: 'List locations for a specific payee' },
  { name: 'list_budget_months', description: 'List all budget months' },
  { name: 'get_budget_month', description: 'Get budget details for a specific month' },
  { name: 'list_scheduled_transactions', description: 'List all scheduled transactions in a budget' },
  { name: 'get_scheduled_transaction', description: 'Get a single scheduled transaction' },
  { name: 'delete_scheduled_transaction', description: 'Delete a scheduled transaction' },
  { name: 'raw_api_call', description: 'Make a direct YNAB API call' },
  { name: 'get_user', description: 'Get information about the authenticated user' },
  { name: 'check_auth', description: 'Check if YNAB authentication is configured' },
];

const server = new McpServer({
  name: 'ynab',
  version: '1.0.0',
});

function jsonResponse(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function currencyResponse(data: unknown) {
  return jsonResponse(convertMilliunitsToAmounts(data));
}

server.tool(
  'list_budgets',
  'List all budgets in the YNAB account',
  { includeAccounts: z.boolean().optional().describe('Include account details') },
  async ({ includeAccounts }) => currencyResponse(await client.getBudgets(includeAccounts))
);

server.tool(
  'get_budget',
  'Get detailed information about a specific budget',
  { budgetId: z.string().optional().describe('Budget ID (uses default if not specified)') },
  async ({ budgetId }) => currencyResponse(await client.getBudget(budgetId))
);

server.tool(
  'get_budget_settings',
  'Get budget settings (date format, currency format, etc.)',
  { budgetId: z.string().optional().describe('Budget ID (uses default if not specified)') },
  async ({ budgetId }) => jsonResponse(await client.getBudgetSettings(budgetId))
);

server.tool(
  'list_accounts',
  'List all accounts in a budget',
  { budgetId: z.string().optional().describe('Budget ID (uses default if not specified)') },
  async ({ budgetId }) => currencyResponse(await client.getAccounts(budgetId))
);

server.tool(
  'get_account',
  'Get detailed information about a specific account',
  {
    accountId: z.string().describe('Account ID'),
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
  },
  async ({ accountId, budgetId }) => currencyResponse(await client.getAccount(accountId, budgetId))
);

server.tool(
  'list_categories',
  'List all category groups and categories in a budget',
  { budgetId: z.string().optional().describe('Budget ID (uses default if not specified)') },
  async ({ budgetId }) => currencyResponse(await client.getCategories(budgetId))
);

server.tool(
  'get_category',
  'Get detailed information about a specific category',
  {
    categoryId: z.string().describe('Category ID'),
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
  },
  async ({ categoryId, budgetId }) => currencyResponse(await client.getCategory(categoryId, budgetId))
);

server.tool(
  'update_category',
  'Update category name, note, group, or goal target',
  {
    categoryId: z.string().describe('Category ID'),
    name: z.string().optional().describe('New category name'),
    note: z.string().optional().describe('Category note (use empty string to clear)'),
    categoryGroupId: z.string().optional().describe('Move to a different category group'),
    goalTarget: z.number().optional().describe('Goal target amount in dollars (ignored if category has no goal)'),
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
  },
  async ({ categoryId, name, note, categoryGroupId, goalTarget, budgetId }) => {
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (note !== undefined) updateData.note = note.trim() || null;
    if (categoryGroupId !== undefined) updateData.category_group_id = categoryGroupId;
    if (goalTarget !== undefined) updateData.goal_target = amountToMilliunits(goalTarget);
    return currencyResponse(await client.updateCategory(categoryId, { category: updateData }, budgetId));
  }
);

server.tool(
  'update_month_category',
  'Set the budgeted amount for a category in a specific month',
  {
    categoryId: z.string().describe('Category ID'),
    month: z.string().describe('Budget month (YYYY-MM-DD, day is ignored)'),
    budgeted: z.number().describe('Budgeted amount in dollars'),
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
  },
  async ({ categoryId, month, budgeted, budgetId }) =>
    currencyResponse(
      await client.updateMonthCategory(month, categoryId, { category: { budgeted: amountToMilliunits(budgeted) } }, budgetId)
    )
);

server.tool(
  'list_transactions',
  'List transactions with optional filtering',
  {
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
    sinceDate: z.string().optional().describe('Only return transactions on or after this date (YYYY-MM-DD)'),
    type: z.enum(['uncategorized', 'unapproved']).optional().describe('Filter by transaction type'),
    lastKnowledgeOfServer: z.number().optional().describe('Delta sync: only return changes since this server knowledge value. Response includes server_knowledge for next call.'),
    limit: z.number().optional().describe('Maximum number of transactions to return'),
    fields: z.string().optional().describe('Comma-separated list of fields to include (e.g., id,date,amount,memo)'),
  },
  async ({ budgetId, sinceDate, type, lastKnowledgeOfServer, limit, fields }) => {
    const result = await client.getTransactions({ budgetId, sinceDate, type, lastKnowledgeOfServer });
    let transactions = result?.transactions || [];
    if (limit && limit > 0) transactions = transactions.slice(0, limit);
    const selected = fields ? applyFieldSelection(transactions, fields) : transactions;
    return currencyResponse({ transactions: selected, server_knowledge: result?.server_knowledge });
  }
);

server.tool(
  'get_transaction',
  'Get detailed information about a specific transaction',
  {
    transactionId: z.string().describe('Transaction ID'),
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
  },
  async ({ transactionId, budgetId }) => currencyResponse(await client.getTransaction(transactionId, budgetId))
);

server.tool(
  'create_transaction',
  'Create a new transaction',
  {
    accountId: z.string().describe('Account ID'),
    date: z.string().describe('Transaction date (YYYY-MM-DD)'),
    amount: z.number().describe('Amount in dollars (negative for outflow, positive for inflow)'),
    payeeName: z.string().optional().describe('Payee name (creates new payee if not found)'),
    payeeId: z.string().optional().describe('Payee ID'),
    categoryId: z.string().optional().describe('Category ID'),
    memo: z.string().optional().describe('Transaction memo'),
    cleared: z.enum(['cleared', 'uncleared', 'reconciled']).optional().describe('Cleared status'),
    approved: z.boolean().optional().describe('Whether the transaction is approved'),
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
  },
  async ({ accountId, date, amount, payeeName, payeeId, categoryId, memo, cleared, approved, budgetId }) => {
    const transaction: Record<string, unknown> = {
      account_id: accountId,
      date,
      amount: amountToMilliunits(amount),
    };
    if (payeeName !== undefined) transaction.payee_name = payeeName;
    if (payeeId !== undefined) transaction.payee_id = payeeId;
    if (categoryId !== undefined) transaction.category_id = categoryId;
    if (memo !== undefined) transaction.memo = memo;
    if (cleared !== undefined) transaction.cleared = cleared;
    if (approved !== undefined) transaction.approved = approved;
    return currencyResponse(await client.createTransaction({ transaction }, budgetId));
  }
);

server.tool(
  'update_transaction',
  'Update an existing transaction',
  {
    transactionId: z.string().describe('Transaction ID'),
    accountId: z.string().optional().describe('Account ID'),
    date: z.string().optional().describe('Transaction date (YYYY-MM-DD)'),
    amount: z.number().optional().describe('Amount in dollars (negative for outflow, positive for inflow)'),
    payeeName: z.string().optional().describe('Payee name'),
    payeeId: z.string().optional().describe('Payee ID'),
    categoryId: z.string().optional().describe('Category ID'),
    memo: z.string().optional().describe('Transaction memo'),
    cleared: z.enum(['cleared', 'uncleared', 'reconciled']).optional().describe('Cleared status'),
    approved: z.boolean().optional().describe('Whether the transaction is approved'),
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
  },
  async ({ transactionId, accountId, date, amount, payeeName, payeeId, categoryId, memo, cleared, approved, budgetId }) => {
    const transaction: Record<string, unknown> = {};
    if (accountId !== undefined) transaction.account_id = accountId;
    if (date !== undefined) transaction.date = date;
    if (amount !== undefined) transaction.amount = amountToMilliunits(amount);
    if (payeeName !== undefined) transaction.payee_name = payeeName;
    if (payeeId !== undefined) transaction.payee_id = payeeId;
    if (categoryId !== undefined) transaction.category_id = categoryId;
    if (memo !== undefined) transaction.memo = memo;
    if (cleared !== undefined) transaction.cleared = cleared;
    if (approved !== undefined) transaction.approved = approved;
    return currencyResponse(await client.updateTransaction(transactionId, { transaction }, budgetId));
  }
);

server.tool(
  'delete_transaction',
  'Delete a transaction',
  {
    transactionId: z.string().describe('Transaction ID'),
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
  },
  async ({ transactionId, budgetId }) =>
    currencyResponse(await client.deleteTransaction(transactionId, budgetId))
);

server.tool(
  'import_transactions',
  'Trigger import of linked bank transactions',
  { budgetId: z.string().optional().describe('Budget ID (uses default if not specified)') },
  async ({ budgetId }) => jsonResponse(await client.importTransactions(budgetId))
);

server.tool(
  'batch_update_transactions',
  'Update multiple transactions in a single API call. Amounts in dollars.',
  {
    transactions: z.array(z.object({
      id: z.string().optional().nullable().describe('Transaction ID (required if no import_id)'),
      import_id: z.string().optional().nullable().describe('Import ID (required if no id)'),
      account_id: z.string().optional().describe('Account ID'),
      date: z.string().optional().describe('Transaction date (YYYY-MM-DD)'),
      amount: z.number().optional().describe('Amount in dollars (negative for outflow)'),
      payee_id: z.string().optional().nullable().describe('Payee ID'),
      payee_name: z.string().optional().nullable().describe('Payee name'),
      category_id: z.string().optional().nullable().describe('Category ID'),
      memo: z.string().optional().nullable().describe('Transaction memo'),
      cleared: z.enum(['cleared', 'uncleared', 'reconciled']).optional().describe('Cleared status'),
      approved: z.boolean().optional().describe('Whether the transaction is approved'),
      flag_color: z.enum(['red', 'orange', 'yellow', 'green', 'blue', 'purple']).optional().nullable().describe('Flag color'),
    })).describe('Array of transaction updates'),
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
  },
  async ({ transactions, budgetId }) => {
    const transactionsInMilliunits = transactions.map((update) => ({
      ...update,
      ...(update.amount !== undefined ? { amount: amountToMilliunits(update.amount) } : {}),
    }));
    return currencyResponse(
      await client.updateTransactions(
        { transactions: transactionsInMilliunits as Parameters<typeof client.updateTransactions>[0]['transactions'] },
        budgetId
      )
    );
  }
);

server.tool(
  'summarize_transactions',
  'Get aggregate summary of transactions by payee, category, and status',
  {
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
    sinceDate: z.string().optional().describe('Only return transactions on or after this date (YYYY-MM-DD)'),
    untilDate: z.string().optional().describe('Only return transactions on or before this date (YYYY-MM-DD)'),
    type: z.enum(['uncategorized', 'unapproved']).optional().describe('Filter by transaction type'),
    approved: z.enum(['true', 'false']).optional().describe('Filter by approval status'),
    status: z.string().optional().describe('Filter by cleared status: cleared, uncleared, reconciled (comma-separated)'),
    minAmount: z.number().optional().describe('Minimum amount in dollars'),
    maxAmount: z.number().optional().describe('Maximum amount in dollars'),
    top: z.number().optional().describe('Limit payee/category breakdowns to top N entries'),
  },
  async ({ budgetId, sinceDate, untilDate, type, approved, status, minAmount, maxAmount, top }) => {
    const result = await client.getTransactions({ budgetId, sinceDate, type });
    const transactions = result?.transactions || [];
    const filtered = applyTransactionFilters(transactions as TransactionLike[], {
      until: untilDate,
      approved,
      status,
      minAmount,
      maxAmount,
    });
    const summary = summarizeTransactions(
      filtered as SummaryTransaction[],
      top ? { top } : undefined
    );
    return currencyResponse(summary);
  }
);

server.tool(
  'find_transfer_candidates',
  'Find candidate transfer matches for a transaction across accounts',
  {
    transactionId: z.string().describe('Transaction ID to find transfers for'),
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
    maxDays: z.number().optional().describe('Maximum date difference in days (default: 3)'),
    sinceDate: z.string().optional().describe('Search transactions since date (defaults to source date minus maxDays)'),
  },
  async ({ transactionId, budgetId, maxDays: maxDaysParam, sinceDate }) => {
    const days = maxDaysParam ?? 3;
    const source = await client.getTransaction(transactionId, budgetId);
    if (!sinceDate) {
      const d = new Date(source.date);
      d.setDate(d.getDate() - days);
      sinceDate = d.toISOString().split('T')[0];
    }
    const result = await client.getTransactions({ budgetId, sinceDate });
    const allTransactions = result?.transactions || [];
    const candidates = findTransferCandidates(
      source as SummaryTransaction,
      allTransactions as SummaryTransaction[],
      { maxDays: days }
    );
    return currencyResponse({ source, candidates });
  }
);

server.tool(
  'list_transactions_by_account',
  'List transactions for a specific account',
  {
    accountId: z.string().describe('Account ID'),
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
    sinceDate: z.string().optional().describe('Only return transactions on or after this date (YYYY-MM-DD)'),
    fields: z.string().optional().describe('Comma-separated list of fields to include (e.g., id,date,amount,memo)'),
  },
  async ({ accountId, budgetId, sinceDate, fields }) => {
    const result = await client.getTransactionsByAccount(accountId, { budgetId, sinceDate });
    if (!fields) return currencyResponse(result);
    return currencyResponse(applyFieldSelection(result?.transactions || [], fields));
  }
);

server.tool(
  'list_transactions_by_category',
  'List transactions for a specific category',
  {
    categoryId: z.string().describe('Category ID'),
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
    sinceDate: z.string().optional().describe('Only return transactions on or after this date (YYYY-MM-DD)'),
    fields: z.string().optional().describe('Comma-separated list of fields to include (e.g., id,date,amount,memo)'),
  },
  async ({ categoryId, budgetId, sinceDate, fields }) => {
    const result = await client.getTransactionsByCategory(categoryId, { budgetId, sinceDate });
    if (!fields) return currencyResponse(result);
    return currencyResponse(applyFieldSelection(result?.transactions || [], fields));
  }
);

server.tool(
  'list_transactions_by_payee',
  'List transactions for a specific payee',
  {
    payeeId: z.string().describe('Payee ID'),
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
    sinceDate: z.string().optional().describe('Only return transactions on or after this date (YYYY-MM-DD)'),
    fields: z.string().optional().describe('Comma-separated list of fields to include (e.g., id,date,amount,memo)'),
  },
  async ({ payeeId, budgetId, sinceDate, fields }) => {
    const result = await client.getTransactionsByPayee(payeeId, { budgetId, sinceDate });
    if (!fields) return currencyResponse(result);
    return currencyResponse(applyFieldSelection(result?.transactions || [], fields));
  }
);

server.tool(
  'list_payees',
  'List all payees in a budget',
  { budgetId: z.string().optional().describe('Budget ID (uses default if not specified)') },
  async ({ budgetId }) => jsonResponse(await client.getPayees(budgetId))
);

server.tool(
  'update_payee',
  'Rename a payee',
  {
    payeeId: z.string().describe('Payee ID'),
    name: z.string().describe('New payee name'),
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
  },
  async ({ payeeId, name, budgetId }) =>
    jsonResponse(await client.updatePayee(payeeId, { payee: { name } }, budgetId))
);

server.tool(
  'list_payee_locations',
  'List locations for a specific payee',
  {
    payeeId: z.string().describe('Payee ID'),
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
  },
  async ({ payeeId, budgetId }) =>
    jsonResponse(await client.getPayeeLocationsByPayee(payeeId, budgetId))
);

server.tool(
  'list_budget_months',
  'List all budget months',
  { budgetId: z.string().optional().describe('Budget ID (uses default if not specified)') },
  async ({ budgetId }) => currencyResponse(await client.getBudgetMonths(budgetId))
);

server.tool(
  'get_budget_month',
  'Get budget details for a specific month',
  {
    month: z.string().describe('Month in YYYY-MM-DD format (day is ignored, use first of month)'),
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
  },
  async ({ month, budgetId }) => currencyResponse(await client.getBudgetMonth(month, budgetId))
);

server.tool(
  'list_scheduled_transactions',
  'List all scheduled transactions in a budget',
  { budgetId: z.string().optional().describe('Budget ID (uses default if not specified)') },
  async ({ budgetId }) => currencyResponse(await client.getScheduledTransactions(budgetId))
);

server.tool(
  'get_scheduled_transaction',
  'Get a single scheduled transaction',
  {
    scheduledTransactionId: z.string().describe('Scheduled transaction ID'),
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
  },
  async ({ scheduledTransactionId, budgetId }) =>
    currencyResponse(await client.getScheduledTransaction(scheduledTransactionId, budgetId))
);

server.tool(
  'delete_scheduled_transaction',
  'Delete a scheduled transaction',
  {
    scheduledTransactionId: z.string().describe('Scheduled transaction ID'),
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
  },
  async ({ scheduledTransactionId, budgetId }) =>
    currencyResponse(await client.deleteScheduledTransaction(scheduledTransactionId, budgetId))
);

server.tool(
  'raw_api_call',
  'Make a direct YNAB API call',
  {
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).describe('HTTP method'),
    path: z.string().describe('API path (e.g., /budgets/{budget_id}/accounts). {budget_id} is replaced with the default budget.'),
    data: z.record(z.unknown()).optional().describe('Request body for POST/PUT/PATCH'),
    budgetId: z.string().optional().describe('Budget ID for {budget_id} replacement (uses default if not specified)'),
  },
  async ({ method, path, data, budgetId }) =>
    jsonResponse(await client.rawApiCall(method, path, data, budgetId))
);

server.tool(
  'get_user',
  'Get information about the authenticated user',
  {},
  async () => jsonResponse(await client.getUser())
);

server.tool(
  'check_auth',
  'Check if YNAB authentication is configured',
  {},
  async () => jsonResponse({ authenticated: await auth.isAuthenticated() })
);

server.tool(
  'search_tools',
  'Search for available tools by name or description using regex. Returns matching tool names.',
  {
    query: z.string().describe('Regex pattern to match against tool names and descriptions (case-insensitive)'),
  },
  async ({ query }) => {
    try {
      const pattern = new RegExp(query, 'i');
      const matches = toolRegistry.filter((t) => pattern.test(t.name) || pattern.test(t.description));
      return jsonResponse({ tools: matches });
    } catch {
      return jsonResponse({ error: 'Invalid regex pattern' });
    }
  }
);

export async function runMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
