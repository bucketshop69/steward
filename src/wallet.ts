// OWS wallet wrapper — implement in issue #021

import type { WalletService } from './types.js';

export function createWalletService(_mock: boolean): WalletService {
  // TODO: implement in issue #021
  return {
    async getBalance() {
      return 0;
    },
    async payX402(_params) {
      return { tx: 'not-implemented' };
    },
  };
}
