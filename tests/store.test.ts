import fs from 'node:fs';
import path from 'node:path';
import { readConfig, writeConfig, setConfigFile, resetConfigFile } from '../src/store/steward.js';
import { addProperty, listProperties, getPropertyByGroupId, updateProperty, getHostTelegramId } from '../src/store/properties.js';
import { addBooking, listBookings, getBooking, getActiveBooking, updateBooking, getBookingByGroupId } from '../src/store/bookings.js';

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

// ── Steward Config ─────────────────────────────────────

console.log('\n📦 Steward Config\n');
cleanup();

const emptyConfig = readConfig();
assert(emptyConfig.hostTelegramId === 0, 'empty config has hostTelegramId 0');
assert(emptyConfig.groups.length === 0, 'empty config has no groups');

writeConfig({ hostTelegramId: 1111111111, groups: [] });
const loaded = readConfig();
assert(loaded.hostTelegramId === 1111111111, 'config persisted and loaded');

// ── Properties ─────────────────────────────────────────

console.log('\n🏠 Properties\n');
cleanup();
writeConfig({ hostTelegramId: 1111111111, groups: [] });

assert(listProperties().length === 0, 'no properties initially');

addProperty(-100, {
  name: 'Beach House', address: '123 Ocean Dr',
  checkInInstructions: 'Code 4521', houseRules: 'No smoking',
  wifiName: 'Beach5G', wifiPassword: 'sunny123',
  amenities: ['pool', 'AC'], nearbyPlaces: 'Beach 2 min',
});
assert(listProperties().length === 1, 'property added');
assert(getPropertyByGroupId(-100)?.name === 'Beach House', 'found by group ID');
assert(getPropertyByGroupId(-999) === undefined, 'unknown group returns undefined');
assert(getHostTelegramId() === 1111111111, 'host telegram ID correct');

// Duplicate group rejection
let dupRejected = false;
try {
  addProperty(-100, { name: 'Dup', address: '', checkInInstructions: '', houseRules: '', wifiName: '', wifiPassword: '', amenities: [], nearbyPlaces: '' });
} catch { dupRejected = true; }
assert(dupRejected, 'duplicate group ID rejected');

// Update property
updateProperty(-100, { wifiPassword: 'newpass' });
assert(getPropertyByGroupId(-100)?.wifiPassword === 'newpass', 'property updated');
assert(getPropertyByGroupId(-100)?.name === 'Beach House', 'other fields preserved');

// Second property
addProperty(-200, {
  name: 'City Apt', address: '456 Main St',
  checkInInstructions: 'Buzzer #3', houseRules: 'Quiet after 10',
  wifiName: 'City5G', wifiPassword: 'city123',
  amenities: ['kitchen'], nearbyPlaces: 'Mall 5 min',
});
assert(listProperties().length === 2, 'two properties');
assert(getPropertyByGroupId(-200)?.name === 'City Apt', 'second property found');

// ── Bookings ───────────────────────────────────────────

console.log('\n📋 Bookings\n');

assert(listBookings(-100).length === 0, 'no bookings initially');

addBooking(-100, {
  id: 'bk-001', guestName: 'Alice', checkIn: '2026-04-10', checkOut: '2026-04-15',
  preferences: 'Vegetarian', status: 'pending',
});
assert(listBookings(-100).length === 1, 'booking added');
assert(getBooking('bk-001')?.guestName === 'Alice', 'found by ID');
assert(getBooking('bk-999') === undefined, 'unknown booking returns undefined');

// Duplicate booking rejection
let bookingDup = false;
try { addBooking(-100, { id: 'bk-001', guestName: 'Dup', checkIn: '2026-04-10', checkOut: '2026-04-15', status: 'pending' }); } catch { bookingDup = true; }
assert(bookingDup, 'duplicate booking ID rejected');

// Active booking — none yet
assert(getActiveBooking(-100) === undefined, 'no active booking when pending');

// Update to active
updateBooking('bk-001', { guestTelegramId: 2222222222, status: 'active' });
assert(getBooking('bk-001')?.status === 'active', 'booking updated to active');
assert(getBooking('bk-001')?.guestTelegramId === 2222222222, 'guest linked');
assert(getActiveBooking(-100)?.id === 'bk-001', 'active booking found');
assert(getBookingByGroupId(-100)?.id === 'bk-001', 'booking found by group ID');

// Second booking in different group
addBooking(-200, {
  id: 'bk-002', guestName: 'Bob', checkIn: '2026-04-20', checkOut: '2026-04-25', status: 'active',
});
assert(listBookings().length === 2, 'two bookings total across groups');
assert(listBookings(-200).length === 1, 'one booking in second group');
assert(getActiveBooking(-200)?.guestName === 'Bob', 'active booking in second group');

// ── Data Persistence ───────────────────────────────────

console.log('\n💾 Persistence\n');

assert(fs.existsSync(STEWARD_TEST_JSON), 'steward.test.json exists');
const raw = JSON.parse(fs.readFileSync(STEWARD_TEST_JSON, 'utf-8'));
assert(raw.hostTelegramId === 1111111111, 'host ID persisted');
assert(raw.groups.length === 2, 'two groups persisted');
assert(raw.groups[0].bookings.length === 1, 'bookings nested under group');

// ── Cleanup ────────────────────────────────────────────

cleanup();
resetConfigFile();

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All store tests passed! ✅\n');
