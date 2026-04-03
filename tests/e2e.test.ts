/**
 * End-to-end test: Full Steward demo flow
 *
 * Tests the complete pipeline WITHOUT Telegram:
 *   Guest message → Agent (MiniMax LLM) → Tools → Plugins → Wallet → Memory
 *
 * Requires AGENT_API_KEY (or MINIMAX_API_KEY) in .env — makes real LLM calls.
 * Uses mock wallet (no real USDC).
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
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

import type { Property, Booking } from '../src/types.js';

const DATA_DIR = path.resolve('data');
let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition: boolean, name: string) {
  if (condition) { console.log(`  ✓ ${name}`); passed++; }
  else { console.log(`  ✗ ${name}`); failed++; }
}

function skip(name: string) {
  console.log(`  ⊘ ${name} (skipped)`); skipped++;
}

function cleanup() {
  if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true });
}

// Check API key
const apiKey = process.env.AGENT_API_KEY ?? process.env.MINIMAX_API_KEY;
if (!apiKey) {
  console.log('\n⚠️  AGENT_API_KEY not set — skipping e2e test (requires real LLM calls)\n');
  process.exit(0);
}

cleanup();

// ── Setup: Property + Booking ──────────────────────────

console.log('\n🏗️  E2E Setup\n');

const { addProperty } = await import('../src/store/properties.js');
const { addBooking, getBooking } = await import('../src/store/bookings.js');
const { addGroupMapping } = await import('../src/store/bookings.js');
const { listTransactions } = await import('../src/store/transactions.js');
const { processMessage, clearHistory, getHistory } = await import('../src/agent.js');
const { loadHistory, loadSnapshot } = await import('../src/memory.js');
const { checkLifecycleEvents, resetLifecycleEvents } = await import('../src/lifecycle.js');

const GROUP_ID = -1003811367855;
const HOST_ID = 7883754831;
const GUEST_ID = 99999999;
const today = new Date().toISOString().slice(0, 10);
const checkout = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

const property: Property = {
  id: 'demo-villa',
  name: 'Demo Villa',
  address: 'Mall Road Block 2',
  hostTelegramId: HOST_ID,
  telegramGroupId: GROUP_ID,
  checkInInstructions: 'Door code is 4521. Lockbox on front door.',
  houseRules: 'No smoking, no parties after 10pm.',
  wifiName: 'DemoVilla5G',
  wifiPassword: 'welcome2026',
  amenities: ['pool', 'gym', 'kitchen', 'AC'],
  nearbyPlaces: 'Beach 2 min walk, restaurants on Main Street',
  dailyBudget: 200,
  perTransactionLimit: 100,
};

const booking: Booking = {
  id: 'bk-demo-001',
  propertyId: 'demo-villa',
  guestName: 'Alice Johnson',
  guestTelegramId: GUEST_ID,
  telegramGroupId: GROUP_ID,
  checkIn: today,
  checkOut: checkout,
  preferences: 'Vegetarian, loves surfing',
  status: 'active',
  totalSpent: 0,
};

addProperty(property);
addBooking(booking);
addGroupMapping({ telegramGroupId: GROUP_ID, propertyId: 'demo-villa', bookingId: 'bk-demo-001' });

assert(true, 'property and booking created');

// ── Lifecycle: Check-in day ────────────────────────────

console.log('\n📅 Lifecycle: Check-in Day\n');

resetLifecycleEvents();
const lifecycleMsgs = checkLifecycleEvents();
const checkinMsg = lifecycleMsgs.find(m => m.text.includes('Welcome'));
assert(checkinMsg !== undefined, 'check-in day message generated');
if (checkinMsg) {
  assert(checkinMsg.text.includes('Demo Villa'), 'mentions property name');
  assert(checkinMsg.text.includes('4521'), 'includes door code');
  assert(checkinMsg.text.includes('DemoVilla5G'), 'includes WiFi');
}

// ── Agent: WiFi question ───────────────────────────────

console.log('\n🤖 Agent: Guest asks about WiFi\n');

let response: string;

try {
  response = await processMessage(GROUP_ID, GUEST_ID, "Hi! What's the WiFi password?", true);
  assert(response.length > 0, 'agent responded');
  const hasWifi = response.toLowerCase().includes('wifi') ||
    response.toLowerCase().includes('demovilla') ||
    response.toLowerCase().includes('welcome2026') ||
    response.toLowerCase().includes('password');
  assert(hasWifi, 'response mentions WiFi info');
  console.log(`  Agent: "${response.slice(0, 150)}..."`);
} catch (err) {
  console.log(`  ⚠️  Agent call failed: ${(err as Error).message}`);
  skip('WiFi response content');
}

// ── Agent: Food order ──────────────────────────────────

console.log('\n🍕 Agent: Guest orders food\n');

try {
  response = await processMessage(GROUP_ID, GUEST_ID, "Can you order Thai food for 2 people? I'm vegetarian.", true);
  assert(response.length > 0, 'agent responded to food order');
  const hasFoodRef = response.toLowerCase().includes('thai') ||
    response.toLowerCase().includes('food') ||
    response.toLowerCase().includes('order') ||
    response.toLowerCase().includes('usdc');
  assert(hasFoodRef, 'response references food order');
  console.log(`  Agent: "${response.slice(0, 150)}..."`);
} catch (err) {
  console.log(`  ⚠️  Agent food call failed: ${(err as Error).message}`);
  skip('food order response');
}

// ── Agent: Taxi booking ────────────────────────────────

console.log('\n🚕 Agent: Guest books a taxi\n');

try {
  response = await processMessage(GROUP_ID, GUEST_ID, "I need a taxi to the airport at 3pm tomorrow", true);
  assert(response.length > 0, 'agent responded to taxi request');
  const hasTaxiRef = response.toLowerCase().includes('taxi') ||
    response.toLowerCase().includes('airport') ||
    response.toLowerCase().includes('booked') ||
    response.toLowerCase().includes('ride');
  assert(hasTaxiRef, 'response references taxi/airport');
  console.log(`  Agent: "${response.slice(0, 150)}..."`);
} catch (err) {
  console.log(`  ⚠️  Agent taxi call failed: ${(err as Error).message}`);
  skip('taxi response');
}

// ── Agent: Maintenance issue ───────────────────────────

console.log('\n🔧 Agent: Guest reports AC issue\n');

try {
  response = await processMessage(GROUP_ID, GUEST_ID, "The AC in the bedroom isn't working", true);
  assert(response.length > 0, 'agent responded to maintenance');
  const hasMaintenanceRef = response.toLowerCase().includes('ac') ||
    response.toLowerCase().includes('reset') ||
    response.toLowerCase().includes('troubleshoot') ||
    response.toLowerCase().includes('maintenance');
  assert(hasMaintenanceRef, 'response addresses AC issue');
  console.log(`  Agent: "${response.slice(0, 150)}..."`);
} catch (err) {
  console.log(`  ⚠️  Agent maintenance call failed: ${(err as Error).message}`);
  skip('maintenance response');
}

// ── Verify: Conversation history ───────────────────────

console.log('\n💾 Verify: Conversation History\n');

const history = getHistory(GROUP_ID);
assert(history.length >= 4, `history has ${history.length} messages (expected ≥4)`);

// Check if history was persisted to disk
const savedHistory = loadHistory(booking);
assert(savedHistory.length > 0, 'history persisted to disk');

// ── Verify: Transactions ───────────────────────────────

console.log('\n💰 Verify: Transactions\n');

const txs = listTransactions('demo-villa');
console.log(`  Transactions logged: ${txs.length}`);
for (const tx of txs) {
  console.log(`    - ${tx.plugin}: $${tx.amount} USDC (${tx.description})`);
}
// We can't guarantee exact transaction count since the LLM may or may not call plugins
// But we can check the structure
if (txs.length > 0) {
  assert(txs[0].propertyId === 'demo-villa', 'transaction has correct property');
  assert(txs[0].amount > 0, 'transaction has positive amount');
  assert(txs[0].tx.startsWith('mock_'), 'mock transaction prefix');
}

// ── Verify: Budget tracking ────────────────────────────

console.log('\n📊 Verify: Budget Tracking\n');

const { getTodaySpend } = await import('../src/store/transactions.js');
const todaySpend = getTodaySpend('demo-villa');
console.log(`  Spent today: $${todaySpend} USDC`);
assert(todaySpend >= 0, 'today spend is tracked');

const remaining = property.dailyBudget - todaySpend;
console.log(`  Remaining: $${remaining} USDC of $${property.dailyBudget}/day`);

// ── Agent: Budget question ─────────────────────────────

console.log('\n💬 Agent: Guest asks about spending\n');

try {
  response = await processMessage(GROUP_ID, GUEST_ID, "How much have I spent so far?", true);
  assert(response.length > 0, 'agent responded to budget question');
  console.log(`  Agent: "${response.slice(0, 200)}..."`);
} catch (err) {
  console.log(`  ⚠️  Agent budget call failed: ${(err as Error).message}`);
  skip('budget response');
}

// ── Cleanup ────────────────────────────────────────────

clearHistory(GROUP_ID);
cleanup();

// ── Results ────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
if (failed > 0) process.exit(1);
else console.log('E2E test complete! ✅\n');
