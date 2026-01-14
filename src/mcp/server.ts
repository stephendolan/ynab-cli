import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { client } from '../lib/api-client.js';
import { auth } from '../lib/auth.js';
import { convertMilliunitsToAmounts } from '../lib/utils.js';

const toolRegistry = [
  { name: 'list_budgets', description: 'List all budgets in the YNAB account' },
  { name: 'get_budget', description: 'Get detailed information about a specific budget' },
  { name: 'list_accounts', description: 'List all accounts in a budget' },
  { name: 'get_account', description: 'Get detailed information about a specific account' },
  { name: 'list_categories', description: 'List all category groups and categories in a budget' },
  { name: 'get_category', description: 'Get detailed information about a specific category' },
  { name: 'list_transactions', description: 'List transactions with optional filtering' },
  { name: 'get_transaction', description: 'Get detailed information about a specific transaction' },
  { name: 'list_transactions_by_account', description: 'List transactions for a specific account' },
  { name: 'list_transactions_by_category', description: 'List transactions for a specific category' },
  { name: 'list_payees', description: 'List all payees in a budget' },
  { name: 'get_budget_month', description: 'Get budget details for a specific month' },
  { name: 'list_scheduled_transactions', description: 'List all scheduled transactions in a budget' },
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
  'list_transactions',
  'List transactions with optional filtering',
  {
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
    sinceDate: z.string().optional().describe('Only return transactions on or after this date (YYYY-MM-DD)'),
    type: z.enum(['uncategorized', 'unapproved']).optional().describe('Filter by transaction type'),
  },
  async ({ budgetId, sinceDate, type }) =>
    currencyResponse(await client.getTransactions({ budgetId, sinceDate, type }))
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
  'list_transactions_by_account',
  'List transactions for a specific account',
  {
    accountId: z.string().describe('Account ID'),
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
    sinceDate: z.string().optional().describe('Only return transactions on or after this date (YYYY-MM-DD)'),
  },
  async ({ accountId, budgetId, sinceDate }) =>
    currencyResponse(await client.getTransactionsByAccount(accountId, { budgetId, sinceDate }))
);

server.tool(
  'list_transactions_by_category',
  'List transactions for a specific category',
  {
    categoryId: z.string().describe('Category ID'),
    budgetId: z.string().optional().describe('Budget ID (uses default if not specified)'),
    sinceDate: z.string().optional().describe('Only return transactions on or after this date (YYYY-MM-DD)'),
  },
  async ({ categoryId, budgetId, sinceDate }) =>
    currencyResponse(await client.getTransactionsByCategory(categoryId, { budgetId, sinceDate }))
);

server.tool(
  'list_payees',
  'List all payees in a budget',
  { budgetId: z.string().optional().describe('Budget ID (uses default if not specified)') },
  async ({ budgetId }) => jsonResponse(await client.getPayees(budgetId))
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
