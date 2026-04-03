/**
 * Conversation Memory Manager
 *
 * Persists per-booking conversation history to disk and generates
 * memory snapshots to keep the context window manageable.
 *
 * Folder structure:
 *   data/<propertyId>_<guestName>_<checkIn>/
 *     history.json     — full conversation history
 *     memory.json      — latest compressed memory snapshot
 */

import fs from 'node:fs';
import path from 'node:path';
import type { AnthropicMessage } from './minimax.js';
import type { Booking } from './types.js';

const DATA_DIR = path.resolve('data');

// How many recent messages to keep in full (older ones get summarized)
const RECENT_MESSAGE_LIMIT = 20;

export interface MemorySnapshot {
  bookingId: string;
  timestamp: string;
  summary: string;
  keyFacts: string[];
  pendingActions: string[];
  totalSpent: number;
  messageCount: number;
}

function bookingDirName(booking: Booking): string {
  const guest = booking.guestName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `${booking.propertyId}_${guest}_${booking.checkIn}`;
}

function getBookingDir(booking: Booking): string {
  return path.join(DATA_DIR, bookingDirName(booking));
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Save conversation history for a booking.
 */
export function saveHistory(booking: Booking, messages: AnthropicMessage[]): void {
  const dir = getBookingDir(booking);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'history.json'), JSON.stringify(messages, null, 2));
}

/**
 * Load conversation history for a booking.
 */
export function loadHistory(booking: Booking): AnthropicMessage[] {
  const filePath = path.join(getBookingDir(booking), 'history.json');
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Save a memory snapshot.
 */
export function saveSnapshot(booking: Booking, snapshot: MemorySnapshot): void {
  const dir = getBookingDir(booking);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'memory.json'), JSON.stringify(snapshot, null, 2));

  // Also save dated snapshot
  const date = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(dir, `memory_${date}.json`), JSON.stringify(snapshot, null, 2));
}

/**
 * Load the latest memory snapshot.
 */
export function loadSnapshot(booking: Booking): MemorySnapshot | null {
  const filePath = path.join(getBookingDir(booking), 'memory.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Build a context-efficient message list:
 * - If history is short, return as-is
 * - If history is long, prepend the memory snapshot summary + keep only recent messages
 */
export function buildContextMessages(
  history: AnthropicMessage[],
  snapshot: MemorySnapshot | null,
): AnthropicMessage[] {
  if (history.length <= RECENT_MESSAGE_LIMIT) return history;

  const recent = history.slice(-RECENT_MESSAGE_LIMIT);

  if (snapshot) {
    // Prepend summary as a system-injected user message
    const summaryMessage: AnthropicMessage = {
      role: 'user',
      content: `[Context from earlier conversation — ${snapshot.messageCount} messages summarized]\n\n` +
        `Summary: ${snapshot.summary}\n` +
        (snapshot.keyFacts.length > 0 ? `Key facts: ${snapshot.keyFacts.join('; ')}\n` : '') +
        (snapshot.pendingActions.length > 0 ? `Pending: ${snapshot.pendingActions.join('; ')}\n` : '') +
        `Total spent so far: $${snapshot.totalSpent} USDC`,
    };

    return [summaryMessage, ...recent];
  }

  return recent;
}

/**
 * Generate a memory snapshot from conversation history.
 * Uses simple heuristic extraction (no LLM call — fast and deterministic).
 */
export function generateSnapshot(
  booking: Booking,
  history: AnthropicMessage[],
  totalSpent: number,
): MemorySnapshot {
  const keyFacts: string[] = [];
  const pendingActions: string[] = [];
  let summaryParts: string[] = [];

  for (const msg of history) {
    if (typeof msg.content !== 'string') continue;
    const text = msg.content;

    // Extract guest preferences mentioned
    if (msg.role === 'user' && (text.includes('preference') || text.includes('allergic') || text.includes('vegetarian') || text.includes('vegan'))) {
      keyFacts.push(text.slice(0, 200));
    }

    // Track tool results for key events
    if (text.includes('link_guest') || text.includes('linked')) {
      keyFacts.push('Guest identity confirmed and linked to booking');
    }

    // Track service orders
    if (text.includes('Booked!') || text.includes('ordered') || text.includes('On its way')) {
      summaryParts.push(text.slice(0, 100));
    }

    // Track escalations
    if (text.includes('escalat')) {
      pendingActions.push('Issue escalated to host — may need follow-up');
    }
  }

  // Build summary
  if (summaryParts.length === 0) {
    summaryParts = ['Conversation in progress, no major events yet'];
  }

  return {
    bookingId: booking.id,
    timestamp: new Date().toISOString(),
    summary: summaryParts.slice(0, 5).join('. '),
    keyFacts: [...new Set(keyFacts)].slice(0, 10),
    pendingActions: [...new Set(pendingActions)].slice(0, 5),
    totalSpent,
    messageCount: history.length,
  };
}

/**
 * Get the booking directory path (for external use/tests).
 */
export function getBookingDirPath(booking: Booking): string {
  return getBookingDir(booking);
}
