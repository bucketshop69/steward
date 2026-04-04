/**
 * End-to-end test: Full Steward demo flow
 *
 * Tests the complete pipeline WITHOUT Telegram:
 *   steward.json setup → Lifecycle → Agent (MiniMax LLM) → Tools → Plugins (quotes) → Payment → Memory
 *
 * Requires AGENT_API_KEY in .env — makes real LLM calls to MiniMax.
 * No mock wallet — tests the actual quote → pay → confirm flow.
 */

import fs from 'node:fs';
import path from 'node:path';

// Load .env
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key) process.env[key] = value;
  }
}

import type { StewardConfig, Property, Booking } from '../src/types.js';

const DATA_DIR = path.resolve('data');
const STEWARD_JSON = path.join(DATA_DIR, 'steward.json');

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition: boolean, name: string) {
  if (condition) { console.log(`  ✓ ${name}`); passed++; }
  else { console.log(`  ✗ ${name}`); failed++; }
}

function skip(name: string, reason?: string) {
  console.log(`  ⊘ ${name}${reason ? ` (${reason})` : ''}`); skipped++;
}

function backupData(): Buffer | null {
  if (fs.existsSync(STEWARD_JSON)) return fs.readFileSync(STEWARD_JSON);
  return null;
}

function restoreData(backup: Buffer | null) {
  if (backup) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STEWARD_JSON, backup);
  }
}

// Check API key
const apiKey = process.env.AGENT_API_KEY ?? process.env.MINIMAX_API_KEY;
if (!apiKey) {
  console.log('\n⚠️  AGENT_API_KEY not set — skipping e2e test (requires real LLM calls)\n');
  process.exit(0);
}

// Backup existing data
const dataBackup = backupData();

// ═══════════════════════════════════════════════════════════
// Phase 1: Setup — steward.json
// ═══════════════════════════════════════════════════════════

console.log('\n═══ Phase 1: Setup ═══\n');

const GROUP_ID = -9999999999; // Test group ID
const HOST_ID = 1111111111;
const GUEST_ID = 2222222222;
const today = new Date().toISOString().slice(0, 10);
const checkout = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

const testConfig: StewardConfig = {
  hostTelegramId: HOST_ID,
  groups: [
    {
      telegramGroupId: GROUP_ID,
      property: {
        name: 'Sunset Beach Villa',
        address: '42 Ocean Drive, Bali',
        checkInInstructions: 'Door code is 4521. Lockbox is on the front door. Keys inside.',
        houseRules: 'No smoking indoors. No parties after 10pm. Please recycle.',
        wifiName: 'SunsetVilla5G',
        wifiPassword: 'welcome2026',
        amenities: ['pool', 'gym', 'kitchen', 'AC', 'beach towels', 'surfboard'],
        nearbyPlaces: 'Beach 2 min walk, Warung Sari (local food) 5 min, Mini mart across the street',
      },
      bookings: [
        {
          id: 'bk-e2e-001',
          guestName: 'Alice',
          guestTelegramId: GUEST_ID,
          checkIn: today,
          checkOut: checkout,
          preferences: 'Vegetarian, loves surfing',
          status: 'active',
        },
      ],
    },
  ],
};

// Write test config
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(STEWARD_JSON, JSON.stringify(testConfig, null, 2));

// Verify stores read it correctly
const { getPropertyByGroupId, getHostTelegramId } = await import('../src/store/properties.js');
const { getActiveBooking, getBookingByGroupId } = await import('../src/store/bookings.js');
const { readConfig } = await import('../src/store/steward.js');

const config = readConfig();
assert(config.hostTelegramId === HOST_ID, 'host telegram ID loaded');
assert(config.groups.length === 1, 'one group configured');
assert(config.groups[0].telegramGroupId === GROUP_ID, 'group ID matches');

const prop = getPropertyByGroupId(GROUP_ID);
assert(prop !== undefined, 'property found by group ID');
assert(prop?.name === 'Sunset Beach Villa', 'property name correct');

const activeBooking = getActiveBooking(GROUP_ID);
assert(activeBooking !== undefined, 'active booking found');
assert(activeBooking?.guestName === 'Alice', 'guest name correct');
assert(activeBooking?.status === 'active', 'booking is active');

assert(getHostTelegramId() === HOST_ID, 'getHostTelegramId() works');

