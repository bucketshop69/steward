import { getProperty } from '../store/properties.js';
import { getTodaySpend, listTransactions as storeListTransactions } from '../store/transactions.js';
import type { BudgetCheck, Transaction } from '../types.js';

export function checkBudget(propertyId: string, amount: number): BudgetCheck {
  const property = getProperty(propertyId);
  if (!property) {
    return { allowed: false, remaining: 0, dailyBudget: 0, spentToday: 0, reason: 'Property not found' };
  }

  const spentToday = getTodaySpend(propertyId);
  const remaining = property.dailyBudget - spentToday;

  if (amount > property.perTransactionLimit) {
    return {
      allowed: false, remaining, dailyBudget: property.dailyBudget, spentToday,
      reason: `Amount $${amount} exceeds per-transaction limit of $${property.perTransactionLimit}`,
    };
  }

  if (spentToday + amount > property.dailyBudget) {
    return {
      allowed: false, remaining, dailyBudget: property.dailyBudget, spentToday,
      reason: `Amount $${amount} would exceed daily budget. Spent today: $${spentToday}, budget: $${property.dailyBudget}`,
    };
  }

  return { allowed: true, remaining: remaining - amount, dailyBudget: property.dailyBudget, spentToday };
}

export function getTransactionHistory(
  propertyId: string,
  bookingId?: string,
): { transactions: Transaction[]; totalSpent: number; dailyBudget: number; remaining: number } {
  const property = getProperty(propertyId);
  const transactions = storeListTransactions(propertyId, bookingId);
  const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
  const dailyBudget = property?.dailyBudget ?? 0;
  const todaySpend = getTodaySpend(propertyId);

  return {
    transactions,
    totalSpent,
    dailyBudget,
    remaining: dailyBudget - todaySpend,
  };
}
