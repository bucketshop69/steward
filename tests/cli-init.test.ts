import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ENV_PATH = path.resolve('.env');
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
  if (fs.existsSync(ENV_PATH)) fs.unlinkSync(ENV_PATH);
  if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true });
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
      // Feed next input when we see a prompt (colon at end)
      if (inputs.length > 0 && data.toString().includes(':')) {
        const input = inputs.shift()!;
        child.stdin.write(input + '\n');
      }
    });

    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      resolve({ stdout, stderr, code: code ?? 1 });
    });

    // Timeout after 10s
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
    'sk-ant-test-key-12345',        // api key
    'steward-main',                 // wallet name
    '',                             // rpc url (skip)
    'devnet',                       // cluster
    '200',                          // daily budget
    '100',                          // per-tx limit
  ]);

  assert(result.code === 0, 'exits with code 0');
  assert(result.stdout.includes('Steward configured'), 'shows success message');
  assert(result.stdout.includes('steward property add'), 'shows next steps');

  // Verify .env was created
  assert(fs.existsSync(ENV_PATH), '.env file created');
  const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
  assert(envContent.includes('TELEGRAM_BOT_TOKEN=123456789:ABCdefGHI_jklMNO'), '.env has bot token');
  assert(envContent.includes('ANTHROPIC_API_KEY=sk-ant-test-key-12345'), '.env has API key');
  assert(envContent.includes('OWS_WALLET_NAME=steward-main'), '.env has wallet name');
  assert(envContent.includes('CLUSTER=devnet'), '.env has cluster');
  assert(envContent.includes('DAILY_BUDGET=200'), '.env has daily budget');
  assert(envContent.includes('PER_TX_LIMIT=100'), '.env has per-tx limit');

  // Verify data dir
  assert(fs.existsSync(DATA_DIR), 'data/ directory created');

  // ── Overwrite protection ────────────────────────────

  console.log('\nOverwrite protection (decline):');

  const result2 = await runInit([
    'N',  // don't overwrite
  ]);

  assert(result2.stdout.includes('Aborted'), 'shows aborted message when declining overwrite');
  // .env should still have original content
  const envAfter = fs.readFileSync(ENV_PATH, 'utf-8');
  assert(envAfter.includes('sk-ant-test-key-12345'), '.env unchanged after declining overwrite');

  // ── Overwrite accepted ──────────────────────────────

  console.log('\nOverwrite protection (accept):');

  const result3 = await runInit([
    'y',                                // overwrite
    '987654321:ZYXwvuTSR_qpoNML',      // new bot token
    'sk-ant-new-key-99999',             // new api key
    'steward-test',                     // new wallet name
    '',                                 // rpc url
    'mainnet',                          // cluster
    '500',                              // daily budget
    '250',                              // per-tx limit
  ]);

  assert(result3.code === 0, 'exits with code 0 after overwrite');
  const envOverwritten = fs.readFileSync(ENV_PATH, 'utf-8');
  assert(envOverwritten.includes('987654321:ZYXwvuTSR_qpoNML'), '.env has new bot token after overwrite');
  assert(envOverwritten.includes('sk-ant-new-key-99999'), '.env has new API key after overwrite');
  assert(envOverwritten.includes('CLUSTER=mainnet'), '.env has new cluster after overwrite');

  // ── Default values ──────────────────────────────────

  console.log('\nDefault values:');
  cleanup();

  const result4 = await runInit([
    '111111111:AABBccDDeeFFgg',   // bot token
    'sk-ant-default-test',        // api key
    '',                           // wallet name (default)
    '',                           // rpc url (skip)
    '',                           // cluster (default)
    '',                           // daily budget (default)
    '',                           // per-tx limit (default)
  ]);

  assert(result4.code === 0, 'exits with code 0 with defaults');
  const envDefaults = fs.readFileSync(ENV_PATH, 'utf-8');
  assert(envDefaults.includes('OWS_WALLET_NAME=steward-main'), 'default wallet name applied');
  assert(envDefaults.includes('DAILY_BUDGET=200'), 'default daily budget applied');
  assert(envDefaults.includes('PER_TX_LIMIT=100'), 'default per-tx limit applied');

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
