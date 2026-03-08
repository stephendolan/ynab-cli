import { describe, expect, it } from 'vitest';
import { summarizeTransactions, findTransferCandidates, type SummaryTransaction } from './utils.js';

function makeTx(overrides: Partial<SummaryTransaction> = {}): SummaryTransaction {
  return {
    date: '2026-03-01',
    amount: -10000,
    approved: false,
    cleared: 'uncleared',
    account_id: 'acc-1',
    payee_id: 'payee-1',
    payee_name: 'Store A',
    category_id: 'cat-1',
    category_name: 'Groceries',
    ...overrides,
  };
}

describe('summarizeTransactions', () => {
  it('returns zeroed summary for empty array', () => {
    const summary = summarizeTransactions([]);
    expect(summary.total_count).toBe(0);
    expect(summary.total_amount).toBe(0);
    expect(summary.date_range).toBeNull();
    expect(summary.by_payee).toEqual([]);
    expect(summary.by_category).toEqual([]);
  });

  it('aggregates counts and amounts', () => {
    const transactions = [
      makeTx({ amount: -10000, payee_name: 'Store A', category_name: 'Groceries' }),
      makeTx({ amount: -5000, payee_name: 'Store A', category_name: 'Groceries' }),
      makeTx({ amount: -20000, payee_name: 'Store B', payee_id: 'payee-2', category_name: 'Dining', category_id: 'cat-2' }),
    ];
    const summary = summarizeTransactions(transactions);
    expect(summary.total_count).toBe(3);
    expect(summary.total_amount).toBe(-35000);
    expect(summary.by_payee).toHaveLength(2);
    expect(summary.by_payee[0].payee_name).toBe('Store B');
    expect(summary.by_payee[0].total_amount).toBe(-20000);
    expect(summary.by_category).toHaveLength(2);
  });

  it('respects top N truncation', () => {
    const transactions = [
      makeTx({ amount: -10000, payee_name: 'A', payee_id: 'p1' }),
      makeTx({ amount: -20000, payee_name: 'B', payee_id: 'p2' }),
      makeTx({ amount: -30000, payee_name: 'C', payee_id: 'p3' }),
    ];
    const summary = summarizeTransactions(transactions, { top: 2 });
    expect(summary.by_payee).toHaveLength(3);
    expect(summary.by_payee[2].payee_name).toBe('(other)');
    expect(summary.by_payee[2].total_amount).toBe(-10000);
  });

  it('tracks date range', () => {
    const transactions = [
      makeTx({ date: '2026-03-01' }),
      makeTx({ date: '2026-03-15' }),
      makeTx({ date: '2026-03-10' }),
    ];
    const summary = summarizeTransactions(transactions);
    expect(summary.date_range).toEqual({ from: '2026-03-01', to: '2026-03-15' });
  });

  it('groups by cleared and approval status', () => {
    const transactions = [
      makeTx({ cleared: 'cleared', approved: true }),
      makeTx({ cleared: 'cleared', approved: false }),
      makeTx({ cleared: 'uncleared', approved: false }),
    ];
    const summary = summarizeTransactions(transactions);
    expect(summary.by_cleared_status).toHaveLength(2);
    expect(summary.by_approval_status).toHaveLength(2);
  });
});

describe('findTransferCandidates', () => {
  it('finds matching transfer by opposite amount and different account', () => {
    const source = makeTx({ amount: -50000, account_id: 'checking', date: '2026-03-05' });
    const all = [
      makeTx({ amount: 50000, account_id: 'savings', date: '2026-03-05' }),
      makeTx({ amount: -50000, account_id: 'savings', date: '2026-03-05' }),
      makeTx({ amount: 50000, account_id: 'checking', date: '2026-03-05' }),
    ];
    const candidates = findTransferCandidates(source, all, { maxDays: 3 });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].transaction.account_id).toBe('savings');
    expect(candidates[0].date_difference_days).toBe(0);
  });

  it('excludes transactions outside date range', () => {
    const source = makeTx({ amount: -10000, account_id: 'acc-1', date: '2026-03-05' });
    const all = [
      makeTx({ amount: 10000, account_id: 'acc-2', date: '2026-03-20' }),
    ];
    const candidates = findTransferCandidates(source, all, { maxDays: 3 });
    expect(candidates).toHaveLength(0);
  });

  it('detects already-linked transfers', () => {
    const source = makeTx({ amount: -10000, account_id: 'acc-1', date: '2026-03-05' });
    const all = [
      makeTx({
        amount: 10000,
        account_id: 'acc-2',
        date: '2026-03-05',
        transfer_transaction_id: 'linked-tx',
      }),
    ];
    const candidates = findTransferCandidates(source, all, { maxDays: 3 });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].already_linked).toBe(true);
  });

  it('detects transfer payee pattern', () => {
    const source = makeTx({ amount: -10000, account_id: 'acc-1', date: '2026-03-05' });
    const all = [
      makeTx({
        amount: 10000,
        account_id: 'acc-2',
        date: '2026-03-05',
        payee_name: 'Transfer : Checking',
      }),
    ];
    const candidates = findTransferCandidates(source, all, { maxDays: 3 });
    expect(candidates[0].has_transfer_payee).toBe(true);
  });

  it('sorts by date difference ascending', () => {
    const source = makeTx({ amount: -10000, account_id: 'acc-1', date: '2026-03-05' });
    const all = [
      makeTx({ amount: 10000, account_id: 'acc-2', date: '2026-03-07' }),
      makeTx({ amount: 10000, account_id: 'acc-3', date: '2026-03-05' }),
      makeTx({ amount: 10000, account_id: 'acc-4', date: '2026-03-06' }),
    ];
    const candidates = findTransferCandidates(source, all, { maxDays: 3 });
    expect(candidates).toHaveLength(3);
    expect(candidates[0].date_difference_days).toBe(0);
    expect(candidates[1].date_difference_days).toBe(1);
    expect(candidates[2].date_difference_days).toBe(2);
  });
});
