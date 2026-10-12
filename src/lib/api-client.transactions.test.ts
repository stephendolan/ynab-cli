import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as ynab from 'ynab';
import { YnabClient } from './api-client.js';

class SyntheticCredentialClient extends YnabClient {
  override async getApi(): Promise<ynab.API> {
    return new ynab.API('synthetic-test-token');
  }
}

describe('transaction-list SDK request contracts', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { transactions: [], server_knowledge: 43 } }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const paths = [
    ['plan', '/v1/plans/test-plan/transactions'],
    ['account', '/v1/plans/test-plan/accounts/test-account/transactions'],
    ['category', '/v1/plans/test-plan/categories/test-category/transactions'],
    ['payee', '/v1/plans/test-plan/payees/test-payee/transactions'],
  ] as const;

  it.each(paths)('sends named filters for %s transactions', async (scope, path) => {
    const client = new SyntheticCredentialClient();
    const params = {
      budgetId: 'test-plan',
      sinceDate: '2015-12-01',
      type: 'unapproved',
      lastKnowledgeOfServer: 42,
    };
    const result = await (scope === 'plan'
      ? client.getTransactions(params)
      : scope === 'account'
        ? client.getTransactionsByAccount('test-account', params)
        : scope === 'category'
          ? client.getTransactionsByCategory('test-category', params)
          : client.getTransactionsByPayee('test-payee', params));

    expect(result).toEqual({ transactions: [], server_knowledge: 43 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin).toBe('https://api.ynab.com');
    expect(url.pathname).toBe(path);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      since_date: '2015-12-01',
      type: 'unapproved',
      last_knowledge_of_server: '42',
    });
    expect(url.searchParams.has('until_date')).toBe(false);
  });
});
