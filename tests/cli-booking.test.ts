import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DATA_DIR = path.resolve('data');
const PROPS_FILE = path.join(DATA_DIR, 'properties.json');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
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

function seedProperty() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PROPS_FILE, JSON.stringify([
    {
      id: 'beach-house', name: 'Beach House', address: '123 Ocean Dr',
      hostTelegramId: 12345, checkInInstructions: 'Code 4521',
      houseRules: 'No smoking', wifiName: 'BeachLife', wifiPassword: 'sunny123',
      amenities: ['pool'], nearbyPlaces: 'Beach', dailyBudget: 200, perTransactionLimit: 100,
    },
    {
      id: 'city-apt', name: 'City Apartment', address: '456 Main St',
      hostTelegramId: 67890, checkInInstructions: 'Doorman',
      houseRules: 'No pets', wifiName: 'CityWifi', wifiPassword: 'urban456',
      amenities: ['gym'], nearbyPlaces: 'Park', dailyBudget: 150, perTransactionLimit: 75,
    },
  ], null, 2));
}

function runCommand(args: string[], inputs: string[] = []): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', 'src/index.ts', ...args], {
      cwd: path.resolve('.'),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    const inputsCopy = [...inputs];

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      // Only feed input when we see a readline prompt (ends with ": ")
      const chunk = data.toString();
      if (inputsCopy.length > 0 && chunk.endsWith(': ')) {
        child.stdin.write(inputsCopy.shift()! + '\n');
      }
    });

    child.on('close', (code) => resolve({ stdout, code: code ?? 1 }));
    setTimeout(() => { child.kill(); resolve({ stdout, code: 1 }); }, 10000);
  });
}

async function main() {
  console.log('\n📋 CLI Booking Tests\n');

  // ── Add booking with --property flag ────────────────

  console.log('Add booking with --property flag:');
  cleanup();
  seedProperty();

  const result = await runCommand(['booking', 'add', '--property', 'beach-house'], [
    'John Smith',         // guest name
    '2026-04-10',         // check-in
    '2026-04-15',         // check-out
    'Vegetarian, no nuts', // preferences
    '@johnsmith',          // telegram username
  ]);

  assert(result.code === 0, 'exits with code 0');
  assert(result.stdout.includes('Booking created'), 'shows success message');
  assert(result.stdout.includes('John Smith'), 'shows guest name');
  assert(result.stdout.includes('Beach House'), 'shows property name');

  // Verify stored data
  assert(fs.existsSync(BOOKINGS_FILE), 'bookings.json created');
  const bookings = JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf-8'));
  assert(bookings.length === 1, 'one booking stored');
  assert(bookings[0].propertyId === 'beach-house', 'property ID stored');
  assert(bookings[0].guestName === 'John Smith', 'guest name stored');
  assert(bookings[0].checkIn === '2026-04-10', 'check-in stored');
  assert(bookings[0].checkOut === '2026-04-15', 'check-out stored');
  assert(bookings[0].preferences === 'Vegetarian, no nuts', 'preferences stored');
  assert(bookings[0].guestTelegramUsername === '@johnsmith', 'telegram username stored');
  assert(bookings[0].status === 'pending', 'status is pending');
  assert(bookings[0].totalSpent === 0, 'total spent is 0');
  assert(bookings[0].id.startsWith('bk-0410-'), 'booking ID format correct');

  // ── Invalid property ────────────────────────────────

  console.log('\nInvalid property:');

  const invalid = await runCommand(['booking', 'add', '--property', 'nonexistent'], []);
  assert(invalid.stdout.includes('not found'), 'shows not found error');

  // ── No properties ───────────────────────────────────

  console.log('\nNo properties configured:');
  cleanup();

  const noProp = await runCommand(['booking', 'add'], []);
  assert(noProp.stdout.includes('No properties configured'), 'shows no properties message');

  // ── Auto-select single property ─────────────────────

  console.log('\nAuto-select single property:');
  cleanup();
  // Seed only one property
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PROPS_FILE, JSON.stringify([
    {
      id: 'beach-house', name: 'Beach House', address: '123 Ocean Dr',
      hostTelegramId: 12345, checkInInstructions: 'Code 4521',
      houseRules: 'No smoking', wifiName: 'BeachLife', wifiPassword: 'sunny123',
      amenities: ['pool'], nearbyPlaces: 'Beach', dailyBudget: 200, perTransactionLimit: 100,
    },
  ], null, 2));

  const autoSelect = await runCommand(['booking', 'add'], [
    'Jane Doe',       // guest name
    '2026-05-01',     // check-in
    '2026-05-05',     // check-out
    '',               // no preferences
    '',               // no username
  ]);

  assert(autoSelect.code === 0, 'auto-selects single property');
  assert(autoSelect.stdout.includes('Using property: Beach House'), 'shows auto-selected property');
  if (fs.existsSync(BOOKINGS_FILE)) {
    const autoBookings = JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf-8'));
    assert(autoBookings[0].propertyId === 'beach-house', 'correct property assigned');
    assert(autoBookings[0].preferences === undefined, 'empty preferences stored as undefined');
    assert(autoBookings[0].guestTelegramUsername === undefined, 'empty username stored as undefined');
  } else {
    assert(false, 'correct property assigned');
    assert(false, 'empty preferences stored as undefined');
    assert(false, 'empty username stored as undefined');
  }

  // ── Date validation ─────────────────────────────────

  console.log('\nDate validation (check-out before check-in):');
  cleanup();
  seedProperty();

  const badDate = await runCommand(['booking', 'add', '--property', 'beach-house'], [
    'Bad Date Guest',
    '2026-04-15',     // check-in
    '2026-04-10',     // check-out BEFORE check-in → rejected
    '2026-04-20',     // valid check-out
    '',
    '',
  ]);

  assert(badDate.stdout.includes('Check-out must be after check-in'), 'rejects check-out before check-in');
  assert(badDate.code === 0, 'still completes after correction');

  // ── List bookings ───────────────────────────────────

  console.log('\nList bookings:');

  const list = await runCommand(['booking', 'list']);
  assert(list.code === 0, 'list exits with code 0');
  assert(list.stdout.includes('beach-house'), 'shows property ID');
  assert(list.stdout.includes('Bad Date Guest'), 'shows guest name');
  assert(list.stdout.includes('pending'), 'shows status');

  // ── List when empty ─────────────────────────────────

  console.log('\nList when empty:');
  cleanup();

  const emptyList = await runCommand(['booking', 'list']);
  assert(emptyList.stdout.includes('No bookings'), 'empty list shows helpful message');

  // ── Usage help ──────────────────────────────────────

  console.log('\nUsage help:');

  const help = await runCommand(['booking']);
  assert(help.stdout.includes('steward booking add'), 'shows add subcommand');
  assert(help.stdout.includes('steward booking list'), 'shows list subcommand');

  // ── Cleanup ─────────────────────────────────────────

  cleanup();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  else console.log('All CLI booking tests passed! ✅\n');
}

main();
