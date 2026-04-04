/**
 * Tests for host agent module structure (no LLM calls).
 */

import fs from 'node:fs';
import path from 'node:path';
import { setConfigFile, resetConfigFile } from '../src/store/steward.js';

const DATA_DIR = path.resolve('data');
const STEWARD_TEST_JSON = path.join(DATA_DIR, 'steward.test.json');
let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { console.log(`  ✓ ${name}`); passed++; }
  else { console.log(`  ✗ ${name}`); failed++; }
}

setConfigFile(STEWARD_TEST_JSON);

console.log('\n🏠 Host Agent Tests\n');

// ── Module exports ──────────────────────────────────

console.log('Module exports:');
const hostAgent = await import('../src/host-agent.js');
assert(typeof hostAgent.processHostMessage === 'function', 'processHostMessage exported');
assert(typeof hostAgent.clearHostHistory === 'function', 'clearHostHistory exported');
assert(typeof hostAgent.getHostHistory === 'function', 'getHostHistory exported');

// ── History management ──────────────────────────────

console.log('\nHistory management:');
hostAgent.clearHostHistory();
assert(hostAgent.getHostHistory().length === 0, 'empty history after clear');

// ── Source code structure ───────────────────────────

console.log('\nSource structure:');
const source = fs.readFileSync(path.resolve('src/host-agent.ts'), 'utf-8');

assert(source.includes('HOST_SYSTEM_PROMPT'), 'has host system prompt');
assert(source.includes('HOST_TOOLS'), 'has host tools array');
assert(source.includes('add_property'), 'has add_property tool');
assert(source.includes('add_booking'), 'has add_booking tool');
assert(source.includes('list_properties'), 'has list_properties tool');
assert(source.includes('list_bookings'), 'has list_bookings tool');
assert(source.includes('get_status'), 'has get_status tool');
assert(source.includes('callMinimax'), 'uses MiniMax API');
assert(source.includes('MAX_TOOL_DEPTH'), 'has max tool depth guard');
assert(source.includes('property HOST'), 'system prompt identifies host');

// ── Bot integration ─────────────────────────────────

console.log('\nBot integration:');
const botSource = fs.readFileSync(path.resolve('src/bot.ts'), 'utf-8');
assert(botSource.includes('processHostMessage'), 'bot imports processHostMessage');
assert(botSource.includes('private'), 'bot handles private messages');
assert(botSource.includes('Host DM'), 'bot logs host DM');

// ── Lifecycle timer ─────────────────────────────────

console.log('\nLifecycle timer:');
assert(botSource.includes('setInterval'), 'bot has lifecycle interval');
assert(botSource.includes('LIFECYCLE_INTERVAL_MS'), 'has interval constant');
assert(botSource.includes('clearInterval'), 'cleans up interval on shutdown');

// ── Cleanup ─────────────────────────────────────────

if (fs.existsSync(STEWARD_TEST_JSON)) fs.unlinkSync(STEWARD_TEST_JSON);
resetConfigFile();

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All host agent tests passed! ✅\n');
