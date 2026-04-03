import fs from 'node:fs';
import path from 'node:path';
import { addProperty, listProperties, getProperty, getPropertyByGroupId, updateProperty } from '../src/store/properties.js';
import { addBooking, listBookings, getBooking, getActiveBooking, updateBooking, linkGuest, addGroupMapping, getBookingByGroupId } from '../src/store/bookings.js';
import { addTransaction, listTransactions, getTodaySpend, getTotalSpend } from '../src/store/transactions.js';

const DATA_DIR = path.resolve('data');
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

function cleanup() {
  if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true });
}

// ── Properties ──────────────────────────────────────────

console.log('\n📦 Properties Store');
cleanup();

// Empty state
assert(listProperties().length === 0, 'empty state returns empty array');

// Add property
const prop = {
  id: 'beach-house',
  name: 'Beach House',
  address: '123 Ocean Drive, Miami',
  hostTelegramId: 7883754831,
  checkInInstructions: 'Door code is 4521. Parking spot #3.',
  houseRules: 'No smoking. Quiet after 10pm.',
  wifiName: 'BeachLife2026',
  wifiPassword: 'sunny123',
  amenities: ['pool', 'AC', 'parking', 'washer'],
  nearbyPlaces: 'Whole Foods (5 min), Beach Bar (2 min)',
  dailyBudget: 200,
  perTransactionLimit: 100,
};
addProperty(prop);
assert(listProperties().length === 1, 'add property increases count');
assert(getProperty('beach-house')?.name === 'Beach House', 'get by ID returns correct property');
assert(getProperty('nonexistent') === undefined, 'get missing ID returns undefined');

// Duplicate rejection
let dupRejected = false;
try { addProperty({ ...prop }); } catch { dupRejected = true; }
assert(dupRejected, 'duplicate ID is rejected');

// Update property
updateProperty('beach-house', { telegramGroupId: 67890, dailyBudget: 300 });
assert(getProperty('beach-house')?.telegramGroupId === 67890, 'update sets telegramGroupId');
assert(getProperty('beach-house')?.dailyBudget === 300, 'update sets dailyBudget');
assert(getProperty('beach-house')?.name === 'Beach House', 'update preserves other fields');

// Update nonexistent
let updateFailed = false;
try { updateProperty('fake', { dailyBudget: 50 }); } catch { updateFailed = true; }
assert(updateFailed, 'update nonexistent property throws');

// Get by group ID
assert(getPropertyByGroupId(67890)?.id === 'beach-house', 'get by group ID works');
assert(getPropertyByGroupId(99999) === undefined, 'get by missing group ID returns undefined');

// Multiple properties
addProperty({ ...prop, id: 'city-apt', name: 'City Apartment', telegramGroupId: 11111 });
assert(listProperties().length === 2, 'multiple properties stored');
assert(getPropertyByGroupId(11111)?.id === 'city-apt', 'second property found by group ID');

// ── Bookings ────────────────────────────────────────────

console.log('\n📋 Bookings Store');
cleanup();

// Empty state
assert(listBookings().length === 0, 'empty state returns empty array');

// Add booking
const booking1 = {
  id: 'bk-0410-a3x7',
  propertyId: 'beach-house',
  guestName: 'John Smith',
  checkIn: '2026-04-10',
  checkOut: '2026-04-15',
  preferences: 'Vegetarian, allergic to nuts',
  status: 'pending' as const,
  totalSpent: 0,
};
addBooking(booking1);
assert(listBookings().length === 1, 'add booking increases count');
assert(getBooking('bk-0410-a3x7')?.guestName === 'John Smith', 'get by ID works');
assert(getBooking('nonexistent') === undefined, 'get missing booking returns undefined');

// Duplicate rejection
let bookingDupRejected = false;
try { addBooking({ ...booking1 }); } catch { bookingDupRejected = true; }
assert(bookingDupRejected, 'duplicate booking ID is rejected');

// Filter by property
addBooking({ ...booking1, id: 'bk-0420-b2y8', propertyId: 'city-apt', guestName: 'Jane Doe' });
assert(listBookings().length === 2, 'two bookings total');
assert(listBookings('beach-house').length === 1, 'filter by property works');
assert(listBookings('beach-house')[0].guestName === 'John Smith', 'filter returns correct booking');

// Active booking — none active yet
assert(getActiveBooking('beach-house') === undefined, 'no active booking when all pending');

