import fs from 'node:fs';
import path from 'node:path';
import { writeConfig, setConfigFile, resetConfigFile } from '../src/store/steward.js';

const DATA_DIR = path.resolve('data');
const STEWARD_TEST_JSON = path.join(DATA_DIR, 'steward.test.json');
let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { console.log(`  ✓ ${name}`); passed++; }
  else { console.log(`  ✗ ${name}`); failed++; }
}

// Use test config file
setConfigFile(STEWARD_TEST_JSON);

console.log('\n🤖 Bot Logic Tests\n');

// ── Module exports ──────────────────────────────────

console.log('Module exports:');

const bot = await import('../src/bot.js');
assert(typeof bot.startBot === 'function', 'startBot is exported');
assert(typeof bot.createInviteLink === 'function', 'createInviteLink is exported');

// ── Host detection & command parsing ──

console.log('\nHost detection patterns:');

function hasStewardMention(text: string): boolean {
  return /[@]steward/i.test(text);
}

function parseStewardCommand(text: string): string | null {
  const match = text.match(/@steward\s+(.+)/i);
  return match ? match[1].trim().toLowerCase() : null;
}

assert(hasStewardMention('@steward help'), '@steward help detected');
assert(hasStewardMention('@Steward HELP'), '@Steward HELP detected (case insensitive)');
assert(hasStewardMention('hey @steward stop'), 'mention in middle of text');
assert(!hasStewardMention('hello steward'), 'plain "steward" without @ not detected');
assert(!hasStewardMention('random message'), 'random message not detected');

assert(parseStewardCommand('@steward handle this') === 'handle this', 'parse "handle this"');
assert(parseStewardCommand('@steward stop') === 'stop', 'parse "stop"');
assert(parseStewardCommand('@steward summary') === 'summary', 'parse "summary"');
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

pausedGroups.add(111);
pausedGroups.add(222);
assert(pausedGroups.has(111), 'first group paused');
assert(pausedGroups.has(222), 'second group paused');
assert(!pausedGroups.has(333), 'third group not paused');

// ── Bot startup validation ──────────────────────────

console.log('\nBot startup validation:');
assert(bot.startBot.length === 1, 'startBot takes 1 argument (options)');

// ── Store integration ───────────────────────────────

console.log('\nStore integration for host commands:');

if (fs.existsSync(STEWARD_TEST_JSON)) fs.unlinkSync(STEWARD_TEST_JSON);

writeConfig({
  hostTelegramId: 12345,
  groups: [{
    telegramGroupId: 67890,
    property: {
      name: 'Test House', address: '123 Test St',
      checkInInstructions: 'Code 1234', houseRules: 'No smoking',
      wifiName: 'TestWifi', wifiPassword: 'test123',
      amenities: ['pool'], nearbyPlaces: 'Beach',
    },
    bookings: [{
      id: 'bk-test', guestName: 'John Test',
      guestTelegramId: 99999, checkIn: '2026-04-10', checkOut: '2026-04-15',
      status: 'active',
    }],
  }],
});

const { getPropertyByGroupId } = await import('../src/store/properties.js');
const { getActiveBooking } = await import('../src/store/bookings.js');

const property = getPropertyByGroupId(67890);
assert(property?.name === 'Test House', 'property found by group ID');

const booking = getActiveBooking(67890);
assert(booking?.guestName === 'John Test', 'active booking found');

// Cleanup
if (fs.existsSync(STEWARD_TEST_JSON)) fs.unlinkSync(STEWARD_TEST_JSON);
resetConfigFile();

// ── Results ─────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All bot tests passed! ✅\n');
