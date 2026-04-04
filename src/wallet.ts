/**
 * OWS Wallet — real wallet via OWS CLI, Solana RPC for balance.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

// USDC mints by network
const USDC_MINTS: Record<string, string> = {
  mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
};

function getUSDCMint(): string {
  const network = process.env['SOLANA_NETWORK'] ?? 'mainnet';
  return USDC_MINTS[network] ?? USDC_MINTS['mainnet'];
}

// ---------------------------------------------------------------------------
// OWS CLI helpers
// ---------------------------------------------------------------------------

/** Create an OWS wallet. Returns the Solana address. */
export async function createOWSWallet(name: string): Promise<string> {
  try {
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
  const lines = stdout.split('\n');
  let inWallet = false;

  for (const line of lines) {
    if (line.includes(`Name:`) && line.includes(name)) {
      inWallet = true;
      continue;
    }
    if (inWallet && line.includes('solana:') && line.includes('(solana)')) {
      const match = line.match(/→\s+(\S+)/);
      if (match) return match[1];
    }
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

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [
        address,
        { mint: getUSDCMint() },
        { encoding: 'jsonParsed', commitment: 'confirmed' },
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

  let total = 0;
  for (const account of data.result.value) {
    total += account.account.data.parsed.info.tokenAmount.uiAmount;
  }
  return total;
}

/**
 * Make an x402 payment using `ows pay request`.
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
  return { tx: `ows_pay_${Date.now()}`, response: stdout };
}
