import fs from 'node:fs';
import path from 'node:path';

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

console.log('\n🧠 Agent Tests\n');

// ── Module exports ──────────────────────────────────

console.log('Module exports:');
const agent = await import('../src/agent.js');
assert(typeof agent.processMessage === 'function', 'processMessage exported');
assert(typeof agent.clearHistory === 'function', 'clearHistory exported');
assert(typeof agent.getHistory === 'function', 'getHistory exported');

// ── Conversation history management ─────────────────

console.log('\nConversation history:');
agent.clearHistory(12345);
assert(agent.getHistory(12345).length === 0, 'empty history for new group');

// ── Tool definitions completeness ───────────────────

console.log('\nTool definitions:');
const agentSource = fs.readFileSync(path.resolve('src/agent.ts'), 'utf-8');
const expectedTools = [
  'getPropertyByGroup',
  'identifyUser',
  'getBooking',
  'getPropertyInfo',
  'linkGuest',
  'escalateToHost',
];

for (const tool of expectedTools) {
  assert(agentSource.includes(tool), `agent imports ${tool}`);
}

const expectedToolNames = [
  'get_property_by_group',
  'identify_user',
  'get_booking',
  'get_property_info',
  'link_guest',
  'escalate_to_host',
  'check_payment',
];

for (const name of expectedToolNames) {
  assert(agentSource.includes(`'${name}'`), `tool schema defined for ${name}`);
}

// ── System prompt ───────────────────────────────────

console.log('\nSystem prompt:');
assert(agentSource.includes('You are Steward'), 'system prompt defines Steward persona');
assert(agentSource.includes('get_property_by_group'), 'system prompt mentions context discovery');
assert(agentSource.includes('PAYMENT FLOW'), 'system prompt mentions payment flow');

// ── Tool use loop structure ─────────────────────────

console.log('\nTool use loop:');
assert(agentSource.includes('MAX_TOOL_DEPTH'), 'has max tool depth guard');
assert(agentSource.includes('tool_use'), 'handles tool_use blocks');
assert(agentSource.includes('tool_result'), 'sends tool_result blocks');
assert(agentSource.includes('callMinimax'), 'uses MiniMax API');

// ── History trimming ────────────────────────────────

console.log('\nHistory trimming:');
assert(agentSource.includes('history.length > 40'), 'trims history at 40 messages');
assert(agentSource.includes('history.slice(-40)'), 'keeps last 40 messages');

// ── Cleanup ─────────────────────────────────────────

cleanup();

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All agent tests passed! ✅\n');