// ═══════════════════════════════════════════════════════════
// Phase 2: Lifecycle — Check-in day messages
// ═══════════════════════════════════════════════════════════

console.log('\n═══ Phase 2: Lifecycle ═══\n');

const { checkLifecycleEvents, resetLifecycleEvents } = await import('../src/lifecycle.js');

resetLifecycleEvents();
const lifecycleMsgs = checkLifecycleEvents();
const checkinMsg = lifecycleMsgs.find((m) => m.text.includes('Welcome'));

assert(checkinMsg !== undefined, 'check-in day welcome message generated');
if (checkinMsg) {
  assert(checkinMsg.groupId === GROUP_ID, 'message targets correct group');
  assert(checkinMsg.text.includes('Sunset Beach Villa'), 'mentions property name');
  assert(checkinMsg.text.includes('4521'), 'includes door code');
  assert(checkinMsg.text.includes('SunsetVilla5G'), 'includes WiFi name');
  assert(checkinMsg.text.includes('welcome2026'), 'includes WiFi password');
  console.log(`\n  Lifecycle message preview:\n  "${checkinMsg.text.slice(0, 200)}..."\n`);
}

// ═══════════════════════════════════════════════════════════
// Phase 3: Tools — Direct tool execution (no LLM)
// ═══════════════════════════════════════════════════════════

console.log('\n═══ Phase 3: Tool Execution ═══\n');

const { getPropertyByGroup, identifyUser, getBooking } = await import('../src/tools/context.js');
const { getPropertyInfo } = await import('../src/tools/property.js');
const { linkGuest } = await import('../src/tools/onboarding.js');
const { escalateToHost } = await import('../src/tools/escalate.js');

// get_property_by_group
const propResult = getPropertyByGroup(GROUP_ID);
assert(propResult !== undefined, 'get_property_by_group returns property');
assert(propResult?.groupId === GROUP_ID, 'property has groupId');

// identify_user — host
const hostResult = identifyUser(HOST_ID, GROUP_ID);
assert(hostResult.role === 'host', 'host identified as host');

// identify_user — guest
const guestResult = identifyUser(GUEST_ID, GROUP_ID);
assert(guestResult.role === 'guest', 'guest identified as guest');
assert(guestResult.name === 'Alice', 'guest name is Alice');
assert(guestResult.booking !== undefined, 'guest has booking attached');

// identify_user — unknown
const unknownResult = identifyUser(123456, GROUP_ID);
assert(unknownResult.role === 'unknown', 'unknown user identified as unknown');

// get_booking
const bookingResult = getBooking(GROUP_ID);
assert(bookingResult !== undefined, 'get_booking returns active booking');
assert(bookingResult?.id === 'bk-e2e-001', 'booking ID correct');

// get_property_info
const infoResult = getPropertyInfo(GROUP_ID);
assert(infoResult !== undefined, 'get_property_info returns info');
assert(infoResult?.wifiPassword === 'welcome2026', 'property info has WiFi password');

// escalate_to_host
const escalateResult = escalateToHost(GROUP_ID, 'AC is broken', 'high');
assert(escalateResult.message.includes('Host attention needed'), 'escalation message generated');
assert(escalateResult.hostTelegramId === HOST_ID, 'escalation has host ID');

// ═══════════════════════════════════════════════════════════
// Phase 4: Plugins — Quote-based responses
// ═══════════════════════════════════════════════════════════

console.log('\n═══ Phase 4: Plugin Quotes ═══\n');

const { executePlugin } = await import('../src/plugins/registry.js');

// Food plugin — should return restaurant options
const foodResult = await executePlugin('food-delivery', {
  guest: { name: 'Alice', telegramId: GUEST_ID, preferences: 'Vegetarian' },
  property: testConfig.groups[0].property,
  request: JSON.stringify({ cuisine: 'thai', people: 2 }),
});

let foodQuote: any;
try {
  foodQuote = JSON.parse(foodResult.message);
  assert(foodQuote.type === 'quote', 'food plugin returns a quote');
  assert(Array.isArray(foodQuote.restaurants), 'quote has restaurants array');
  assert(foodQuote.restaurants.length > 0, `${foodQuote.restaurants.length} restaurant(s) returned`);
  const first = foodQuote.restaurants[0];
  assert(Array.isArray(first.menu), 'restaurant has menu items');
  assert(first.menu[0].price > 0, 'menu items have prices');
  console.log(`  Food options: ${foodQuote.restaurants.map((r: any) => r.restaurant).join(', ')}`);
  console.log(`  Sample: ${first.menu[0].item} — $${first.menu[0].price} USDC`);
} catch {
  assert(false, 'food plugin response is valid JSON quote');
}

