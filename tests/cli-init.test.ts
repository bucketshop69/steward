import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ENV_PATH = path.resolve('.env');
const DATA_DIR = path.resolve('data');
const STEWARD_JSON = path.join(DATA_DIR, 'steward.json');
let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { console.log(`  ✓ ${name}`); passed++; }
  else { console.log(`  ✗ ${name}`); failed++; }
}

function cleanup() {
  if (fs.existsSync(ENV_PATH)) fs.unlinkSync(ENV_PATH);
  if (fs.existsSync(STEWARD_JSON)) fs.unlinkSync(STEWARD_JSON);
}

function runInit(inputs: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', 'src/index.ts', 'init'], {
      cwd: path.resolve('.'),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      if (inputs.length > 0 && data.toString().includes(':')) {
        const input = inputs.shift()!;
        child.stdin.write(input + '\n');
      }
    });

    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      resolve({ stdout, stderr, code: code ?? 1 });
    });

    setTimeout(() => {
      child.kill();
      resolve({ stdout, stderr, code: 1 });
    }, 10000);
  });
}

async function main() {
  console.log('\n🏗️  CLI Init Tests\n');

  // ── Fresh init ──────────────────────────────────────

  console.log('Fresh init with valid inputs:');
  cleanup();

  const result = await runInit([
    '123456789:ABCdefGHI_jklMNO',  // bot token
    'sk-api-test-key-12345',        // agent api key
    '7883754831',                   // host telegram ID
    'steward-main',                 // wallet name
    '',                             // rpc url (skip)
  ]);

  assert(result.code === 0, 'exits with code 0');
  assert(result.stdout.includes('Steward configured'), 'shows success message');
  assert(result.stdout.includes('steward property add'), 'shows next steps');

  // Verify .env was created
  assert(fs.existsSync(ENV_PATH), '.env file created');
  const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
  assert(envContent.includes('TELEGRAM_BOT_TOKEN=123456789:ABCdefGHI_jklMNO'), '.env has bot token');
  assert(envContent.includes('AGENT_API_KEY=sk-api-test-key-12345'), '.env has agent API key');
  assert(envContent.includes('OWS_WALLET_NAME=steward-main'), '.env has wallet name');

  // Verify steward.json was created with host ID
  assert(fs.existsSync(STEWARD_JSON), 'steward.json created');
  const config = JSON.parse(fs.readFileSync(STEWARD_JSON, 'utf-8'));
  assert(config.hostTelegramId === 7883754831, 'host telegram ID stored in steward.json');
  assert(Array.isArray(config.groups), 'groups array initialized');

  // ── Overwrite protection ────────────────────────────

  console.log('\nOverwrite protection (decline):');

  const result2 = await runInit([
    'N',  // don't overwrite
  ]);

  assert(result2.stdout.includes('Aborted'), 'shows aborted message when declining overwrite');
  const envAfter = fs.readFileSync(ENV_PATH, 'utf-8');
  assert(envAfter.includes('sk-api-test-key-12345'), '.env unchanged after declining overwrite');

  // ── Overwrite accepted ──────────────────────────────

  console.log('\nOverwrite protection (accept):');

  const result3 = await runInit([
    'y',                                // overwrite
    '987654321:ZYXwvuTSR_qpoNML',      // new bot token
    'sk-api-new-key-99999',             // new agent api key
    '1111111111',                       // new host telegram ID
    'steward-test',                     // new wallet name
    '',                                 // rpc url
  ]);

  assert(result3.code === 0, 'exits with code 0 after overwrite');
  const envOverwritten = fs.readFileSync(ENV_PATH, 'utf-8');
  assert(envOverwritten.includes('987654321:ZYXwvuTSR_qpoNML'), '.env has new bot token after overwrite');
  assert(envOverwritten.includes('sk-api-new-key-99999'), '.env has new agent API key after overwrite');

  // ── Default values ──────────────────────────────────

  console.log('\nDefault values:');
  cleanup();

  const result4 = await runInit([
    '111111111:AABBccDDeeFFgg',   // bot token
    'sk-api-default-test',        // agent api key
    '9999999999',                 // host telegram ID
    '',                           // wallet name (default)
    '',                           // rpc url (skip)
  ]);

  assert(result4.code === 0, 'exits with code 0 with defaults');
  const envDefaults = fs.readFileSync(ENV_PATH, 'utf-8');
  assert(envDefaults.includes('OWS_WALLET_NAME=steward-main'), 'default wallet name applied');

  // ── Cleanup ─────────────────────────────────────────

  cleanup();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('All CLI init tests passed! ✅\n');
  }
}

main();
