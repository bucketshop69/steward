/**
 * x402 Payment Protocol Client
 *
 * Implements the HTTP 402 payment flow:
 * 1. Client sends request to x402-gated endpoint
 * 2. Server responds 402 with payment requirements in x-402-payment header (base64 JSON)
 * 3. Client pays via OWS wallet
 * 4. Client re-sends request with x-402-receipt header
 * 5. Server verifies receipt and executes operation
 *
 * Reference: lpcli x402 implementation
 */

import type { WalletService } from './types.js';

export interface X402PaymentRequirement {
  version: number;
  chain: string;
  currency: string;
  amount: number;
  amount_human?: string;
  recipient: string;
  description: string;
}

export interface X402Receipt {
  tx: string;
  amount: number;
  chain: string;
}

export interface PayAndRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * Make a request to an x402-gated endpoint, handling payment automatically.
 *
 * If the endpoint returns 402, parses the payment requirements, pays via wallet,
 * then retries with the receipt header.
 */
export async function payAndRequest(
  url: string,
  options: PayAndRequestOptions,
  wallet: WalletService,
): Promise<{ status: number; data: unknown; receipt?: X402Receipt }> {
  const method = options.method ?? 'POST';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Step 1: Initial request
  const initialResponse = await fetch(url, {
    method,
    headers,
    body: options.body,
  });

  // If not 402, return as-is
  if (initialResponse.status !== 402) {
    const data = await initialResponse.json().catch(() => null);
    return { status: initialResponse.status, data };
  }

  // Step 2: Parse 402 payment requirements
  const paymentB64 = initialResponse.headers.get('x-402-payment');
  if (!paymentB64) {
    throw new Error('x402: Server returned 402 but no x-402-payment header');
  }

  const paymentJson = Buffer.from(paymentB64, 'base64').toString('utf-8');
  const payment: X402PaymentRequirement = JSON.parse(paymentJson);

  // Step 3: Pay via wallet
  const { tx } = await wallet.payX402({
    amount: payment.amount,
    currency: payment.currency,
    recipient: payment.recipient,
    description: payment.description,
  });

  // Step 4: Build receipt and retry
  const receipt: X402Receipt = {
    tx,
    amount: payment.amount,
    chain: payment.chain,
  };

  // Receipt is sent as JSON string in the header
  // (matches lpcli x402 server's verifyPayment which parses JSON)
  const retryResponse = await fetch(url, {
    method,
    headers: {
      ...headers,
      'x-402-receipt': JSON.stringify(receipt),
    },
    body: options.body,
  });

  const data = await retryResponse.json().catch(() => null);
  return { status: retryResponse.status, data, receipt };
}

/**
 * Mock x402 request — skips the HTTP flow entirely.
 * Used when `--mock` is set.
 */
export async function mockPayAndRequest(
  _url: string,
  _options: PayAndRequestOptions,
  wallet: WalletService,
  amount: number,
  mockResponse: unknown,
): Promise<{ status: number; data: unknown; receipt?: X402Receipt }> {
  const { tx } = await wallet.payX402({
    amount,
    currency: 'USDC',
    recipient: 'MockService',
    description: 'Mock x402 payment',
  });

  return {
    status: 200,
    data: mockResponse,
    receipt: { tx, amount, chain: 'solana:mainnet' },
  };
}
