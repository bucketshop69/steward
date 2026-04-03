/**
 * Tests for booking lifecycle events (check-in/check-out day automation).
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Property, Booking } from '../src/types.js';

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

// Setup
cleanup();

const { addProperty } = await import('../src/store/properties.js');
const { addBooking, updateBooking, getBooking } = await import('../src/store/bookings.js');
const { addTransaction } = await import('../src/store/transactions.js');
const { checkLifecycleEvents, resetLifecycleEvents, hasFired, markFired } = await import('../src/lifecycle.js');

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const testProperty: Property = {
  id: 'beach-house', name: 'Beach House', address: '123 Ocean Dr',
  hostTelegramId: 11111, telegramGroupId: -100001,
  checkInInstructions: 'Code 4521', houseRules: 'No smoking',
  wifiName: 'BeachWifi', wifiPassword: 'sunny123',
  amenities: ['pool', 'gym'], nearbyPlaces: 'Beach 5 min walk',
  dailyBudget: 200, perTransactionLimit: 100,
};

addProperty(testProperty);

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

resetLifecycleEvents();

const checkinBooking: Booking = {
  id: 'bk-checkin', propertyId: 'beach-house', guestName: 'Alice',
  guestTelegramId: 22222, telegramGroupId: -100001,
  checkIn: today, checkOut: tomorrow,
  status: 'pending', totalSpent: 0,
};
addBooking(checkinBooking);

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
const updated = getBooking('bk-checkin');
assert(updated!.status === 'active', 'status transitioned to active');

// Should not fire again
const repeat = checkLifecycleEvents();
const checkinRepeat = repeat.filter(m => m.text.includes('Welcome, Alice'));
assert(checkinRepeat.length === 0, 'check-in does not repeat');

// ── Check-out day ────────────────────────────────────

console.log('\n👋 Check-out Day\n');

resetLifecycleEvents();

const checkoutBooking: Booking = {
  id: 'bk-checkout', propertyId: 'beach-house', guestName: 'Bob',
  guestTelegramId: 33333, telegramGroupId: -100001,
  checkIn: yesterday, checkOut: today,
  status: 'active', totalSpent: 0,
};
addBooking(checkoutBooking);

// Add some transactions
addTransaction({
  id: 'tx-1', propertyId: 'beach-house', bookingId: 'bk-checkout',
  plugin: 'food-delivery', amount: 35, description: 'Thai food', tx: 'mock_1',
  timestamp: new Date().toISOString(),
});
addTransaction({
  id: 'tx-2', propertyId: 'beach-house', bookingId: 'bk-checkout',
  plugin: 'food-delivery', amount: 25, description: 'Pizza', tx: 'mock_2',
  timestamp: new Date().toISOString(),
});
addTransaction({
  id: 'tx-3', propertyId: 'beach-house', bookingId: 'bk-checkout',
  plugin: 'taxi', amount: 50, description: 'Airport', tx: 'mock_3',
  timestamp: new Date().toISOString(),
});

const checkoutMessages = checkLifecycleEvents();
// Filter to just checkout messages (check-in for bk-checkin might fire too)
const coMsgs = checkoutMessages.filter(m => m.text.includes('Check-out day'));
assert(coMsgs.length === 1, 'one check-out message');
assert(coMsgs[0].text.includes('Bob'), 'includes guest name');
assert(coMsgs[0].text.includes('food-delivery'), 'includes food-delivery in summary');
assert(coMsgs[0].text.includes('taxi'), 'includes taxi in summary');
assert(coMsgs[0].text.includes('$110'), 'includes total amount');
assert(coMsgs[0].text.includes('cleaning'), 'mentions cleaning scheduled');

const checkoutBookingUpdated = getBooking('bk-checkout');
assert(checkoutBookingUpdated!.status === 'checked_out', 'status transitioned to checked_out');

// ── No events for future bookings ────────────────────

console.log('\n📅 No Events for Future Bookings\n');

resetLifecycleEvents();

const futureBooking: Booking = {
  id: 'bk-future', propertyId: 'beach-house', guestName: 'Charlie',
  guestTelegramId: 44444, telegramGroupId: -100001,
  checkIn: tomorrow, checkOut: new Date(Date.now() + 172800000).toISOString().slice(0, 10),
  status: 'pending', totalSpent: 0,
};
addBooking(futureBooking);

const futureMessages = checkLifecycleEvents();
// bk-checkin fires (today is check-in), bk-checkout might fire, but bk-future should not
const futureMsgs = futureMessages.filter(m => m.text.includes('Charlie'));
assert(futureMsgs.length === 0, 'no messages for future bookings');

// ── No events for bookings without group ─────────────

console.log('\n🚫 No Events Without Group\n');

resetLifecycleEvents();

const noGroupBooking: Booking = {
  id: 'bk-nogroup', propertyId: 'beach-house', guestName: 'Dave',
  checkIn: today, checkOut: tomorrow,
  status: 'pending', totalSpent: 0,
};
addBooking(noGroupBooking);

const noGroupMessages = checkLifecycleEvents();
const daveMsgs = noGroupMessages.filter(m => m.text.includes('Dave'));
assert(daveMsgs.length === 0, 'no messages for bookings without telegram group');

cleanup();

// ── Results ─────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All lifecycle tests passed! ✅\n');
