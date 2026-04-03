import fs from 'node:fs';
import path from 'node:path';

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

async function seed() {
  const { addProperty } = await import('../src/store/properties.js');
  const { addBooking } = await import('../src/store/bookings.js');
  const { addTransaction } = await import('../src/store/transactions.js');

  addProperty({
    id: 'beach-house', name: 'Beach House', address: '123 Ocean Dr',
    hostTelegramId: 11111, telegramGroupId: 67890,
    checkInInstructions: 'Door code 4521', houseRules: 'No smoking',
    wifiName: 'BeachLife', wifiPassword: 'sunny123',
    amenities: ['pool', 'AC'], nearbyPlaces: 'Beach Bar (2 min)',
    dailyBudget: 200, perTransactionLimit: 100,
  });

  addBooking({
    id: 'bk-0410', propertyId: 'beach-house', guestName: 'John Smith',
    guestTelegramId: 22222, checkIn: '2026-04-10', checkOut: '2026-04-15',
    preferences: 'Vegetarian, no nuts', status: 'active', totalSpent: 0,
  });

  addBooking({
    id: 'bk-pending', propertyId: 'beach-house', guestName: 'Jane Doe',
    checkIn: '2026-05-01', checkOut: '2026-05-05',
    status: 'pending', totalSpent: 0,
  });

  addTransaction({
    id: 'tx-1', propertyId: 'beach-house', bookingId: 'bk-0410',
    plugin: 'food-delivery', amount: 35, description: 'Thai food',
    tx: 'mock_123', timestamp: new Date().toISOString(),
  });
}

// ── Context Tools ───────────────────────────────────

console.log('\n🔧 Context Tools\n');
cleanup();
await seed();

const { getPropertyByGroup, identifyUser, getBooking } = await import('../src/tools/context.js');

console.log('getPropertyByGroup:');
const prop = getPropertyByGroup(67890);
assert(prop?.id === 'beach-house', 'finds property by group ID');
assert(getPropertyByGroup(99999) === undefined, 'returns undefined for unknown group');

console.log('\nidentifyUser:');
const host = identifyUser(11111, 'beach-house');
assert(host.role === 'host', 'identifies host');

const guest = identifyUser(22222, 'beach-house');
assert(guest.role === 'guest', 'identifies guest');
assert(guest.name === 'John Smith', 'returns guest name');
assert(guest.booking?.id === 'bk-0410', 'returns guest booking');

const unknown = identifyUser(99999, 'beach-house');
assert(unknown.role === 'unknown', 'identifies unknown user');

console.log('\ngetBooking:');
const booking = getBooking('beach-house');
assert(booking?.id === 'bk-0410', 'finds active booking');
assert(booking?.budgetRemaining !== undefined, 'includes budget remaining');
assert(booking!.budgetRemaining === 165, 'budget remaining = 200 - 35');

const specific = getBooking('beach-house', 'bk-pending');
assert(specific?.guestName === 'Jane Doe', 'finds specific booking by ID');

assert(getBooking('nonexistent') === undefined, 'returns undefined for unknown property');

// ── Property Tools ──────────────────────────────────

console.log('\n🏠 Property Tools\n');

const { getPropertyInfo } = await import('../src/tools/property.js');

const info = getPropertyInfo('beach-house');
assert(info !== undefined, 'returns property info');
assert(info!.wifiName === 'BeachLife', 'includes WiFi name');
assert(info!.checkInInstructions === 'Door code 4521', 'includes check-in instructions');
assert(!('hostTelegramId' in info!), 'excludes hostTelegramId');
assert(!('telegramGroupId' in info!), 'excludes telegramGroupId');
assert(getPropertyInfo('nonexistent') === undefined, 'returns undefined for unknown');

// ── Budget Tools ────────────────────────────────────

console.log('\n💰 Budget Tools\n');

const { checkBudget, getTransactionHistory } = await import('../src/tools/budget.js');

console.log('checkBudget:');
const ok = checkBudget('beach-house', 50);
assert(ok.allowed === true, 'allows within budget');
assert(ok.spentToday === 35, 'reports today spend');

const overTx = checkBudget('beach-house', 150);
assert(overTx.allowed === false, 'rejects over per-tx limit');
assert(overTx.reason!.includes('per-transaction'), 'reason mentions per-transaction');

// To test daily budget: need spentToday + amount > 200, with amount <= 100
// Current spend: $35. Add more to push it to $160, then $50 would exceed $200
const { addTransaction: addTx } = await import('../src/store/transactions.js');
addTx({ id: 'tx-pad', propertyId: 'beach-house', bookingId: 'bk-0410', plugin: 'taxi', amount: 125, description: 'Padding', tx: 'mock_pad', timestamp: new Date().toISOString() });
// Now spent today = $160
const overDaily = checkBudget('beach-house', 50);
assert(overDaily.allowed === false, 'rejects over daily budget');
assert(overDaily.reason!.includes('daily budget'), 'reason mentions daily budget');

const noProperty = checkBudget('nonexistent', 10);
assert(noProperty.allowed === false, 'rejects unknown property');

console.log('\ngetTransactionHistory:');
const history = getTransactionHistory('beach-house', 'bk-0410');
assert(history.transactions.length >= 1, 'returns transactions');
assert(history.totalSpent >= 35, 'correct total (includes padding tx)');
assert(history.dailyBudget === 200, 'includes daily budget');

// ── Onboarding Tools ────────────────────────────────

console.log('\n👋 Onboarding Tools\n');

const { linkGuest } = await import('../src/tools/onboarding.js');

const linked = linkGuest(33333, 'beach-house');
assert(linked.success === true, 'links guest to pending booking');
assert(linked.booking?.guestName === 'Jane Doe', 'returns correct booking');
assert(linked.booking?.guestTelegramId === 33333, 'telegram ID set');
assert(linked.property?.id === 'beach-house', 'returns property');

// Idempotent
const relink = linkGuest(33333, 'beach-house', 'bk-pending');
assert(relink.success === true, 'idempotent re-link works');

const noBooking = linkGuest(44444, 'beach-house');
assert(noBooking.success === false, 'fails when no pending booking');

// ── Escalation Tools ────────────────────────────────

console.log('\n🚨 Escalation Tools\n');

const { escalateToHost } = await import('../src/tools/escalate.js');

const escalation = escalateToHost('beach-house', 'AC broken, guest tried reset', 'high');
assert(escalation.message.includes('🚨'), 'high urgency has alarm emoji');
assert(escalation.message.includes('AC broken'), 'includes reason');
assert(escalation.hostTelegramId === 11111, 'returns host telegram ID');

const lowEscalation = escalateToHost('beach-house', 'Guest wants extra towels', 'low');
assert(lowEscalation.message.includes('ℹ️'), 'low urgency has info emoji');

// ── Cleanup ─────────────────────────────────────────

cleanup();

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All tools tests passed! ✅\n');
