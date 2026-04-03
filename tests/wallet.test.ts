/**
 * Tests for wallet service (mock + OWS CLI integration) and x402 client.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createWalletService, resetMockBalance, getWalletSolanaAddress } from '../src/wallet.js';
import { payAndRequest, mockPayAndRequest } from '../src/x402.js';
import type { WalletService } from '../src/types.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { console.log(`  ✓ ${name}`); passed++; }
  else { console.log(`  ✗ ${name}`); failed++; }
}

// ── Mock Wallet Service ────────────────────────────────

console.log('\n💰 Mock Wallet Service\n');

resetMockBalance(500);

const mockWallet = createWalletService(true);

const balance = await mockWallet.getBalance();
assert(balance === 500, 'mock balance starts at 500');

const payResult = await mockWallet.payX402({
  amount: 50,
  currency: 'USDC',
  recipient: 'TestRecipient',
  description: 'Test payment',
});
assert(payResult.tx.startsWith('mock_pay_'), 'mock tx has correct prefix');
assert(payResult.tx.length > 10, 'mock tx has reasonable length');

const balanceAfter = await mockWallet.getBalance();
assert(balanceAfter === 450, 'balance deducted after payment');

// Multiple payments
const pay2 = await mockWallet.payX402({ amount: 100, currency: 'USDC', recipient: 'R2', description: 'test' });
assert(pay2.tx.startsWith('mock_pay_'), 'second payment has mock prefix');
const bal2 = await mockWallet.getBalance();
assert(bal2 === 350, 'balance tracks multiple payments');

// Insufficient balance
let threw = false;
try {
  await mockWallet.payX402({ amount: 999, currency: 'USDC', recipient: 'R3', description: 'too much' });
} catch (err) {
  threw = true;
  assert((err as Error).message.includes('Insufficient'), 'error mentions insufficient balance');
}
assert(threw, 'throws on insufficient balance');

// Reset
resetMockBalance(1000);
const resetBal = await mockWallet.getBalance();
assert(resetBal === 1000, 'reset balance works');

// ── OWS CLI Integration ────────────────────────────────

console.log('\n🔑 OWS CLI Integration\n');

// Test getWalletSolanaAddress with existing wallet
const address = await getWalletSolanaAddress('steward-main');
assert(address !== null, 'steward-main wallet found');
assert(address === 'CvBCCiKACyFJkXPjXSTA2mxh5nD2o9CbtJNE8bjZD9v7', 'correct Solana address');

// Non-existent wallet
let nonExistent: string | null = null;
try {
  nonExistent = await getWalletSolanaAddress('nonexistent-wallet-12345');
} catch {
  // OWS might throw or return null
}
assert(nonExistent === null, 'returns null for non-existent wallet');

// ── x402 Mock Client ──────────────────────────────────

console.log('\n🔄 x402 Mock Client\n');

resetMockBalance(1000);
const x402Wallet = createWalletService(true);

const mockResult = await mockPayAndRequest(
  'http://fake-service.local/order',
  { method: 'POST', body: JSON.stringify({ item: 'pizza' }) },
  x402Wallet,
  25,
  { status: 'ok', orderId: 'ORD-001' },
);

assert(mockResult.status === 200, 'mock x402 returns 200');
assert((mockResult.data as { orderId: string }).orderId === 'ORD-001', 'mock x402 returns expected data');
assert(mockResult.receipt !== undefined, 'mock x402 has receipt');
assert(mockResult.receipt!.tx.startsWith('mock_pay_'), 'mock receipt has mock tx');
assert(mockResult.receipt!.amount === 25, 'receipt has correct amount');
assert(mockResult.receipt!.chain === 'solana:mainnet', 'receipt has correct chain');

const x402Bal = await x402Wallet.getBalance();
assert(x402Bal === 975, 'mock x402 deducted from balance');

// ── x402 Real Client (local test server) ──────────────

console.log('\n🌐 x402 Real Client (local test server)\n');

// Spin up a minimal x402-compliant test server
const TEST_PORT = 34100 + Math.floor(Math.random() * 900);
let serverRequestCount = 0;

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  serverRequestCount++;
  const receiptHeader = req.headers['x-402-receipt'] as string | undefined;

  if (!receiptHeader) {
    // No receipt — respond 402
    const payment = {
      version: 1,
      chain: 'solana:mainnet',
      currency: 'USDC',
      amount: 15,
      recipient: 'ServiceWalletAddress',
      description: 'Food delivery',
    };
    const paymentB64 = Buffer.from(JSON.stringify(payment)).toString('base64');

    res.writeHead(402, {
      'Content-Type': 'application/json',
      'x-402-version': '1',
      'x-402-payment': paymentB64,
    });
    res.end(JSON.stringify({ error: 'Payment Required', payment }));
    return;
  }

  // Has receipt — verify and respond success
  try {
    const receipt = JSON.parse(receiptHeader);
    if (!receipt.tx) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid receipt' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      orderId: 'FOOD-42',
      fee_tx: receipt.tx,
    }));
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Bad receipt format' }));
  }
});

await new Promise<void>((resolve) => server.listen(TEST_PORT, resolve));

try {
  resetMockBalance(1000);
  const realWallet = createWalletService(true); // mock wallet, real x402 flow

  const result = await payAndRequest(
    `http://localhost:${TEST_PORT}/order`,
    { method: 'POST', body: JSON.stringify({ cuisine: 'pizza', people: 2 }) },
    realWallet,
  );

  assert(result.status === 200, 'x402 flow returns 200 after payment');
  assert((result.data as { orderId: string }).orderId === 'FOOD-42', 'server returns order data');
  assert(result.receipt !== undefined, 'has payment receipt');
  assert(result.receipt!.tx.startsWith('mock_pay_'), 'receipt tx from mock wallet');
  assert(result.receipt!.amount === 15, 'receipt amount matches server requirement');
  assert(result.receipt!.chain === 'solana:mainnet', 'receipt chain is correct');
  assert(serverRequestCount === 2, 'server received exactly 2 requests (402 + retry)');

  const balAfterX402 = await realWallet.getBalance();
  assert(balAfterX402 === 985, 'wallet debited $15 after x402 payment');

  // Test non-402 endpoint (server that returns 200 directly)
  serverRequestCount = 0;
  const healthServer = createServer((_req, res) => {
    serverRequestCount++;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy' }));
  });

  const HEALTH_PORT = TEST_PORT + 1;
  await new Promise<void>((resolve) => healthServer.listen(HEALTH_PORT, resolve));

  const healthResult = await payAndRequest(
    `http://localhost:${HEALTH_PORT}/health`,
    { method: 'GET' },
    realWallet,
  );

  assert(healthResult.status === 200, 'non-402 response passes through');
  assert((healthResult.data as { status: string }).status === 'healthy', 'data passes through');
  assert(healthResult.receipt === undefined, 'no receipt for non-402');
  assert(serverRequestCount === 1, 'only 1 request for non-402');

  healthServer.close();
} finally {
  server.close();
}

// ── Real Wallet (balance check) ────────────────────────

console.log('\n🏦 Real Wallet Balance Check\n');

const realService = createWalletService(false);
try {
  const realBalance = await realService.getBalance();
  assert(typeof realBalance === 'number', 'real balance is a number');
  assert(realBalance >= 0, 'real balance is non-negative');
  console.log(`  Steward wallet USDC balance: ${realBalance}`);
} catch (err) {
  console.log(`  ⚠️  Skipping real balance check: ${(err as Error).message}`);
  // Not a failure — OWS wallet might not be set up in CI
}

// ── Results ────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All wallet + x402 tests passed! ✅\n');
