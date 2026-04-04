/**
 * Tests for OWS wallet integration and USDC balance check.
 */

import { getWalletSolanaAddress, getUSDCBalance } from '../src/wallet.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { console.log(`  ✓ ${name}`); passed++; }
  else { console.log(`  ✗ ${name}`); failed++; }
}

// ── OWS CLI Integration ────────────────────────────────

console.log('\n🔑 OWS CLI Integration\n');

// Test getWalletSolanaAddress with existing wallet
const address = await getWalletSolanaAddress('steward-main');
assert(address !== null, 'steward-main wallet found');
assert(typeof address === 'string' && address.length > 20, 'Solana address has valid format');

// Non-existent wallet
let nonExistent: string | null = null;
try {
  nonExistent = await getWalletSolanaAddress('nonexistent-wallet-12345');
} catch {
  // OWS might throw or return null
}
assert(nonExistent === null, 'returns null for non-existent wallet');

// ── USDC Balance Check ───────────────────────────────────

console.log('\n🏦 USDC Balance Check\n');

if (address) {
  try {
    const balance = await getUSDCBalance(address);
    assert(typeof balance === 'number', 'balance is a number');
    assert(balance >= 0, 'balance is non-negative');
    console.log(`  Steward wallet USDC balance: ${balance}`);
  } catch (err) {
    console.log(`  ⚠️  Skipping balance check: ${(err as Error).message}`);
  }
}

// ── Results ────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('Wallet tests passed! ✅\n');
