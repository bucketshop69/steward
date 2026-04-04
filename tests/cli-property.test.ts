import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DATA_DIR = path.resolve('data');
const STEWARD_TEST_JSON = path.join(DATA_DIR, 'steward.test.json');
let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { console.log(`  ✓ ${name}`); passed++; }
  else { console.log(`  ✗ ${name}`); failed++; }
}

function cleanup() {
  if (fs.existsSync(STEWARD_TEST_JSON)) fs.unlinkSync(STEWARD_TEST_JSON);
}

function seedConfig() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STEWARD_TEST_JSON, JSON.stringify({
    hostTelegramId: 12345,
    groups: [],
  }, null, 2));
}

function runCommand(args: string[], inputs: string[] = []): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', 'src/index.ts', ...args], {
      cwd: path.resolve('.'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, STEWARD_CONFIG: 'steward.test.json' },
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
  seedConfig();

  const result = await runCommand(['property', 'add'], [
    '-1001234567890',                 // telegram group ID
    'Beach House',                    // name
    '123 Ocean Drive, Miami',         // address
    'Door code is 4521. Parking #3.', // check-in
    'No smoking. Quiet after 10pm.',  // rules
    'BeachLife2026',                  // wifi name
    'sunny123',                      // wifi password
    'pool, AC, parking, washer',     // amenities
    'Whole Foods (5 min), Beach Bar (2 min)',  // nearby
  ]);

  assert(result.code === 0, 'exits with code 0');
  assert(result.stdout.includes('Property added'), 'shows property added message');
  assert(result.stdout.includes('Beach House'), 'shows property name');

  // Verify stored data
  assert(fs.existsSync(STEWARD_TEST_JSON), 'steward.test.json exists');
  const config = JSON.parse(fs.readFileSync(STEWARD_TEST_JSON, 'utf-8'));
  assert(config.groups.length === 1, 'one group stored');
  assert(config.groups[0].telegramGroupId === -1001234567890, 'group ID stored');
  assert(config.groups[0].property.name === 'Beach House', 'name stored correctly');
  assert(config.groups[0].property.wifiPassword === 'sunny123', 'wifi password stored');
  assert(Array.isArray(config.groups[0].property.amenities), 'amenities is array');

  // ── List properties ─────────────────────────────────

  console.log('\nList properties:');

  const list = await runCommand(['property', 'list']);
  assert(list.code === 0, 'list exits with code 0');
  assert(list.stdout.includes('Beach House'), 'list shows property name');

  // ── List when empty ─────────────────────────────────

  console.log('\nList when empty:');
  cleanup();
  seedConfig();

  const emptyList = await runCommand(['property', 'list']);
  assert(emptyList.stdout.includes('No properties configured'), 'empty list shows helpful message');

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
