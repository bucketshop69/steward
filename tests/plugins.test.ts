import fs from 'node:fs';
import path from 'node:path';
import type { PluginParams, Property } from '../src/types.js';

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

const testProperty: Property = {
  name: 'Beach House', address: '123 Ocean Dr',
  checkInInstructions: 'Code 4521', houseRules: 'No smoking',
  wifiName: 'BeachLife', wifiPassword: 'sunny123',
  amenities: ['pool'], nearbyPlaces: 'Beach',
};

function makeParams(request: Record<string, unknown>): PluginParams {
  return {
    guest: { name: 'John', telegramId: 22222, preferences: 'Vegetarian, no nuts' },
    property: testProperty,
    request: JSON.stringify(request),
  };
}

// ── Food Plugin ─────────────────────────────────────

console.log('\n🍕 Food Plugin\n');

const { foodPlugin } = await import('../src/plugins/food.js');

assert(foodPlugin.name === 'food-delivery', 'name is food-delivery');
assert(foodPlugin.triggers.includes('pizza'), 'triggers include pizza');

const foodResult = await foodPlugin.handle(makeParams({ cuisine: 'Thai', people: 2, dietary: 'no nuts' }));
const foodQuote = JSON.parse(foodResult.message);
assert(foodQuote.type === 'quote', 'food returns a quote');
assert(Array.isArray(foodQuote.restaurants), 'quote has restaurants array');
assert(foodQuote.restaurants.length > 0, 'at least one restaurant returned');
assert(foodQuote.restaurants[0].menu.length > 0, 'restaurant has menu items');
assert(foodQuote.restaurants[0].menu[0].price > 0, 'menu items have prices');

// Multi-person pricing
const multiFood = await foodPlugin.handle(makeParams({ cuisine: 'pizza', people: 4 }));
const multiQuote = JSON.parse(multiFood.message);
assert(multiQuote.people === 4, 'people count preserved in quote');
assert(multiQuote.restaurants[0].menu[0].priceForGroup > multiQuote.restaurants[0].menu[0].price, 'group price > single price');

// ── Cleaning Plugin ─────────────────────────────────

console.log('\n🧹 Cleaning Plugin\n');

const { cleaningPlugin } = await import('../src/plugins/cleaning.js');

assert(cleaningPlugin.name === 'cleaning', 'name is cleaning');

const cleanResult = await cleaningPlugin.handle(makeParams({ type: 'standard', date: 'tomorrow' }));
const cleanQuote = JSON.parse(cleanResult.message);
assert(cleanQuote.type === 'quote', 'cleaning returns a quote');
assert(Array.isArray(cleanQuote.options), 'has options array');
assert(cleanQuote.options.length === 3, 'has 3 cleaning packages');
assert(cleanQuote.options.some((o: any) => o.type === 'Standard Clean'), 'has Standard Clean option');
assert(cleanQuote.options.some((o: any) => o.type === 'Deep Clean'), 'has Deep Clean option');
assert(cleanQuote.options[1].price === 50, 'standard costs $50');
assert(cleanQuote.options[2].price === 120, 'deep costs $120');

// ── Taxi Plugin ─────────────────────────────────────

console.log('\n🚕 Taxi Plugin\n');

const { taxiPlugin } = await import('../src/plugins/taxi.js');

assert(taxiPlugin.name === 'taxi', 'name is taxi');

const airportTaxi = await taxiPlugin.handle(makeParams({ destination: 'airport', time: '3pm' }));
const airportQuote = JSON.parse(airportTaxi.message);
assert(airportQuote.type === 'quote', 'taxi returns a quote');
assert(Array.isArray(airportQuote.options), 'has ride options');
assert(airportQuote.options.length > 0, 'at least one ride option');
assert(airportQuote.destination === 'airport', 'destination in response');
assert(airportQuote.options[0].price > 0, 'ride has a price');

const beachTaxi = await taxiPlugin.handle(makeParams({ destination: 'beach' }));
const beachQuote = JSON.parse(beachTaxi.message);
assert(beachQuote.options[0].price < airportQuote.options[0].price, 'beach cheaper than airport');

// ── Tickets Plugin ──────────────────────────────────

console.log('\n🎫 Tickets Plugin\n');

const { ticketsPlugin } = await import('../src/plugins/tickets.js');

assert(ticketsPlugin.name === 'tickets', 'name is tickets');

const museumTicket = await ticketsPlugin.handle(makeParams({ event: 'museum', people: 2 }));
const museumQuote = JSON.parse(museumTicket.message);
assert(museumQuote.type === 'quote', 'tickets returns a quote');
assert(Array.isArray(museumQuote.options), 'has activity options');
assert(museumQuote.options.length > 0, 'at least one activity');
assert(museumQuote.options[0].totalPrice > 0, 'has total price');
assert(museumQuote.people === 2, 'people count preserved');

// ── Maintenance Plugin ──────────────────────────────

console.log('\n🔧 Maintenance Plugin\n');

const { maintenancePlugin } = await import('../src/plugins/maintenance.js');

assert(maintenancePlugin.name === 'maintenance', 'name is maintenance');

const acIssue = await maintenancePlugin.handle(makeParams({ issue: 'AC not working', location: 'bedroom' }));
assert(acIssue.message.includes('reset button'), 'suggests AC troubleshooting');
assert(acIssue.message.includes('bedroom'), 'mentions location');

const wifiIssue = await maintenancePlugin.handle(makeParams({ issue: 'wifi is down' }));
assert(wifiIssue.message.includes('router'), 'suggests WiFi troubleshooting');

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

// ── Registry executePlugin ──────────────────────────

console.log('\nPlugin execution:');

const { executePlugin } = await import('../src/plugins/registry.js');
const execResult = await executePlugin('food-delivery', makeParams({ cuisine: 'pizza', people: 1 }));
const execQuote = JSON.parse(execResult.message);
assert(execQuote.type === 'quote', 'execution returns quote');
assert(execQuote.restaurants.length > 0, 'execution returns restaurants');

cleanup();

// ── Results ─────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All plugin tests passed! ✅\n');