// Link guest → sets active
linkGuest('bk-0410-a3x7', 12345);
const linked = getBooking('bk-0410-a3x7');
assert(linked?.guestTelegramId === 12345, 'linkGuest sets telegram ID');
assert(linked?.status === 'active', 'linkGuest sets status to active');
assert(getActiveBooking('beach-house')?.id === 'bk-0410-a3x7', 'getActiveBooking finds linked booking');

// Update booking
updateBooking('bk-0410-a3x7', { totalSpent: 59 });
assert(getBooking('bk-0410-a3x7')?.totalSpent === 59, 'update booking works');

// Group mapping
addGroupMapping({ telegramGroupId: 67890, propertyId: 'beach-house', bookingId: 'bk-0410-a3x7' });
assert(getBookingByGroupId(67890)?.id === 'bk-0410-a3x7', 'group mapping resolves booking');
assert(getBookingByGroupId(99999) === undefined, 'missing group mapping returns undefined');

// Overwrite group mapping (new booking for same group)
addGroupMapping({ telegramGroupId: 67890, propertyId: 'beach-house', bookingId: 'bk-0420-b2y8' });
assert(getBookingByGroupId(67890)?.id === 'bk-0420-b2y8', 'group mapping overwrite works');

// ── Transactions ────────────────────────────────────────

console.log('\n💳 Transactions Store');
cleanup();

// Empty state
assert(listTransactions('beach-house').length === 0, 'empty state returns empty array');
assert(getTodaySpend('beach-house') === 0, 'today spend is 0 when empty');
assert(getTotalSpend('bk-0410') === 0, 'total spend is 0 when empty');

// Add transactions
const now = new Date().toISOString();
addTransaction({ id: 'tx-1', propertyId: 'beach-house', bookingId: 'bk-0410', plugin: 'food-delivery', amount: 35, description: 'Thai food for 2', tx: 'mock_food_123', timestamp: now });
addTransaction({ id: 'tx-2', propertyId: 'beach-house', bookingId: 'bk-0410', plugin: 'taxi', amount: 24, description: 'Airport pickup', tx: 'mock_taxi_456', timestamp: now });
addTransaction({ id: 'tx-3', propertyId: 'city-apt', bookingId: 'bk-0420', plugin: 'food-delivery', amount: 50, description: 'Pizza', tx: 'mock_food_789', timestamp: now });

// List by property
assert(listTransactions('beach-house').length === 2, 'list by property returns correct count');
assert(listTransactions('city-apt').length === 1, 'list by other property correct');
assert(listTransactions('nonexistent').length === 0, 'list nonexistent property returns empty');

// List by property + booking
assert(listTransactions('beach-house', 'bk-0410').length === 2, 'filter by property+booking works');
assert(listTransactions('beach-house', 'bk-9999').length === 0, 'filter by wrong booking returns empty');

// Today spend
assert(getTodaySpend('beach-house') === 59, 'today spend sums correctly');
assert(getTodaySpend('city-apt') === 50, 'today spend for other property');
assert(getTodaySpend('nonexistent') === 0, 'today spend for missing property is 0');

// Total spend by booking
assert(getTotalSpend('bk-0410') === 59, 'total spend by booking correct');
assert(getTotalSpend('bk-0420') === 50, 'total spend other booking');
assert(getTotalSpend('bk-9999') === 0, 'total spend missing booking is 0');

// Old transactions don't count for today
addTransaction({ id: 'tx-old', propertyId: 'beach-house', bookingId: 'bk-0410', plugin: 'food-delivery', amount: 100, description: 'Yesterday order', tx: 'mock_old', timestamp: '2025-01-01T12:00:00.000Z' });
assert(getTodaySpend('beach-house') === 59, 'old transactions excluded from today spend');
assert(getTotalSpend('bk-0410') === 159, 'old transactions included in total spend');

// ── Data persistence ────────────────────────────────────

console.log('\n💾 Data Persistence');

// Verify files exist on disk
assert(fs.existsSync(path.join(DATA_DIR, 'transactions.json')), 'transactions.json exists on disk');

// Read raw file and verify structure
const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'transactions.json'), 'utf-8'));
assert(Array.isArray(raw), 'transactions file contains array');
assert(raw.length === 4, 'all 4 transactions persisted');
assert(raw[0].id === 'tx-1', 'first transaction has correct id');

// ── Cleanup ─────────────────────────────────────────────

cleanup();

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All e2e tests passed! ✅\n');
}