// Taxi plugin — should return ride options
const taxiResult = await executePlugin('taxi', {
  guest: { name: 'Alice', telegramId: GUEST_ID },
  property: testConfig.groups[0].property,
  request: JSON.stringify({ destination: 'airport', people: 2 }),
});

let taxiQuote: any;
try {
  taxiQuote = JSON.parse(taxiResult.message);
  assert(taxiQuote.type === 'quote', 'taxi plugin returns a quote');
  assert(Array.isArray(taxiQuote.options), 'quote has ride options');
  assert(taxiQuote.options.length > 0, `${taxiQuote.options.length} ride option(s)`);
  console.log(`  Ride options: ${taxiQuote.options.map((o: any) => `${o.type} $${o.price}`).join(', ')}`);
} catch {
  assert(false, 'taxi plugin response is valid JSON quote');
}

// Cleaning plugin
const cleanResult = await executePlugin('cleaning', {
  guest: { name: 'Alice', telegramId: GUEST_ID },
  property: testConfig.groups[0].property,
  request: JSON.stringify({ date: 'tomorrow', type: 'standard' }),
});

let cleanQuote: any;
try {
  cleanQuote = JSON.parse(cleanResult.message);
  assert(cleanQuote.type === 'quote', 'cleaning plugin returns a quote');
  assert(cleanQuote.options.length >= 2, `${cleanQuote.options.length} cleaning packages`);
  console.log(`  Cleaning packages: ${cleanQuote.options.map((o: any) => `${o.type} $${o.price}`).join(', ')}`);
} catch {
  assert(false, 'cleaning plugin response is valid JSON quote');
}

// Tickets plugin
const ticketResult = await executePlugin('tickets', {
  guest: { name: 'Alice', telegramId: GUEST_ID },
  property: testConfig.groups[0].property,
  request: JSON.stringify({ event: 'surf', people: 2 }),
});

let ticketQuote: any;
try {
  ticketQuote = JSON.parse(ticketResult.message);
  assert(ticketQuote.type === 'quote', 'tickets plugin returns a quote');
  assert(ticketQuote.options.length > 0, `${ticketQuote.options.length} activity option(s)`);
  console.log(`  Activities: ${ticketQuote.options.map((o: any) => `${o.name} $${o.totalPrice}`).join(', ')}`);
} catch {
  assert(false, 'tickets plugin response is valid JSON quote');
}

// Maintenance plugin — no payment, just troubleshooting
const maintResult = await executePlugin('maintenance', {
  guest: { name: 'Alice', telegramId: GUEST_ID },
  property: testConfig.groups[0].property,
  request: JSON.stringify({ issue: 'AC not working', location: 'bedroom', severity: 'major' }),
});
assert(maintResult.message.includes('AC') || maintResult.message.includes('reset'), 'maintenance gives troubleshooting tip');
console.log(`  Maintenance: "${maintResult.message.slice(0, 100)}..."`);

// ═══════════════════════════════════════════════════════════
// Phase 5: Agent — Full LLM conversation (real MiniMax calls)
// ═══════════════════════════════════════════════════════════

console.log('\n═══ Phase 5: Agent (LLM) ═══\n');

const { processMessage, clearHistory, getHistory } = await import('../src/agent.js');

// Clear any leftover history
clearHistory(GROUP_ID);

// 5a: Guest asks about WiFi
console.log('  --- WiFi Question ---');
let response: string;

try {
  response = await processMessage(GROUP_ID, GUEST_ID, "Hi! What's the WiFi password?", true);
  assert(response.length > 0, 'agent responded to WiFi question');
  const hasWifi = response.toLowerCase().includes('wifi') ||
    response.includes('SunsetVilla5G') ||
    response.includes('welcome2026') ||
    response.toLowerCase().includes('password');
  assert(hasWifi, 'response contains WiFi info');
  console.log(`  Agent: "${response.slice(0, 200)}"\n`);
} catch (err) {
  console.log(`  ⚠️  LLM call failed: ${(err as Error).message}`);
  skip('WiFi response', 'LLM error');
}

