/**
 * OWS Wallet Service — real wallet via OWS CLI, mock for testing.
 *
 * Real mode: shells out to `ows` CLI for wallet creation, uses Solana RPC for balance.
 * Mock mode: in-memory balance, fake tx signatures.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { WalletService } from './types.js';

const exec = promisify(execFile);

// USDC mint on Solana mainnet
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// ---------------------------------------------------------------------------
// OWS CLI helpers
// ---------------------------------------------------------------------------

/** Create an OWS wallet. Returns the Solana address. */
export async function createOWSWallet(name: string): Promise<string> {
  try {
    // Check if wallet already exists
    const existing = await getWalletSolanaAddress(name);
    if (existing) return existing;
  } catch {
    // Wallet doesn't exist, create it
  }

  await exec('ows', ['wallet', 'create', '--name', name]);
  const address = await getWalletSolanaAddress(name);
  if (!address) throw new Error(`Failed to get Solana address for wallet "${name}"`);
  return address;
}

/** Get the Solana address for a named OWS wallet. */
export async function getWalletSolanaAddress(name: string): Promise<string | null> {
  const { stdout } = await exec('ows', ['wallet', 'list']);
  // Parse the OWS wallet list output — find the wallet by name, then its Solana address
  const lines = stdout.split('\n');
  let inWallet = false;

  for (const line of lines) {
    if (line.includes(`Name:`) && line.includes(name)) {
      inWallet = true;
      continue;
    }
    if (inWallet && line.includes('solana:') && line.includes('(solana)')) {
      // Format: "  solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp (solana) → <ADDRESS>"
      const match = line.match(/→\s+(\S+)/);
      if (match) return match[1];
    }
    // If we hit the next wallet or end, stop
    if (inWallet && line.startsWith('ID:')) {
      break;
    }
  }

  return null;
}

/**
 * Get USDC balance for a Solana address using RPC.
 * Returns balance in USDC (6 decimals).
 */
export async function getUSDCBalance(address: string, rpcUrl?: string): Promise<number> {
  const url = rpcUrl ?? process.env['HELIUS_RPC_URL'] ?? 'https://api.mainnet-beta.solana.com';

  // Get token accounts for USDC
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [
        address,
        { mint: USDC_MINT },
        { encoding: 'jsonParsed' },
      ],
    }),
  });

  const data = await response.json() as {
    result?: {
      value: Array<{
        account: {
          data: {
            parsed: {
              info: {
                tokenAmount: { uiAmount: number };
              };
            };
          };
        };
      }>;
    };
  };

  if (!data.result?.value?.length) return 0;

  // Sum all USDC token accounts (usually just one)
  let total = 0;
  for (const account of data.result.value) {
    total += account.account.data.parsed.info.tokenAmount.uiAmount;
  }
  return total;
}

/**
 * Make an x402 payment using `ows pay request`.
 * This handles the full 402 flow: request → 402 → pay → receipt → retry.
 */
export async function owsPayRequest(
  walletName: string,
  url: string,
  method: string,
  body?: string,
): Promise<{ tx: string; response: string }> {
  const args = ['pay', 'request', '--wallet', walletName, '--method', method, '--no-passphrase', url];
  if (body) {
    args.splice(args.length - 1, 0, '--body', body);
  }

  const { stdout } = await exec('ows', args, { timeout: 30_000 });
  // OWS pay request returns the API response after handling payment
  // We need to extract the tx from the response
  // For now, return the raw output — the tx is logged by OWS
  return { tx: `ows_pay_${Date.now()}`, response: stdout };
}

// ---------------------------------------------------------------------------
// WalletService factory
// ---------------------------------------------------------------------------

/** Mock balance tracker (shared across all mock wallets in a session) */
let mockBalance = 1000;

export function createWalletService(mock: boolean): WalletService {
  if (mock) {
    return {
      async getBalance() {
        return mockBalance;
      },
      async payX402(params) {
        if (params.amount > mockBalance) {
          throw new Error(`Insufficient mock balance: ${mockBalance} USDC, need ${params.amount}`);
        }
        mockBalance -= params.amount;
        return { tx: `mock_pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
      },
    };
  }

  // Real mode — uses OWS CLI
  const walletName = process.env['OWS_WALLET_NAME'] ?? 'steward-main';
  let cachedAddress: string | null = null;

  return {
    async getBalance() {
      if (!cachedAddress) {
        cachedAddress = await getWalletSolanaAddress(walletName);
      }
      if (!cachedAddress) throw new Error(`OWS wallet "${walletName}" not found`);
      return getUSDCBalance(cachedAddress);
    },

    async payX402(params) {
      // For direct USDC transfers (guest → steward), the payment comes FROM the guest.
      // For x402 service payments (steward → service), we use ows pay request.
      // This payX402 wraps the x402 flow for outgoing service payments.
      const { tx } = await owsPayRequest(
        walletName,
        params.recipient, // recipient URL for x402
        'POST',
        JSON.stringify({ amount: params.amount, currency: params.currency, description: params.description }),
      );
      return { tx };
    },
  };
}

/** Reset mock balance (for tests). */
export function resetMockBalance(amount = 1000): void {
  mockBalance = amount;
}
