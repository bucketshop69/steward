import fs from 'node:fs';
import path from 'node:path';

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

const { getUSDCBalance } = await import('../src/wallet.js');

const stewardAddr = process.env['STEWARD_WALLET'];
const guestAddr = process.env['GUEST_WALLET'];

if (stewardAddr) {
  const balance = await getUSDCBalance(stewardAddr);
  console.log(`Steward (${stewardAddr}) USDC balance: ${balance}`);
}

if (guestAddr) {
  const balance = await getUSDCBalance(guestAddr);
  console.log(`Guest (${guestAddr}) USDC balance: ${balance}`);
}

if (!stewardAddr && !guestAddr) {
  console.log('Set STEWARD_WALLET and/or GUEST_WALLET in .env');
}
