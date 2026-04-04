import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

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

function seedConfig() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STEWARD_JSON, JSON.stringify({
    hostTelegramId: 12345,
    groups: [
      {
        telegramGroupId: -100001,
        property: {
          name: 'Beach House', address: '123 Ocean Dr',
          checkInInstructions: 'Code 4521', houseRules: 'No smoking',
          wifiName: 'BeachLife', wifiPassword: 'sunny123',
          amenities: ['pool'], nearbyPlaces: 'Beach',
        },
        bookings: [],
      },
      {
        telegramGroupId: -100002,
        property: {
          name: 'City Apartment', address: '456 Main St',
          checkInInstructions: 'Doorman', houseRules: 'No pets',
          wifiName: 'CityWifi', wifiPassword: 'urban456',
          amenities: ['gym'], nearbyPlaces: 'Park',
        },
        bookings: [],
      },
    ],
  }, null, 2));
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

  // ── Add booking with --group flag ────────────────

  console.log('Add booking with --group flag:');
  cleanup();
  seedConfig();

  const result = await runCommand(['booking', 'add', '--group', '-100001'], [
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
  const config = JSON.parse(fs.readFileSync(STEWARD_JSON, 'utf-8'));
  const bookings = config.groups[0].bookings;
  assert(bookings.length === 1, 'one booking stored');
  assert(bookings[0].guestName === 'John Smith', 'guest name stored');
  assert(bookings[0].checkIn === '2026-04-10', 'check-in stored');
  assert(bookings[0].checkOut === '2026-04-15', 'check-out stored');
  assert(bookings[0].preferences === 'Vegetarian, no nuts', 'preferences stored');
  assert(bookings[0].guestTelegramUsername === '@johnsmith', 'telegram username stored');
  assert(bookings[0].status === 'pending', 'status is pending');
  assert(bookings[0].id.startsWith('bk-0410-'), 'booking ID format correct');

  // ── No groups configured ───────────────────────────

  console.log('\nNo groups configured:');
  cleanup();
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STEWARD_JSON, JSON.stringify({ hostTelegramId: 12345, groups: [] }, null, 2));

  const noProp = await runCommand(['booking', 'add'], []);
  assert(noProp.stdout.includes('No properties configured'), 'shows no properties message');

  // ── Auto-select single group ─────────────────────

  console.log('\nAuto-select single group:');
  cleanup();
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STEWARD_JSON, JSON.stringify({
    hostTelegramId: 12345,
    groups: [{
      telegramGroupId: -100001,
      property: {
        name: 'Beach House', address: '123 Ocean Dr',
        checkInInstructions: 'Code 4521', houseRules: 'No smoking',
        wifiName: 'BeachLife', wifiPassword: 'sunny123',
        amenities: ['pool'], nearbyPlaces: 'Beach',
      },
      bookings: [],
    }],
  }, null, 2));

  const autoSelect = await runCommand(['booking', 'add'], [
    'Jane Doe',       // guest name
    '2026-05-01',     // check-in
    '2026-05-05',     // check-out
    '',               // no preferences
    '',               // no username
  ]);

  assert(autoSelect.code === 0, 'auto-selects single group');
  assert(autoSelect.stdout.includes('Using group'), 'shows auto-selected group');

  // ── List bookings ───────────────────────────────────

  console.log('\nList bookings:');
  cleanup();
  seedConfig();
  // Add a booking first
  await runCommand(['booking', 'add', '--group', '-100001'], [
    'Test Guest',
    '2026-04-10',
    '2026-04-15',
    '',
    '',
  ]);

  const list = await runCommand(['booking', 'list']);
  assert(list.code === 0, 'list exits with code 0');
  assert(list.stdout.includes('Test Guest'), 'shows guest name');
  assert(list.stdout.includes('pending'), 'shows status');

  // ── List when empty ─────────────────────────────────

  console.log('\nList when empty:');
  cleanup();
  seedConfig();

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