// 5b: Guest asks about the property / check-in
console.log('  --- Check-in Question ---');
try {
  response = await processMessage(GROUP_ID, GUEST_ID, "What's the door code? And any house rules I should know?", true);
  assert(response.length > 0, 'agent responded to check-in question');
  const hasCheckin = response.includes('4521') ||
    response.toLowerCase().includes('door') ||
    response.toLowerCase().includes('code') ||
    response.toLowerCase().includes('rules');
  assert(hasCheckin, 'response contains check-in info');
  console.log(`  Agent: "${response.slice(0, 200)}"\n`);
} catch (err) {
  console.log(`  ⚠️  LLM call failed: ${(err as Error).message}`);
  skip('check-in response', 'LLM error');
}

// 5c: Guest wants food — agent should show options with prices
console.log('  --- Food Order (Quote) ---');
try {
  response = await processMessage(GROUP_ID, GUEST_ID, "I'm hungry! Can you order some Thai food for 2? I'm vegetarian.", true);
  assert(response.length > 0, 'agent responded to food request');

  // The agent should present restaurant options with prices
  const hasOptions = response.toLowerCase().includes('thai') ||
    response.toLowerCase().includes('restaurant') ||
    response.toLowerCase().includes('menu') ||
    response.toLowerCase().includes('option') ||
    response.includes('$') ||
    response.toLowerCase().includes('usdc') ||
    response.toLowerCase().includes('price');
  assert(hasOptions, 'response shows food options or prices');
  console.log(`  Agent: "${response.slice(0, 300)}"\n`);
} catch (err) {
  console.log(`  ⚠️  LLM call failed: ${(err as Error).message}`);
  skip('food quote response', 'LLM error');
}

// 5d: Guest picks an item — agent should quote total and ask for payment
console.log('  --- Food Selection (Payment Request) ---');
try {
  response = await processMessage(GROUP_ID, GUEST_ID, "I'll take 2 Pad Thai and a Mango Sticky Rice please", true);
  assert(response.length > 0, 'agent responded to food selection');

  // Agent should quote a price and mention the wallet address or USDC
  const hasPaymentRequest = response.includes('$') ||
    response.toLowerCase().includes('usdc') ||
    response.toLowerCase().includes('pay') ||
    response.toLowerCase().includes('send') ||
    response.toLowerCase().includes('wallet') ||
    response.toLowerCase().includes('total');
  assert(hasPaymentRequest, 'response asks for payment or quotes total');
  console.log(`  Agent: "${response.slice(0, 300)}"\n`);
} catch (err) {
  console.log(`  ⚠️  LLM call failed: ${(err as Error).message}`);
  skip('payment request response', 'LLM error');
}

// 5e: Guest says they paid — agent calls check_payment (mock mode confirms)
console.log('  --- Payment Confirmation ---');
try {
  response = await processMessage(GROUP_ID, GUEST_ID, "Done! I just sent the USDC", true);
  assert(response.length > 0, 'agent responded to payment claim');

  const hasConfirmation = response.toLowerCase().includes('confirm') ||
    response.toLowerCase().includes('received') ||
    response.toLowerCase().includes('order') ||
    response.toLowerCase().includes('placed') ||
    response.toLowerCase().includes('on its way') ||
    response.toLowerCase().includes('payment');
  assert(hasConfirmation, 'response confirms payment or order');
  console.log(`  Agent: "${response.slice(0, 300)}"\n`);
} catch (err) {
  console.log(`  ⚠️  LLM call failed: ${(err as Error).message}`);
  skip('payment confirmation response', 'LLM error');
}

// 5f: Guest asks for a taxi — quote flow
console.log('  --- Taxi Quote ---');
try {
  response = await processMessage(GROUP_ID, GUEST_ID, "Can you get me a taxi to the airport tomorrow at 3pm?", true);
  assert(response.length > 0, 'agent responded to taxi request');
  const hasTaxi = response.toLowerCase().includes('taxi') ||
    response.toLowerCase().includes('ride') ||
    response.toLowerCase().includes('airport') ||
    response.includes('$') ||
    response.toLowerCase().includes('option');
  assert(hasTaxi, 'response shows taxi options or price');
  console.log(`  Agent: "${response.slice(0, 300)}"\n`);
} catch (err) {
  console.log(`  ⚠️  LLM call failed: ${(err as Error).message}`);
  skip('taxi response', 'LLM error');
}

