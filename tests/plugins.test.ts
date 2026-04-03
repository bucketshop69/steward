import fs from 'node:fs';
import path from 'node:path';
import type { PluginParams, WalletService, Property } from '../src/types.js';

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

const mockWallet: WalletService = {
  async getBalance() { return 1000; },
  async payX402() { return { tx: 'mock_pay_test' }; },
};

const testProperty: Property = {
  id: 'beach-house', name: 'Beach House', address: '123 Ocean Dr',
  hostTelegramId: 12345, checkInInstructions: 'Code 4521',
  houseRules: 'No smoking', wifiName: 'BeachLife', wifiPassword: 'sunny123',
  amenities: ['pool'], nearbyPlaces: 'Beach', dailyBudget: 200, perTransactionLimit: 100,
};

function makeParams(request: Record<string, unknown>): PluginParams {
  return {
    guest: { name: 'John', telegramId: 22222, preferences: 'Vegetarian, no nuts' },
    property: testProperty,
    request: JSON.stringify(request),
    wallet: mockWallet,
    mock: true,
  };
}

// ── Food Plugin ─────────────────────────────────────

console.log('\n🍕 Food Plugin\n');

const { foodPlugin } = await import('../src/plugins/food.js');

assert(foodPlugin.name === 'food-delivery', 'name is food-delivery');
assert(foodPlugin.triggers.includes('pizza'), 'triggers include pizza');

const foodResult = await foodPlugin.handle(makeParams({ cuisine: 'Thai', people: 2, dietary: 'no nuts' }));
assert(foodResult.message.includes('Thai'), 'response mentions cuisine');
assert(foodResult.message.includes('USDC'), 'response mentions USDC');
assert(foodResult.transaction !== undefined, 'has transaction');
assert(foodResult.transaction!.amount > 0, 'transaction has amount');
assert(foodResult.transaction!.tx!.startsWith('mock_food_'), 'mock tx has food prefix');

// Cost estimation
const cheapResult = await foodPlugin.handle(makeParams({ cuisine: 'pizza', people: 1 }));
const premiumResult = await foodPlugin.handle(makeParams({ cuisine: 'sushi', people: 1 }));
assert(premiumResult.transaction!.amount > cheapResult.transaction!.amount, 'premium cuisine costs more');

// Multi-person
const multiResult = await foodPlugin.handle(makeParams({ cuisine: 'pizza', people: 4 }));
assert(multiResult.transaction!.amount > cheapResult.transaction!.amount, 'more people costs more');

// ── Cleaning Plugin ─────────────────────────────────

console.log('\n🧹 Cleaning Plugin\n');

const { cleaningPlugin } = await import('../src/plugins/cleaning.js');

assert(cleaningPlugin.name === 'cleaning', 'name is cleaning');

const stdClean = await cleaningPlugin.handle(makeParams({ type: 'standard', date: 'tomorrow' }));
assert(stdClean.message.includes('Standard'), 'standard cleaning message');
assert(stdClean.transaction!.amount === 50, 'standard costs $50');
assert(stdClean.transaction!.tx!.startsWith('mock_clean_'), 'mock tx has clean prefix');

const deepClean = await cleaningPlugin.handle(makeParams({ type: 'deep', date: '2026-04-15' }));
assert(deepClean.transaction!.amount === 120, 'deep costs $120');

// With notes
const notesClean = await cleaningPlugin.handle(makeParams({ type: 'standard', date: 'today', notes: 'Extra focus on bathroom' }));
assert(notesClean.message.includes('bathroom'), 'notes included in message');

// ── Taxi Plugin ─────────────────────────────────────

console.log('\n🚕 Taxi Plugin\n');

const { taxiPlugin } = await import('../src/plugins/taxi.js');

assert(taxiPlugin.name === 'taxi', 'name is taxi');

const airportTaxi = await taxiPlugin.handle(makeParams({ destination: 'airport', time: '3pm' }));
assert(airportTaxi.transaction!.amount === 50, 'airport costs $50');
assert(airportTaxi.message.includes('airport'), 'mentions destination');
assert(airportTaxi.message.includes('3pm'), 'mentions time');

const beachTaxi = await taxiPlugin.handle(makeParams({ destination: 'beach' }));
assert(beachTaxi.transaction!.amount === 15, 'beach costs $15');

const defaultTaxi = await taxiPlugin.handle(makeParams({ destination: 'some random place' }));
assert(defaultTaxi.transaction!.amount === 25, 'default costs $25');

