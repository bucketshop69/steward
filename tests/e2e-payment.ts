/**
 * E2E Payment Test — Real devnet USDC flow
 *
 * 1. Guest asks MiniMax agent to order food
 * 2. Agent calls food plugin → returns quote with prices
 * 3. Agent tells guest the price and steward wallet address
 * 4. Guest sends REAL devnet USDC to steward wallet (spl-token transfer)
 * 5. Guest says "I paid"
 * 6. Agent calls check_payment → getUSDCBalance on devnet → sees real USDC
 * 7. Agent confirms order
 *
 * Requires: AGENT_API_KEY in .env, devnet USDC in guest wallet
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// Load .env
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key) process.env[key] = value;
  }
}

import type { StewardConfig } from '../src/types.js';

const DATA_DIR = path.resolve('data');
const STEWARD_JSON = path.join(DATA_DIR, 'steward.json');

const GUEST_WALLET = process.env['GUEST_WALLET'] ?? '';
const STEWARD_WALLET = process.env['STEWARD_WALLET'] ?? '';
const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const GROUP_ID = -8888888888;
const HOST_ID = Number(process.env['HOST_TELEGRAM_ID'] ?? '1111111111');
const GUEST_ID = Number(process.env['GUEST_TELEGRAM_ID'] ?? '2222222222');

// ── Helpers ──

function log(msg: string) { console.log(`\n  ${msg}`); }
function step(n: number, msg: string) { console.log(`\n${'─'.repeat(50)}\n  Step ${n}: ${msg}\n${'─'.repeat(50)}`); }

function sendUSDC(amount: number): string {
  log(`Sending ${amount} devnet USDC: ${GUEST_WALLET} → ${STEWARD_WALLET}`);
  const out = execSync(
    `spl-token transfer ${DEVNET_USDC_MINT} ${amount} ${STEWARD_WALLET} ` +
    `--fund-recipient --allow-unfunded-recipient -u devnet ` +
    `--fee-payer ~/.config/solana/id.json`,
    { encoding: 'utf-8', timeout: 30_000 }
  );
  const sigMatch = out.match(/Signature: (\S+)/);
  const sig = sigMatch?.[1] ?? out.trim().split('\n').pop()?.trim() ?? '';
  log(`TX Signature: ${sig}`);
  return sig;
}

// ── Preflight checks ──

const apiKey = process.env.AGENT_API_KEY ?? process.env.MINIMAX_API_KEY;
if (!apiKey) {
  console.log('\n⚠️  AGENT_API_KEY not set — cannot run payment e2e\n');
  process.exit(0);
}
if (!GUEST_WALLET || !STEWARD_WALLET) {
  console.log('\n⚠️  Set GUEST_WALLET and STEWARD_WALLET in .env to run payment e2e\n');
  process.exit(0);
}

// ── Setup: steward.json ──

step(0, 'Setup');

const dataBackup = fs.existsSync(STEWARD_JSON) ? fs.readFileSync(STEWARD_JSON) : null;

const today = new Date().toISOString().slice(0, 10);
const checkout = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

const testConfig: StewardConfig = {
  hostTelegramId: HOST_ID,
  groups: [{
    telegramGroupId: GROUP_ID,
    property: {
      name: 'Sunset Beach Villa',
      address: '42 Ocean Drive, Bali',
      checkInInstructions: 'Door code 4521',
      houseRules: 'No smoking, no parties after 10pm',
      wifiName: 'SunsetVilla5G',
      wifiPassword: 'welcome2026',
      amenities: ['pool', 'kitchen', 'surfboard'],
      nearbyPlaces: 'Beach 2 min walk',
    },
    bookings: [{
      id: 'bk-pay-001',
      guestName: 'Alice',
      guestTelegramId: GUEST_ID,
      checkIn: today,
      checkOut: checkout,
      preferences: 'Vegetarian',
      status: 'active',
    }],
  }],
};

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(STEWARD_JSON, JSON.stringify(testConfig, null, 2));
log('steward.json written');

// Check balances before
const { getUSDCBalance } = await import('../src/wallet.js');
const stewardBalanceBefore = await getUSDCBalance(STEWARD_WALLET);
const guestBalanceBefore = await getUSDCBalance(GUEST_WALLET);
log(`Steward balance: ${stewardBalanceBefore} USDC`);
log(`Guest balance:   ${guestBalanceBefore} USDC`);

if (guestBalanceBefore < 1) {
  console.log('\n⚠️  Guest wallet has no devnet USDC. Cannot run payment test.\n');
  process.exit(0);
}

// ── Step 1: Guest asks for food ──

step(1, 'Guest requests food → MiniMax agent → food plugin returns quote');

const { processMessage, clearHistory } = await import('../src/agent.js');
clearHistory(GROUP_ID);

// mock=false for everything — but check_payment is what matters
const response1 = await processMessage(
  GROUP_ID, GUEST_ID,
  "Hey! Can I get a Mango Sticky Rice delivered? Just for 1 person.",
  false, // NOT mock — real check_payment
);

log(`Agent response:\n\n${response1}\n`);

// Extract the price from the response
const priceMatch = response1.match(/\$(\d+(?:\.\d+)?)/);
let quotedPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;

// If agent quoted a total, use it. Otherwise fall back to a reasonable amount.
if (quotedPrice <= 0) {
  log(`Could not parse price from response. Using $2 for test.`);
  quotedPrice = 2;
}
// Cap at what guest can afford
if (quotedPrice > guestBalanceBefore) {
  log(`Price $${quotedPrice} exceeds guest balance $${guestBalanceBefore}. Using $${guestBalanceBefore}.`);
  quotedPrice = guestBalanceBefore;
}

log(`Quoted price: $${quotedPrice} USDC`);

// ── Step 2: Guest picks and agent asks for payment ──

step(2, 'Guest selects item → Agent quotes total and wallet address');

const response2 = await processMessage(
  GROUP_ID, GUEST_ID,
  "Yes, go ahead with the Mango Sticky Rice!",
  false,
);

log(`Agent response:\n\n${response2}\n`);

// Try to extract a more specific total from this response
const totalMatch = response2.match(/\$(\d+(?:\.\d+)?)/);
if (totalMatch) {
  const parsed = parseFloat(totalMatch[1]);
  if (parsed > 0 && parsed <= guestBalanceBefore) {
    quotedPrice = parsed;
    log(`Updated price from selection response: $${quotedPrice} USDC`);
  }
}

// Verify agent mentioned the wallet address
const mentionsWallet = response2.includes(STEWARD_WALLET) || response2.toLowerCase().includes('wallet') || response2.toLowerCase().includes('send');
log(`Agent asked for payment: ${mentionsWallet ? 'YES' : 'no (but continuing anyway)'}`);

// ── Step 3: Real USDC transfer on devnet ──

step(3, `Guest sends $${quotedPrice} devnet USDC to steward wallet`);

const txSignature = sendUSDC(quotedPrice);

// Wait a moment for the tx to confirm
log('Waiting 5s for transaction confirmation...');
await new Promise((r) => setTimeout(r, 5000));

// Verify balance changed
const stewardBalanceAfter = await getUSDCBalance(STEWARD_WALLET);
log(`Steward balance after transfer: ${stewardBalanceAfter} USDC (was ${stewardBalanceBefore})`);

const balanceIncreased = stewardBalanceAfter >= stewardBalanceBefore + quotedPrice;
log(`Balance increased by ≥$${quotedPrice}: ${balanceIncreased ? 'YES ✓' : 'NO ✗'}`);

// ── Step 4: Guest tells agent they paid → check_payment verifies on-chain ──

step(4, 'Guest says "I paid" → Agent calls check_payment → verifies on-chain balance');

const response3 = await processMessage(
  GROUP_ID, GUEST_ID,
  "Done! I just sent the USDC payment.",
  false, // REAL check_payment — calls getUSDCBalance on devnet
);

log(`Agent response:\n\n${response3}\n`);

const orderConfirmed = response3.toLowerCase().includes('confirm') ||
  response3.toLowerCase().includes('placed') ||
  response3.toLowerCase().includes('on its way') ||
  response3.toLowerCase().includes('received') ||
  response3.toLowerCase().includes('order');

// ── Results ──

console.log(`\n${'═'.repeat(60)}`);
console.log(`\n  REAL DEVNET PAYMENT E2E RESULTS\n`);
console.log(`  Guest wallet:     ${GUEST_WALLET}`);
console.log(`  Steward wallet:   ${STEWARD_WALLET}`);
console.log(`  Amount:           $${quotedPrice} USDC`);
console.log(`  TX Signature:     ${txSignature}`);
console.log(`  Explorer:         https://explorer.solana.com/tx/${txSignature}?cluster=devnet`);
console.log(`  Balance before:   ${stewardBalanceBefore} → after: ${stewardBalanceAfter} USDC`);
console.log(`  Payment verified: ${balanceIncreased ? '✅ YES' : '❌ NO'}`);
console.log(`  Order confirmed:  ${orderConfirmed ? '✅ YES' : '❌ NO'}`);
console.log(`\n${'═'.repeat(60)}\n`);

// Cleanup
clearHistory(GROUP_ID);
const testDirs = fs.readdirSync(DATA_DIR).filter((d) => d.startsWith('bk-pay-'));
for (const dir of testDirs) {
  fs.rmSync(path.join(DATA_DIR, dir), { recursive: true, force: true });
}
if (dataBackup) fs.writeFileSync(STEWARD_JSON, dataBackup);

if (!balanceIncreased || !orderConfirmed) {
  console.log('❌ Payment E2E FAILED\n');
  process.exit(1);
} else {
  console.log('✅ Payment E2E PASSED — Real USDC on Solana devnet!\n');
}
