/**
 * x402 Payment Protocol Client
 *
 * Implements the HTTP 402 payment flow:
 * 1. Client sends request to x402-gated endpoint
 * 2. Server responds 402 with payment requirements in x-402-payment header (base64 JSON)
 * 3. Client pays via OWS wallet
 * 4. Client re-sends request with x-402-receipt header
 * 5. Server verifies receipt and executes operation
 */

import { owsPayRequest } from './wallet.js';

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
  walletName?: string;
}

/**
 * Make a request to an x402-gated endpoint, handling payment automatically.
 */
export async function payAndRequest(
  url: string,
  options: PayAndRequestOptions,
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

  // Step 3: Pay via OWS
  const walletName = options.walletName ?? process.env['OWS_WALLET_NAME'] ?? 'steward-main';
  const { tx } = await owsPayRequest(walletName, payment.recipient, 'POST', JSON.stringify({
    amount: payment.amount,
    currency: payment.currency,
  }));

  // Step 4: Build receipt and retry
  const receipt: X402Receipt = {
    tx,
    amount: payment.amount,
    chain: payment.chain,
  };

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
