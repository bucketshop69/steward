/**
 * Tests for host-facing tools (add_property, add_booking, list, status).
 */

import fs from 'node:fs';
import path from 'node:path';
import { writeConfig, setConfigFile, resetConfigFile } from '../src/store/steward.js';
import { addPropertyTool, addBookingTool, listPropertiesTool, listBookingsTool, getStatusTool } from '../src/tools/host.js';

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

// Use test config
setConfigFile(STEWARD_TEST_JSON);
cleanup();
writeConfig({ hostTelegramId: 11111, groups: [] });

// ── Add Property ────────────────────────────────────

console.log('\n🏠 Host Tool: add_property\n');

const addResult = addPropertyTool({
  telegram_group_id: -100001,
  name: 'Beach House',
  address: '123 Ocean Dr',
  check_in_instructions: 'Code 4521',
  house_rules: 'No smoking',
  wifi_name: 'BeachWifi',
  wifi_password: 'sunny123',
  amenities: ['pool', 'AC'],
  nearby_places: 'Beach 2 min',
});

assert(addResult.success === true, 'add property succeeds');

// Duplicate
const dupResult = addPropertyTool({
  telegram_group_id: -100001,
  name: 'Dup', address: '', check_in_instructions: '', house_rules: '',
  wifi_name: '', wifi_password: '', amenities: [], nearby_places: '',
});
assert(dupResult.success === false, 'duplicate group rejected');
assert(dupResult.error !== undefined, 'has error message');

// Second property
addPropertyTool({
  telegram_group_id: -100002,
  name: 'City Apt',
  address: '456 Main St',
  check_in_instructions: 'Buzzer #3',
  house_rules: 'Quiet after 10',
  wifi_name: 'CityWifi',
  wifi_password: 'city123',
  amenities: ['gym'],
  nearby_places: 'Mall 5 min',
});

// ── List Properties ─────────────────────────────────

console.log('\n📋 Host Tool: list_properties\n');

const listResult = listPropertiesTool();
assert(listResult.properties.length === 2, 'two properties listed');
assert(listResult.properties[0].name === 'Beach House', 'first property name');
assert(listResult.properties[0].group_id === -100001, 'first property group ID');
assert(listResult.properties[1].name === 'City Apt', 'second property name');

// ── Add Booking ─────────────────────────────────────

console.log('\n📅 Host Tool: add_booking\n');

const bookResult = addBookingTool({
  group_id: -100001,
  guest_name: 'Alice Smith',
  check_in: '2026-04-10',
  check_out: '2026-04-15',
  preferences: 'Vegetarian',
  guest_telegram_username: '@alice',
});

assert(bookResult.success === true, 'add booking succeeds');
assert(bookResult.booking_id?.startsWith('bk-0410-'), 'booking ID format correct');

// Invalid group
const badBooking = addBookingTool({
  group_id: -999999,
  guest_name: 'Nobody',
  check_in: '2026-05-01',
  check_out: '2026-05-05',
});
assert(badBooking.success === false, 'booking to unknown group fails');

// Second booking
addBookingTool({
  group_id: -100002,
  guest_name: 'Bob Jones',
  check_in: '2026-04-20',
  check_out: '2026-04-25',
});

// ── List Bookings ───────────────────────────────────

console.log('\n📋 Host Tool: list_bookings\n');

const allBookings = listBookingsTool({});
assert(allBookings.bookings.length === 2, 'two bookings total');
assert(allBookings.bookings[0].guest_name === 'Alice Smith', 'first guest');
assert(allBookings.bookings[0].property_name === 'Beach House', 'property name included');

const filtered = listBookingsTool({ group_id: -100002 });
assert(filtered.bookings.length === 1, 'filtered to one booking');
assert(filtered.bookings[0].guest_name === 'Bob Jones', 'correct filtered guest');

// ── Get Status ──────────────────────────────────────

console.log('\n📊 Host Tool: get_status\n');

const status = getStatusTool();
assert(status.properties_count === 2, 'two properties');
assert(status.pending_bookings === 2, 'two pending bookings');
assert(status.active_bookings === 0, 'no active bookings');
assert(status.properties.length === 2, 'properties listed in status');
assert(status.properties[0].active_guest === 'Alice Smith', 'shows pending guest');

// ── Cleanup ─────────────────────────────────────────

cleanup();
resetConfigFile();

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All host tools tests passed! ✅\n');
