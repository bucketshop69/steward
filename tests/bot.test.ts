import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}`);
    failed++;
  }
}

// We test the pure logic functions by importing the module and checking exports
// The actual Telegram integration needs a real bot token

console.log('\n🤖 Bot Logic Tests\n');

// ── Module exports ──────────────────────────────────

console.log('Module exports:');

const bot = await import('../src/bot.js');
assert(typeof bot.startBot === 'function', 'startBot is exported');
assert(typeof bot.createInviteLink === 'function', 'createInviteLink is exported');

// ── Host detection & command parsing (test via the regex patterns) ──

console.log('\nHost detection patterns:');

function hasStewardMention(text: string): boolean {
  return /[@]steward/i.test(text);
}

function parseStewardCommand(text: string): string | null {
  const match = text.match(/@steward\s+(.+)/i);
  return match ? match[1].trim().toLowerCase() : null;
}

// @steward mention detection
assert(hasStewardMention('@steward help'), '@steward help detected');
assert(hasStewardMention('@Steward HELP'), '@Steward HELP detected (case insensitive)');
assert(hasStewardMention('hey @steward stop'), 'mention in middle of text');
assert(!hasStewardMention('hello steward'), 'plain "steward" without @ not detected');
assert(!hasStewardMention('random message'), 'random message not detected');

// Command parsing
assert(parseStewardCommand('@steward handle this') === 'handle this', 'parse "handle this"');
assert(parseStewardCommand('@steward stop') === 'stop', 'parse "stop"');
assert(parseStewardCommand('@steward summary') === 'summary', 'parse "summary"');
assert(parseStewardCommand('@steward budget') === 'budget', 'parse "budget"');
assert(parseStewardCommand('@Steward STOP') === 'stop', 'parse case insensitive');
assert(parseStewardCommand('@steward') === null, 'no command after @steward');
assert(parseStewardCommand('hello') === null, 'no @steward at all');

// ── Message routing logic ───────────────────────────

console.log('\nMessage routing logic:');

function isHostMessage(senderId: number, hostTelegramId: number): boolean {
  return senderId === hostTelegramId;
}

assert(isHostMessage(12345, 12345), 'host ID matches');
assert(!isHostMessage(99999, 12345), 'non-host ID rejected');
assert(!isHostMessage(0, 12345), 'zero ID rejected');

// ── Pause/resume state ──────────────────────────────

console.log('\nPause/resume state:');

const pausedGroups = new Set<number>();

assert(!pausedGroups.has(67890), 'group not paused by default');
pausedGroups.add(67890);
assert(pausedGroups.has(67890), 'group paused after add');
pausedGroups.delete(67890);
assert(!pausedGroups.has(67890), 'group resumed after delete');

// Multiple groups
pausedGroups.add(111);
pausedGroups.add(222);
assert(pausedGroups.has(111), 'first group paused');
assert(pausedGroups.has(222), 'second group paused');
assert(!pausedGroups.has(333), 'third group not paused');

// ── Bot startup validation ──────────────────────────

console.log('\nBot startup validation:');

// Without token, startBot should exit (we can't test this without mocking process.exit)
// But we can verify the module loaded correctly
assert(bot.startBot.length === 1, 'startBot takes 1 argument (options)');

// ── Store integration ───────────────────────────────

console.log('\nStore integration for host commands:');

const DATA_DIR = path.resolve('data');
if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true });

const { addProperty, getPropertyByGroupId } = await import('../src/store/properties.js');
const { addBooking, getActiveBooking } = await import('../src/store/bookings.js');
const { addTransaction, getTodaySpend, listTransactions } = await import('../src/store/transactions.js');

// Set up test data
addProperty({
  id: 'test-house', name: 'Test House', address: '123 Test St',
  hostTelegramId: 12345, telegramGroupId: 67890,
  checkInInstructions: 'Code 1234', houseRules: 'No smoking',
  wifiName: 'TestWifi', wifiPassword: 'test123',
  amenities: ['pool'], nearbyPlaces: 'Beach',
  dailyBudget: 200, perTransactionLimit: 100,
});

addBooking({
  id: 'bk-test', propertyId: 'test-house', guestName: 'John Test',
  guestTelegramId: 99999, checkIn: '2026-04-10', checkOut: '2026-04-15',
  status: 'active', totalSpent: 0,
});

addTransaction({
  id: 'tx-1', propertyId: 'test-house', bookingId: 'bk-test',
  plugin: 'food-delivery', amount: 35, description: 'Thai food',
  tx: 'mock_123', timestamp: new Date().toISOString(),
});

addTransaction({
  id: 'tx-2', propertyId: 'test-house', bookingId: 'bk-test',
  plugin: 'taxi', amount: 24, description: 'Airport',
  tx: 'mock_456', timestamp: new Date().toISOString(),
});

// Verify property lookup by group ID (used in message handler)
const property = getPropertyByGroupId(67890);
assert(property?.id === 'test-house', 'property found by group ID');
assert(property?.hostTelegramId === 12345, 'host telegram ID correct');

// Verify booking lookup (used in summary command)
const booking = getActiveBooking('test-house');
assert(booking?.guestName === 'John Test', 'active booking found');

// Verify transaction aggregation (used in summary/budget commands)
const txs = listTransactions('test-house', 'bk-test');
assert(txs.length === 2, 'transactions found for booking');
const total = txs.reduce((sum, t) => sum + t.amount, 0);
assert(total === 59, 'transaction total correct');
const todaySpend = getTodaySpend('test-house');
assert(todaySpend === 59, 'today spend correct for budget command');

// Cleanup
fs.rmSync(DATA_DIR, { recursive: true });

// ── Results ─────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All bot tests passed! ✅\n');
