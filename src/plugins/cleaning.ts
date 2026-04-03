import type { Plugin } from '../types.js';

const CLEANING_COSTS: Record<string, number> = {
  standard: 50,
  deep: 120,
};

export const cleaningPlugin: Plugin = {
  name: 'cleaning',
  description: 'Schedule cleaning services for the property',
  triggers: ['clean', 'cleaning', 'housekeeping', 'tidy', 'maid'],

  async handle(params) {
    const input = params.request ? JSON.parse(params.request) : {};
    const type = input.type ?? 'standard';
    const date = input.date ?? 'today';
    const notes = input.notes ?? '';

    const cost = CLEANING_COSTS[type] ?? CLEANING_COSTS['standard'];

    let tx: string;
    if (params.mock) {
      tx = `mock_clean_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    } else {
      const payResult = await params.wallet.payX402({
        amount: cost,
        currency: 'USDC',
        recipient: 'CleaningServiceWallet',
        description: `${type} cleaning on ${date}`,
      });
      tx = payResult.tx;
    }

    let message = `${type.charAt(0).toUpperCase() + type.slice(1)} cleaning scheduled for ${date}. Cost: $${cost} USDC.`;
    if (notes) message += ` Notes: ${notes}`;

    return {
      message,
      transaction: {
        amount: cost,
        recipient: 'CleaningService',
        description: `${type} cleaning on ${date}`,
        tx,
      },
    };
  },
};
