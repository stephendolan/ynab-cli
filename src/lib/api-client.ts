import * as ynab from 'ynab';
import { config } from './config.js';
import { YnabCliError, handleYnabError, sanitizeApiError } from './errors.js';
import { auth } from './auth.js';

type TransactionTypeFilter = 'uncategorized' | 'unapproved' | undefined;

export class YnabClient {
  private api: ynab.API | null = null;
  private envVarWarningShown = false;

  clearApi(): void {
    this.api = null;
    this.envVarWarningShown = false;
  }

  async getApi(): Promise<ynab.API> {
    if (this.api) {
      return this.api;
    }

    const keychainToken = await auth.getAccessToken();
    const accessToken = keychainToken || process.env.YNAB_API_KEY || null;

    if (!accessToken) {
      throw new YnabCliError(
        'Not authenticated. Please run: ynab auth login or set YNAB_API_KEY environment variable',
        401
      );
    }

    if (!keychainToken && process.env.YNAB_API_KEY && !this.envVarWarningShown) {
      console.warn(
        '\x1b[33m⚠️  WARNING: Using YNAB_API_KEY environment variable.\n' +
          'Environment variables may be visible to other processes.\n' +
          'For better security, use: ynab auth login\x1b[0m\n'
      );
      this.envVarWarningShown = true;
    }

    this.api = new ynab.API(accessToken);
    return this.api;
  }

  async getBudgetId(budgetIdOrDefault?: string): Promise<string> {
    const budgetId = budgetIdOrDefault || config.getDefaultBudget() || process.env.YNAB_BUDGET_ID;

    if (!budgetId) {
      throw new YnabCliError(
        'No budget specified. Use --budget flag, set default with "ynab budgets set-default", or set YNAB_BUDGET_ID environment variable',
        400
      );
    }

    return budgetId;
  }

