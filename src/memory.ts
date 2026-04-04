/**
 * Conversation Memory Manager
 *
 * Persists per-booking conversation history to disk and generates
 * memory snapshots to keep the context window manageable.
 *
 * Folder structure:
 *   data/<bookingId>/
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
  messageCount: number;
}

function getBookingDir(booking: Booking): string {
  const guest = booking.guestName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return path.join(DATA_DIR, `${booking.id}_${guest}`);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function saveHistory(booking: Booking, messages: AnthropicMessage[]): void {
  const dir = getBookingDir(booking);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'history.json'), JSON.stringify(messages, null, 2));
}

export function loadHistory(booking: Booking): AnthropicMessage[] {
  const filePath = path.join(getBookingDir(booking), 'history.json');
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function saveSnapshot(booking: Booking, snapshot: MemorySnapshot): void {
  const dir = getBookingDir(booking);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'memory.json'), JSON.stringify(snapshot, null, 2));
}

export function loadSnapshot(booking: Booking): MemorySnapshot | null {
  const filePath = path.join(getBookingDir(booking), 'memory.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function buildContextMessages(
  history: AnthropicMessage[],
  snapshot: MemorySnapshot | null,
): AnthropicMessage[] {
  if (history.length <= RECENT_MESSAGE_LIMIT) return history;

  const recent = history.slice(-RECENT_MESSAGE_LIMIT);

  if (snapshot) {
    const summaryMessage: AnthropicMessage = {
      role: 'user',
      content: `[Context from earlier conversation — ${snapshot.messageCount} messages summarized]\n\n` +
        `Summary: ${snapshot.summary}\n` +
        (snapshot.keyFacts.length > 0 ? `Key facts: ${snapshot.keyFacts.join('; ')}\n` : '') +
        (snapshot.pendingActions.length > 0 ? `Pending: ${snapshot.pendingActions.join('; ')}\n` : ''),
    };

    return [summaryMessage, ...recent];
  }

  return recent;
}

export function generateSnapshot(
  booking: Booking,
  history: AnthropicMessage[],
): MemorySnapshot {
  const keyFacts: string[] = [];
  const pendingActions: string[] = [];
  let summaryParts: string[] = [];

  for (const msg of history) {
    if (typeof msg.content !== 'string') continue;
    const text = msg.content;

    if (msg.role === 'user' && (text.includes('preference') || text.includes('allergic') || text.includes('vegetarian') || text.includes('vegan'))) {
      keyFacts.push(text.slice(0, 200));
    }

    if (text.includes('link_guest') || text.includes('linked')) {
      keyFacts.push('Guest identity confirmed and linked to booking');
    }

    if (text.includes('Booked!') || text.includes('ordered') || text.includes('On its way')) {
      summaryParts.push(text.slice(0, 100));
    }

    if (text.includes('escalat')) {
      pendingActions.push('Issue escalated to host — may need follow-up');
    }
  }

  if (summaryParts.length === 0) {
    summaryParts = ['Conversation in progress, no major events yet'];
  }

  return {
    bookingId: booking.id,
    timestamp: new Date().toISOString(),
    summary: summaryParts.slice(0, 5).join('. '),
    keyFacts: [...new Set(keyFacts)].slice(0, 10),
    pendingActions: [...new Set(pendingActions)].slice(0, 5),
    messageCount: history.length,
  };
}

export function getBookingDirPath(booking: Booking): string {
  return getBookingDir(booking);
}