const multiPassenger = await taxiPlugin.handle(makeParams({ destination: 'downtown', people: 3 }));
assert(multiPassenger.message.includes('3 passengers'), 'shows passenger count');

// ── Tickets Plugin ──────────────────────────────────

console.log('\n🎫 Tickets Plugin\n');

const { ticketsPlugin } = await import('../src/plugins/tickets.js');

assert(ticketsPlugin.name === 'tickets', 'name is tickets');

const museumTicket = await ticketsPlugin.handle(makeParams({ event: 'museum visit', people: 2 }));
assert(museumTicket.transaction!.amount === 40, 'museum 2 people = $40');
assert(museumTicket.message.includes('2 tickets'), 'shows ticket count');

const concertTicket = await ticketsPlugin.handle(makeParams({ event: 'concert', people: 1, date: 'Friday' }));
assert(concertTicket.transaction!.amount === 60, 'concert = $60');
assert(concertTicket.message.includes('Friday'), 'shows date');

const defaultEvent = await ticketsPlugin.handle(makeParams({ event: 'local experience', people: 1 }));
assert(defaultEvent.transaction!.amount === 30, 'default = $30');

// ── Maintenance Plugin ──────────────────────────────

console.log('\n🔧 Maintenance Plugin\n');

const { maintenancePlugin } = await import('../src/plugins/maintenance.js');

assert(maintenancePlugin.name === 'maintenance', 'name is maintenance');

// With troubleshooting available
const acIssue = await maintenancePlugin.handle(makeParams({ issue: 'AC not working', location: 'bedroom' }));
assert(acIssue.message.includes('reset button'), 'suggests AC troubleshooting');
assert(acIssue.message.includes('bedroom'), 'mentions location');
assert(acIssue.transaction === undefined, 'no transaction for maintenance');

const wifiIssue = await maintenancePlugin.handle(makeParams({ issue: 'wifi is down' }));
assert(wifiIssue.message.includes('router'), 'suggests WiFi troubleshooting');

// Without troubleshooting — escalates
const unknownIssue = await maintenancePlugin.handle(makeParams({ issue: 'strange noise from ceiling', severity: 'major' }));
assert(unknownIssue.message.includes('⚠️'), 'major severity has warning emoji');
assert(unknownIssue.message.includes('escalate'), 'mentions escalation');

const urgentIssue = await maintenancePlugin.handle(makeParams({ issue: 'gas smell in kitchen', severity: 'urgent' }));
assert(urgentIssue.message.includes('🚨'), 'urgent severity has alarm emoji');

// ── Plugin Registry ─────────────────────────────────

console.log('\n📦 Plugin Registry\n');

const { getPlugins, getPlugin, getPluginToolSchemas } = await import('../src/plugins/registry.js');

assert(getPlugins().length === 5, '5 plugins registered');
assert(getPlugin('food-delivery')?.name === 'food-delivery', 'find food plugin by name');
assert(getPlugin('cleaning')?.name === 'cleaning', 'find cleaning plugin by name');
assert(getPlugin('nonexistent') === undefined, 'undefined for unknown plugin');

const schemas = getPluginToolSchemas();
assert(schemas.length === 5, '5 tool schemas');
assert(schemas.some(s => s.name === 'order_food'), 'has order_food schema');
assert(schemas.some(s => s.name === 'book_cleaning'), 'has book_cleaning schema');
assert(schemas.some(s => s.name === 'book_taxi'), 'has book_taxi schema');
assert(schemas.some(s => s.name === 'book_tickets'), 'has book_tickets schema');
assert(schemas.some(s => s.name === 'report_maintenance'), 'has report_maintenance schema');

// ── Registry executePlugin with transaction logging ──

console.log('\nPlugin execution with transaction logging:');
cleanup();

const { addProperty } = await import('../src/store/properties.js');
addProperty(testProperty);

const { executePlugin } = await import('../src/plugins/registry.js');
const execResult = await executePlugin('food-delivery', makeParams({ cuisine: 'pizza', people: 1 }));
assert(execResult.message.includes('pizza'), 'execution returns message');
assert(execResult.transaction !== undefined, 'execution returns transaction');

// Check transaction was logged
const { listTransactions } = await import('../src/store/transactions.js');
const txs = listTransactions('beach-house');
assert(txs.length === 1, 'transaction auto-logged');
assert(txs[0].plugin === 'food-delivery', 'logged with correct plugin name');

cleanup();

// ── Results ─────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All plugin tests passed! ✅\n');
