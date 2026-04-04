/**
 * Tests for booking lifecycle events (check-in/check-out day automation).
 */

import fs from 'node:fs';
import path from 'node:path';
import { writeConfig } from '../src/store/steward.js';

const DATA_DIR = path.resolve('data');
const STEWARD_JSON = path.join(DATA_DIR, 'steward.json');
let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { console.log(`  ✓ ${name}`); passed++; }
  else { console.log(`  ✗ ${name}`); failed++; }
}

function cleanup() {
  if (fs.existsSync(STEWARD_JSON)) fs.unlinkSync(STEWARD_JSON);
}

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const { checkLifecycleEvents, resetLifecycleEvents, hasFired, markFired } = await import('../src/lifecycle.js');

// ── Fired events tracking ────────────────────────────

console.log('\n🔄 Lifecycle Event Tracking\n');

assert(!hasFired('bk-test', 'checkin'), 'event not fired initially');
markFired('bk-test', 'checkin');
assert(hasFired('bk-test', 'checkin'), 'event marked as fired');
assert(!hasFired('bk-test', 'checkout'), 'other event not fired');
resetLifecycleEvents();
assert(!hasFired('bk-test', 'checkin'), 'reset clears all events');

// ── Check-in day ─────────────────────────────────────

console.log('\n🏠 Check-in Day\n');

cleanup();
resetLifecycleEvents();

writeConfig({
  hostTelegramId: 11111,
  groups: [{
    telegramGroupId: -100001,
    property: {
      name: 'Beach House', address: '123 Ocean Dr',
      checkInInstructions: 'Code 4521', houseRules: 'No smoking',
      wifiName: 'BeachWifi', wifiPassword: 'sunny123',
      amenities: ['pool', 'gym'], nearbyPlaces: 'Beach 5 min walk',
    },
    bookings: [{
      id: 'bk-checkin', guestName: 'Alice',
      guestTelegramId: 22222,
      checkIn: today, checkOut: tomorrow,
      status: 'pending',
    }],
  }],
});

const checkinMessages = checkLifecycleEvents();
assert(checkinMessages.length === 1, 'one check-in message');
assert(checkinMessages[0].groupId === -100001, 'correct group ID');
assert(checkinMessages[0].text.includes('Welcome, Alice'), 'welcome message includes guest name');
assert(checkinMessages[0].text.includes('Beach House'), 'includes property name');
assert(checkinMessages[0].text.includes('Code 4521'), 'includes check-in instructions');
assert(checkinMessages[0].text.includes('BeachWifi'), 'includes WiFi name');
assert(checkinMessages[0].text.includes('sunny123'), 'includes WiFi password');
assert(checkinMessages[0].text.includes('No smoking'), 'includes house rules');
assert(checkinMessages[0].text.includes('pool'), 'includes amenities');
assert(checkinMessages[0].text.includes('Beach 5 min'), 'includes nearby places');

// Status should transition to active
const { getBooking } = await import('../src/store/bookings.js');
const updated = getBooking('bk-checkin');
assert(updated!.status === 'active', 'status transitioned to active');

// Should not fire again
const repeat = checkLifecycleEvents();
const checkinRepeat = repeat.filter(m => m.text.includes('Welcome, Alice'));
assert(checkinRepeat.length === 0, 'check-in does not repeat');

// ── Check-out day ────────────────────────────────────

console.log('\n👋 Check-out Day\n');

cleanup();
resetLifecycleEvents();

writeConfig({
  hostTelegramId: 11111,
  groups: [{
    telegramGroupId: -100001,
    property: {
      name: 'Beach House', address: '123 Ocean Dr',
      checkInInstructions: 'Code 4521', houseRules: 'No smoking',
      wifiName: 'BeachWifi', wifiPassword: 'sunny123',
      amenities: ['pool', 'gym'], nearbyPlaces: 'Beach 5 min walk',
    },
    bookings: [{
      id: 'bk-checkout', guestName: 'Bob',
      guestTelegramId: 33333,
      checkIn: yesterday, checkOut: today,
      status: 'active',
    }],
  }],
});

const checkoutMessages = checkLifecycleEvents();
const coMsgs = checkoutMessages.filter(m => m.text.includes('Check-out day'));
assert(coMsgs.length === 1, 'one check-out message');
assert(coMsgs[0].text.includes('Bob'), 'includes guest name');
assert(coMsgs[0].text.includes('cleaning'), 'mentions cleaning scheduled');

const checkoutBookingUpdated = getBooking('bk-checkout');
assert(checkoutBookingUpdated!.status === 'checked_out', 'status transitioned to checked_out');

// ── No events for future bookings ────────────────────

console.log('\n📅 No Events for Future Bookings\n');

cleanup();
resetLifecycleEvents();

writeConfig({
  hostTelegramId: 11111,
  groups: [{
    telegramGroupId: -100001,
    property: {
      name: 'Beach House', address: '123 Ocean Dr',
      checkInInstructions: 'Code 4521', houseRules: 'No smoking',
      wifiName: 'BeachWifi', wifiPassword: 'sunny123',
      amenities: ['pool', 'gym'], nearbyPlaces: 'Beach 5 min walk',
    },
    bookings: [{
      id: 'bk-future', guestName: 'Charlie',
      guestTelegramId: 44444,
      checkIn: tomorrow, checkOut: new Date(Date.now() + 172800000).toISOString().slice(0, 10),
      status: 'pending',
    }],
  }],
});

const futureMessages = checkLifecycleEvents();
const futureMsgs = futureMessages.filter(m => m.text.includes('Charlie'));
assert(futureMsgs.length === 0, 'no messages for future bookings');

cleanup();

// ── Results ─────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All lifecycle tests passed! ✅\n');
