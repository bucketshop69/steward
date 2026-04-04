/**
 * Tests for conversation memory persistence and context management.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Booking } from '../src/types.js';
import type { AnthropicMessage } from '../src/minimax.js';

const DATA_DIR = path.resolve('data');
let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { console.log(`  ✓ ${name}`); passed++; }
  else { console.log(`  ✗ ${name}`); failed++; }
}

function cleanup() {
  if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true });
}

cleanup();

const {
  saveHistory, loadHistory, saveSnapshot, loadSnapshot,
  generateSnapshot, buildContextMessages, getBookingDirPath,
} = await import('../src/memory.js');

const testBooking: Booking = {
  id: 'bk-0410-abc1', guestName: 'John Doe',
  guestTelegramId: 22222, checkIn: '2026-04-10', checkOut: '2026-04-14',
  status: 'active',
};

// ── Booking directory ────────────────────────────────

console.log('\n📁 Booking Directory\n');

const dirPath = getBookingDirPath(testBooking);
assert(dirPath.includes('bk-0410-abc1_john-doe'), 'dir name formatted correctly');
assert(dirPath.startsWith(DATA_DIR), 'dir is under data/');

// ── Save and load history ────────────────────────────

console.log('\n💾 History Persistence\n');

const history: AnthropicMessage[] = [
  { role: 'user', content: '[group_id=-100001, sender_id=22222] Hi, what is the WiFi?' },
  { role: 'assistant', content: 'Let me look that up for you!' },
  { role: 'user', content: '[group_id=-100001, sender_id=22222] Thanks!' },
];

saveHistory(testBooking, history);

assert(fs.existsSync(path.join(dirPath, 'history.json')), 'history.json created');

const loaded = loadHistory(testBooking);
assert(loaded.length === 3, 'loaded 3 messages');
assert(loaded[0].role === 'user', 'first message is user');
assert((loaded[0].content as string).includes('WiFi'), 'first message content preserved');
assert(loaded[1].role === 'assistant', 'second message is assistant');

// Load from non-existent booking
const emptyBooking: Booking = {
  id: 'bk-none', guestName: 'Nobody',
  checkIn: '2026-01-01', checkOut: '2026-01-02',
  status: 'pending',
};
const emptyHistory = loadHistory(emptyBooking);
assert(emptyHistory.length === 0, 'empty history for non-existent booking');

// ── Save and load snapshot ───────────────────────────

console.log('\n📸 Snapshot Persistence\n');

const snapshot = {
  bookingId: testBooking.id,
  timestamp: new Date().toISOString(),
  summary: 'Guest asked about WiFi and check-in instructions.',
  keyFacts: ['Guest is vegetarian', 'Guest identity confirmed and linked to booking'],
  pendingActions: [],
  messageCount: 15,
};

saveSnapshot(testBooking, snapshot);

assert(fs.existsSync(path.join(dirPath, 'memory.json')), 'memory.json created');

const loadedSnapshot = loadSnapshot(testBooking);
assert(loadedSnapshot !== null, 'snapshot loaded');
assert(loadedSnapshot!.bookingId === testBooking.id, 'snapshot booking ID matches');
assert(loadedSnapshot!.summary.includes('WiFi'), 'summary content preserved');
assert(loadedSnapshot!.keyFacts.length === 2, 'key facts preserved');
assert(loadedSnapshot!.messageCount === 15, 'message count preserved');

// No snapshot for non-existent booking
const noSnapshot = loadSnapshot(emptyBooking);
assert(noSnapshot === null, 'null snapshot for non-existent booking');

// ── Generate snapshot from history ───────────────────

console.log('\n🤖 Snapshot Generation\n');

const longHistory: AnthropicMessage[] = [
  { role: 'user', content: 'I have a preference for vegetarian food' },
  { role: 'assistant', content: 'Noted! I\'ll keep your vegetarian preference in mind.' },
  { role: 'user', content: 'Can you order some food?' },
  { role: 'assistant', content: 'On its way! Thai green curry for 2 people.' },
  { role: 'user', content: 'The AC is broken' },
  { role: 'assistant', content: 'I\'ll escalate this to the host.' },
  { role: 'user', content: 'Guest linked to booking via link_guest' },
];

const generated = generateSnapshot(testBooking, longHistory);
assert(generated.bookingId === testBooking.id, 'generated snapshot has correct booking ID');
assert(generated.messageCount === 7, 'correct message count');
assert(generated.summary.includes('Thai green curry'), 'summary captures orders');
assert(generated.keyFacts.length > 0, 'has key facts');
assert(generated.keyFacts.some(f => f.includes('vegetarian') || f.includes('linked')), 'captures preferences or linking');
assert(generated.pendingActions.some(a => a.includes('escalat')), 'captures escalation');

// Empty history snapshot
const emptyGenerated = generateSnapshot(testBooking, []);
assert(emptyGenerated.summary.includes('no major events'), 'empty history has default summary');

// ── Build context messages ───────────────────────────

console.log('\n🧠 Context Message Building\n');

// Short history — returned as-is
const shortHistory: AnthropicMessage[] = [
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi there!' },
];
const shortContext = buildContextMessages(shortHistory, null);
assert(shortContext.length === 2, 'short history returned as-is');
assert(shortContext[0].role === 'user', 'first message preserved');

// Long history without snapshot — truncated to 20
const longMessages: AnthropicMessage[] = [];
for (let i = 0; i < 30; i++) {
  longMessages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `Message ${i}` });
}
const truncated = buildContextMessages(longMessages, null);
assert(truncated.length === 20, 'long history truncated to 20');
assert((truncated[0].content as string) === 'Message 10', 'keeps most recent messages');

// Long history with snapshot — summary prepended
const withSnapshot = buildContextMessages(longMessages, {
  bookingId: 'bk-test',
  timestamp: new Date().toISOString(),
  summary: 'Guest ordered food and asked about WiFi.',
  keyFacts: ['Vegetarian', 'Checking out Friday'],
  pendingActions: ['Follow up on AC repair'],
  messageCount: 25,
});
assert(withSnapshot.length === 21, '20 recent + 1 summary message');
assert(withSnapshot[0].role === 'user', 'summary message is user role');
assert((withSnapshot[0].content as string).includes('25 messages summarized'), 'summary mentions message count');
assert((withSnapshot[0].content as string).includes('ordered food'), 'summary includes content');
assert((withSnapshot[0].content as string).includes('Vegetarian'), 'summary includes key facts');
assert((withSnapshot[0].content as string).includes('AC repair'), 'summary includes pending actions');

cleanup();

// ── Results ─────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All memory tests passed! ✅\n');