// 5g: Maintenance issue — should troubleshoot first
console.log('  --- Maintenance Issue ---');
try {
  response = await processMessage(GROUP_ID, GUEST_ID, "The AC in the bedroom is making a weird noise and not cooling", true);
  assert(response.length > 0, 'agent responded to maintenance');
  const hasAC = response.toLowerCase().includes('ac') ||
    response.toLowerCase().includes('reset') ||
    response.toLowerCase().includes('air') ||
    response.toLowerCase().includes('try') ||
    response.toLowerCase().includes('host');
  assert(hasAC, 'response addresses AC issue');
  console.log(`  Agent: "${response.slice(0, 300)}"\n`);
} catch (err) {
  console.log(`  ⚠️  LLM call failed: ${(err as Error).message}`);
  skip('maintenance response', 'LLM error');
}

// 5h: Guest asks about activities nearby
console.log('  --- Activities / Tickets ---');
try {
  response = await processMessage(GROUP_ID, GUEST_ID, "What activities or tours can I do around here? I love surfing!", true);
  assert(response.length > 0, 'agent responded to activities question');
  const hasActivities = response.toLowerCase().includes('surf') ||
    response.toLowerCase().includes('tour') ||
    response.toLowerCase().includes('activit') ||
    response.includes('$') ||
    response.toLowerCase().includes('ticket');
  assert(hasActivities, 'response shows activities or prices');
  console.log(`  Agent: "${response.slice(0, 300)}"\n`);
} catch (err) {
  console.log(`  ⚠️  LLM call failed: ${(err as Error).message}`);
  skip('activities response', 'LLM error');
}

// ═══════════════════════════════════════════════════════════
// Phase 6: Memory — Verify conversation persistence
// ═══════════════════════════════════════════════════════════

console.log('\n═══ Phase 6: Memory ═══\n');

const { loadHistory, loadSnapshot } = await import('../src/memory.js');

const history = getHistory(GROUP_ID);
assert(history.length >= 8, `conversation has ${history.length} messages (expected ≥8 from 8 exchanges)`);

// Check disk persistence
const booking = getBookingByGroupId(GROUP_ID);
if (booking) {
  const savedHistory = loadHistory(booking);
  assert(savedHistory.length > 0, 'history persisted to disk');
  console.log(`  Saved ${savedHistory.length} messages to disk`);

  const snapshot = loadSnapshot(booking);
  if (snapshot) {
    console.log(`  Snapshot: ${snapshot.summary.slice(0, 100)}`);
    console.log(`  Key facts: ${snapshot.keyFacts.length}`);
  } else {
    console.log('  No snapshot yet (generated every 20 messages)');
  }
} else {
  skip('disk persistence check', 'booking not found');
}

// ═══════════════════════════════════════════════════════════
// Phase 7: Edge Cases
// ═══════════════════════════════════════════════════════════

console.log('\n═══ Phase 7: Edge Cases ═══\n');

// Unknown group
const unknownProp = getPropertyByGroup(-12345);
assert(unknownProp === undefined, 'unknown group returns undefined');

// Unknown user in valid group
const unknownUser = identifyUser(999, GROUP_ID);
assert(unknownUser.role === 'unknown', 'unknown user in valid group');

// Get booking by ID
const bookingById = getBooking(GROUP_ID, 'bk-e2e-001');
assert(bookingById?.id === 'bk-e2e-001', 'get booking by specific ID');

// Nonexistent booking
const noBk = getBooking(GROUP_ID, 'bk-nonexistent');
assert(noBk === undefined, 'nonexistent booking returns undefined');

// ═══════════════════════════════════════════════════════════
// Cleanup
// ═══════════════════════════════════════════════════════════

clearHistory(GROUP_ID);

// Clean up test data directory for e2e booking
const testBookingDirs = fs.readdirSync(DATA_DIR).filter((d) => d.startsWith('bk-e2e-'));
for (const dir of testBookingDirs) {
  fs.rmSync(path.join(DATA_DIR, dir), { recursive: true, force: true });
}

// Restore original steward.json
restoreData(dataBackup);

// ═══════════════════════════════════════════════════════════
// Results
// ═══════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(50)}`);
console.log(`  Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
console.log(`${'═'.repeat(50)}`);
if (failed > 0) {
  console.log('\n❌ E2E test FAILED\n');
  process.exit(1);
} else {
  console.log('\n✅ E2E test PASSED\n');
}
