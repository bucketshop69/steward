import fs from 'node:fs';
import path from 'node:path';
import type { Transaction } from '../types.js';

const DATA_DIR = path.resolve('data');
const FILE = path.join(DATA_DIR, 'transactions.json');

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAll(): Transaction[] {
  if (!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE, 'utf-8')) as Transaction[];
}

function writeAll(transactions: Transaction[]): void {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(transactions, null, 2));
}

export function listTransactions(propertyId: string, bookingId?: string): Transaction[] {
  const all = readAll();
  return all.filter((t) => {
    if (t.propertyId !== propertyId) return false;
    if (bookingId && t.bookingId !== bookingId) return false;
    return true;
  });
}

export function addTransaction(transaction: Transaction): void {
  const all = readAll();
  all.push(transaction);
  writeAll(all);
}

export function getTodaySpend(propertyId: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const all = readAll();
  return all
    .filter((t) => t.propertyId === propertyId && t.timestamp.startsWith(today))
    .reduce((sum, t) => sum + t.amount, 0);
}

export function getTotalSpend(bookingId: string): number {
  const all = readAll();
  return all
    .filter((t) => t.bookingId === bookingId)
    .reduce((sum, t) => sum + t.amount, 0);
}
