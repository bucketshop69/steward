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

function cleanup() {
  if (fs.existsSync(STEWARD_TEST_JSON)) fs.unlinkSync(STEWARD_TEST_JSON);
}

// Use test config file
setConfigFile(STEWARD_TEST_JSON);

function seed() {
  writeConfig({
    hostTelegramId: 11111,
    groups: [
      {
        telegramGroupId: 67890,
        property: {
          name: 'Beach House', address: '123 Ocean Dr',
          checkInInstructions: 'Door code 4521', houseRules: 'No smoking',
          wifiName: 'BeachLife', wifiPassword: 'sunny123',
          amenities: ['pool', 'AC'], nearbyPlaces: 'Beach Bar (2 min)',
        },
        bookings: [
          {
            id: 'bk-0410', guestName: 'John Smith',
            guestTelegramId: 22222, checkIn: '2026-04-10', checkOut: '2026-04-15',
            preferences: 'Vegetarian, no nuts', status: 'active',
          },
          {
            id: 'bk-pending', guestName: 'Jane Doe',
            checkIn: '2026-05-01', checkOut: '2026-05-05',
            status: 'pending',
          },
        ],
      },
    ],
  });
}

// ── Context Tools ───────────────────────────────────

console.log('\n🔧 Context Tools\n');
cleanup();
seed();

const { getPropertyByGroup, identifyUser, getBooking } = await import('../src/tools/context.js');

console.log('getPropertyByGroup:');
const prop = getPropertyByGroup(67890);
assert(prop?.name === 'Beach House', 'finds property by group ID');
assert(getPropertyByGroup(99999) === undefined, 'returns undefined for unknown group');

console.log('\nidentifyUser:');
const host = identifyUser(11111, 67890);
assert(host.role === 'host', 'identifies host');

const guest = identifyUser(22222, 67890);
assert(guest.role === 'guest', 'identifies guest');
assert(guest.name === 'John Smith', 'returns guest name');
assert(guest.booking?.id === 'bk-0410', 'returns guest booking');

const unknown = identifyUser(99999, 67890);
assert(unknown.role === 'unknown', 'identifies unknown user');

console.log('\ngetBooking:');
const booking = getBooking(67890);
assert(booking?.id === 'bk-0410', 'finds active booking');

const specific = getBooking(67890, 'bk-pending');
assert(specific?.guestName === 'Jane Doe', 'finds specific booking by ID');

assert(getBooking(99999) === undefined, 'returns undefined for unknown group');

// ── Property Tools ──────────────────────────────────

console.log('\n🏠 Property Tools\n');

const { getPropertyInfo } = await import('../src/tools/property.js');

const info = getPropertyInfo(67890);
assert(info !== undefined, 'returns property info');
assert(info!.wifiName === 'BeachLife', 'includes WiFi name');
assert(info!.checkInInstructions === 'Door code 4521', 'includes check-in instructions');
assert(getPropertyInfo(99999) === undefined, 'returns undefined for unknown');

// ── Onboarding Tools ────────────────────────────────

console.log('\n👋 Onboarding Tools\n');

const { linkGuest } = await import('../src/tools/onboarding.js');

const linked = linkGuest(33333, 67890);
assert(linked.success === true, 'links guest to pending booking');
assert(linked.booking?.guestName === 'Jane Doe', 'returns correct booking');
assert(linked.booking?.guestTelegramId === 33333, 'telegram ID set');

// Idempotent
const relink = linkGuest(33333, 67890, 'bk-pending');
assert(relink.success === true, 'idempotent re-link works');

const noBooking = linkGuest(44444, 67890);
assert(noBooking.success === false, 'fails when no pending booking');

// ── Escalation Tools ────────────────────────────────

console.log('\n🚨 Escalation Tools\n');

const { escalateToHost } = await import('../src/tools/escalate.js');

const escalation = escalateToHost(67890, 'AC broken, guest tried reset', 'high');
assert(escalation.message.includes('🚨'), 'high urgency has alarm emoji');
assert(escalation.message.includes('AC broken'), 'includes reason');
assert(escalation.hostTelegramId === 11111, 'returns host telegram ID');

const lowEscalation = escalateToHost(67890, 'Guest wants extra towels', 'low');
assert(lowEscalation.message.includes('ℹ️'), 'low urgency has info emoji');

// ── Cleanup ─────────────────────────────────────────

cleanup();
resetConfigFile();

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All tools tests passed! ✅\n');