  private async withErrorHandling<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      handleYnabError(error);
    }
  }

  async getUser() {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const response = await api.user.getUser();
      return response.data.user;
    });
  }

  async getBudgets(includeAccounts = false) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const response = await api.budgets.getBudgets(includeAccounts);
      return {
        budgets: response.data.budgets,
        server_knowledge: 0,
      };
    });
  }

  async getBudget(budgetId?: string, lastKnowledgeOfServer?: number) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.budgets.getBudgetById(id, lastKnowledgeOfServer);
      return {
        budget: response.data.budget,
        server_knowledge: response.data.server_knowledge,
      };
    });
  }

  async getBudgetSettings(budgetId?: string) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.budgets.getBudgetSettingsById(id);
      return response.data.settings;
    });
  }

  async getAccounts(budgetId?: string, lastKnowledgeOfServer?: number) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.accounts.getAccounts(id, lastKnowledgeOfServer);
      return {
        accounts: response.data.accounts,
        server_knowledge: response.data.server_knowledge,
      };
    });
  }

  async getAccount(accountId: string, budgetId?: string) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.accounts.getAccountById(id, accountId);
      return response.data.account;
    });
  }

  async getCategories(budgetId?: string, lastKnowledgeOfServer?: number) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.categories.getCategories(id, lastKnowledgeOfServer);
      return {
        category_groups: response.data.category_groups,
        server_knowledge: response.data.server_knowledge,
      };
    });
  }

  async getCategory(categoryId: string, budgetId?: string) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.categories.getCategoryById(id, categoryId);
      return response.data.category;
    });
  }

  async updateMonthCategory(
    month: string,
    categoryId: string,
    data: ynab.PatchMonthCategoryWrapper,
    budgetId?: string
  ) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.categories.updateMonthCategory(id, month, categoryId, data);
      return response.data.category;
    });
  }

  async updateCategory(categoryId: string, data: ynab.PatchCategoryWrapper, budgetId?: string) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.categories.updateCategory(id, categoryId, data);
      return response.data.category;
    });
  }

  async getPayees(budgetId?: string, lastKnowledgeOfServer?: number) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.payees.getPayees(id, lastKnowledgeOfServer);
      return {
        payees: response.data.payees,
        server_knowledge: response.data.server_knowledge,
      };
    });
  }

  async getPayee(payeeId: string, budgetId?: string) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.payees.getPayeeById(id, payeeId);
      return response.data.payee;
    });
  }

  async updatePayee(payeeId: string, data: ynab.PatchPayeeWrapper, budgetId?: string) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.payees.updatePayee(id, payeeId, data);
      return response.data.payee;
    });
  }

  async getPayeeLocationsByPayee(payeeId: string, budgetId?: string) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.payeeLocations.getPayeeLocationsByPayee(id, payeeId);
      return response.data.payee_locations;
    });
  }

  async getBudgetMonths(budgetId?: string, lastKnowledgeOfServer?: number) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.months.getBudgetMonths(id, lastKnowledgeOfServer);
      return {
        months: response.data.months,
        server_knowledge: response.data.server_knowledge,
      };
    });
  }

  async getBudgetMonth(month: string, budgetId?: string) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.months.getBudgetMonth(id, month);
      return response.data.month;
    });
  }

  async getTransactions(params: {
    budgetId?: string;
    sinceDate?: string;
    type?: string;
    lastKnowledgeOfServer?: number;
  }) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(params.budgetId);
      const response = await api.transactions.getTransactions(
        id,
        params.sinceDate,
        params.type as TransactionTypeFilter,
        params.lastKnowledgeOfServer
      );
      return {
        transactions: response.data.transactions,
        server_knowledge: response.data.server_knowledge,
      };
    });
  }

  async getTransactionsByAccount(
    accountId: string,
    params: {
      budgetId?: string;
      sinceDate?: string;
      type?: string;
      lastKnowledgeOfServer?: number;
    }
  ) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(params.budgetId);
      const response = await api.transactions.getTransactionsByAccount(
        id,
        accountId,
        params.sinceDate,
        params.type as TransactionTypeFilter,
        params.lastKnowledgeOfServer
      );
      return {
        transactions: response.data.transactions,
        server_knowledge: response.data.server_knowledge,
      };
    });
  }

  async getTransactionsByCategory(
    categoryId: string,
    params: {
      budgetId?: string;
      sinceDate?: string;
      type?: string;
      lastKnowledgeOfServer?: number;
    }
  ) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(params.budgetId);
      const response = await api.transactions.getTransactionsByCategory(
        id,
        categoryId,
        params.sinceDate,
        params.type as TransactionTypeFilter,
        params.lastKnowledgeOfServer
      );
      return {
        transactions: response.data.transactions,
        server_knowledge: response.data.server_knowledge,
      };
    });
  }

  async getTransactionsByPayee(
    payeeId: string,
    params: {
      budgetId?: string;
      sinceDate?: string;
      type?: string;
      lastKnowledgeOfServer?: number;
    }
  ) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(params.budgetId);
      const response = await api.transactions.getTransactionsByPayee(
        id,
        payeeId,
        params.sinceDate,
        params.type as TransactionTypeFilter,
        params.lastKnowledgeOfServer
      );
      return {
        transactions: response.data.transactions,
        server_knowledge: response.data.server_knowledge,
      };
    });
  }

  async getTransaction(transactionId: string, budgetId?: string) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.transactions.getTransactionById(id, transactionId);
      return response.data.transaction;
    });
  }

  async createTransaction(transactionData: ynab.PostTransactionsWrapper, budgetId?: string) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.transactions.createTransaction(id, transactionData);
      return response.data.transaction;
    });
  }

  async updateTransaction(
    transactionId: string,
    transactionData: ynab.PutTransactionWrapper,
    budgetId?: string
  ) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.transactions.updateTransaction(id, transactionId, transactionData);
      return response.data.transaction;
    });
  }

  async updateTransactions(
    transactions: ynab.PatchTransactionsWrapper,
    budgetId?: string
  ) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.transactions.updateTransactions(id, transactions);
      return {
        transactions: response.data.transactions,
        transaction_ids: response.data.transaction_ids,
        server_knowledge: response.data.server_knowledge,
      };
    });
  }

  async deleteTransaction(transactionId: string, budgetId?: string) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.transactions.deleteTransaction(id, transactionId);
      return response.data.transaction;
    });
  }

  async importTransactions(budgetId?: string) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.transactions.importTransactions(id);
      return response.data.transaction_ids;
    });
  }

  async getScheduledTransactions(budgetId?: string, lastKnowledgeOfServer?: number) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.scheduledTransactions.getScheduledTransactions(
        id,
        lastKnowledgeOfServer
      );
      return {
        scheduled_transactions: response.data.scheduled_transactions,
        server_knowledge: response.data.server_knowledge,
      };
    });
  }

  async getScheduledTransaction(scheduledTransactionId: string, budgetId?: string) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.scheduledTransactions.getScheduledTransactionById(
        id,
        scheduledTransactionId
      );
      return response.data.scheduled_transaction;
    });
  }

  async deleteScheduledTransaction(scheduledTransactionId: string, budgetId?: string) {
    return this.withErrorHandling(async () => {
      const api = await this.getApi();
      const id = await this.getBudgetId(budgetId);
      const response = await api.scheduledTransactions.deleteScheduledTransaction(
        id,
        scheduledTransactionId
      );
      return response.data.scheduled_transaction;
    });
  }

  async rawApiCall(method: string, path: string, data?: unknown, budgetId?: string) {
    return this.withErrorHandling(async () => {
      await this.getApi();

      const fullPath = path.includes('{budget_id}')
        ? path.replace('{budget_id}', await this.getBudgetId(budgetId))
        : path;

      const url = `https://api.ynab.com/v1${fullPath}`;
      const accessToken = (await auth.getAccessToken()) || process.env.YNAB_API_KEY;
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      const httpMethod = method.toUpperCase();
      const hasBody = ['POST', 'PUT', 'PATCH'].includes(httpMethod);

      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(httpMethod)) {
        throw new YnabCliError(`Unsupported HTTP method: ${method}`, 400);
      }

      const response = await fetch(url, {
        method: httpMethod,
        headers,
        ...(hasBody && { body: JSON.stringify(data) }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as Record<string, unknown>;
        throw { error: sanitizeApiError(errorData.error || errorData) };
      }

      return await response.json();
    });
  }
}

export const client = new YnabClient();
