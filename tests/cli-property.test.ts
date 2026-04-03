import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

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
      if (inputsCopy.length > 0 && data.toString().includes(':')) {
        child.stdin.write(inputsCopy.shift()! + '\n');
      }
    });

    child.on('close', (code) => resolve({ stdout, code: code ?? 1 }));
    setTimeout(() => { child.kill(); resolve({ stdout, code: 1 }); }, 10000);
  });
}

async function main() {
  console.log('\n🏠 CLI Property Tests\n');

  // ── Add property ────────────────────────────────────

  console.log('Add property with valid inputs:');
  cleanup();

  const result = await runCommand(['property', 'add'], [
    'Beach House',                    // name
    '123 Ocean Drive, Miami',         // address
    'Door code is 4521. Parking #3.', // check-in
    'No smoking. Quiet after 10pm.',  // rules
    'BeachLife2026',                  // wifi name
    'sunny123',                      // wifi password
    'pool, AC, parking, washer',     // amenities
    'Whole Foods (5 min), Beach Bar (2 min)',  // nearby
    '200',                           // daily budget
    '100',                           // per-tx limit
    '7883754831',                    // telegram ID
  ]);

  assert(result.code === 0, 'exits with code 0');
  assert(result.stdout.includes('Property added: beach-house'), 'shows property ID');
  assert(result.stdout.includes('Beach House'), 'shows property name');

  // Verify stored data
  const propsFile = path.join(DATA_DIR, 'properties.json');
  assert(fs.existsSync(propsFile), 'properties.json created');
  const props = JSON.parse(fs.readFileSync(propsFile, 'utf-8'));
  assert(props.length === 1, 'one property stored');
  assert(props[0].id === 'beach-house', 'ID is slugified');
  assert(props[0].name === 'Beach House', 'name stored correctly');
  assert(props[0].hostTelegramId === 7883754831, 'host telegram ID stored');
  assert(props[0].wifiPassword === 'sunny123', 'wifi password stored');
  assert(Array.isArray(props[0].amenities) && props[0].amenities.length === 4, 'amenities parsed as array');
  assert(props[0].amenities[0] === 'pool', 'first amenity correct');
  assert(props[0].dailyBudget === 200, 'daily budget stored as number');

  // ── Duplicate rejection ─────────────────────────────

  console.log('\nDuplicate rejection:');

  const dup = await runCommand(['property', 'add'], [
    'Beach House',  // same name → same slug
  ]);

  assert(dup.stdout.includes('already exists'), 'duplicate shows error');

  // ── Add second property ─────────────────────────────

  console.log('\nAdd second property:');

  await runCommand(['property', 'add'], [
    'City Apartment',
    '456 Main St, NYC',
    'Doorman will let you in',
    'No pets',
    'CityWifi',
    'urban456',
    'gym, rooftop',
    'Central Park (10 min)',
    '150',
    '75',
    '1234567890',
  ]);

  const props2 = JSON.parse(fs.readFileSync(propsFile, 'utf-8'));
  assert(props2.length === 2, 'two properties stored');
  assert(props2[1].id === 'city-apartment', 'second property slugified correctly');

  // ── List properties ─────────────────────────────────

  console.log('\nList properties:');

  const list = await runCommand(['property', 'list']);
  assert(list.code === 0, 'list exits with code 0');
  assert(list.stdout.includes('beach-house'), 'list shows first property ID');
  assert(list.stdout.includes('Beach House'), 'list shows first property name');
  assert(list.stdout.includes('city-apartment'), 'list shows second property ID');
  assert(list.stdout.includes('$200/day'), 'list shows budget');

  // ── List when empty ─────────────────────────────────

  console.log('\nList when empty:');
  cleanup();

  const emptyList = await runCommand(['property', 'list']);
  assert(emptyList.stdout.includes('No properties configured'), 'empty list shows helpful message');

  // ── Default values ──────────────────────────────────

  console.log('\nDefault budget values:');

  const defaults = await runCommand(['property', 'add'], [
    'Test House',
    'Test Address',
    'Test instructions',
    'Test rules',
    'TestWifi',
    'test123',
    'AC',
    'Nearby place',
    '',   // default daily budget (200)
    '',   // default per-tx limit (100)
    '999',
  ]);

  const props3 = JSON.parse(fs.readFileSync(propsFile, 'utf-8'));
  assert(props3[0].dailyBudget === 200, 'default daily budget is 200');
  assert(props3[0].perTransactionLimit === 100, 'default per-tx limit is 100');

  // ── Usage help ──────────────────────────────────────

  console.log('\nUsage help:');

  const help = await runCommand(['property']);
  assert(help.stdout.includes('steward property add'), 'shows add subcommand');
  assert(help.stdout.includes('steward property list'), 'shows list subcommand');

  // ── Cleanup ─────────────────────────────────────────

  cleanup();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  else console.log('All CLI property tests passed! ✅\n');
}

main();
