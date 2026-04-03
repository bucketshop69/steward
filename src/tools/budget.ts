// Budget tools — implement in issue #012

import type { BudgetCheck, Transaction } from '../types.js';

export async function checkBudget(_propertyId: string, _amount: number): Promise<BudgetCheck> {
  // TODO: implement in issue #012
  return { allowed: false, remaining: 0, dailyBudget: 0, spentToday: 0, reason: 'Not implemented' };
}

export async function getTransactionHistory(
  _propertyId: string,
  _bookingId?: string,
): Promise<{ transactions: Transaction[]; totalSpent: number }> {
  // TODO: implement in issue #012
  return { transactions: [], totalSpent: 0 };
}
