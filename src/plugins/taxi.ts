import type { Plugin } from '../types.js';

const DESTINATION_COSTS: Record<string, number> = {
  airport: 50,
  downtown: 25,
  beach: 15,
  restaurant: 10,
};
const DEFAULT_COST = 25;

function estimateCost(destination: string): number {
  const lower = destination.toLowerCase();
  for (const [keyword, cost] of Object.entries(DESTINATION_COSTS)) {
    if (lower.includes(keyword)) return cost;
  }
  return DEFAULT_COST;
}

export const taxiPlugin: Plugin = {
  name: 'taxi',
  description: 'Book taxi or transport services',
  triggers: ['taxi', 'ride', 'uber', 'transport', 'car', 'pickup', 'airport', 'drive'],

  async handle(params) {
    const input = params.request ? JSON.parse(params.request) : {};
    const pickup = input.pickup ?? 'the property';
    const destination = input.destination ?? 'requested location';
    const time = input.time ?? 'now';
    const people = input.people ?? 1;

    const cost = estimateCost(destination);

    let tx: string;
    if (params.mock) {
      tx = `mock_taxi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    } else {
      const payResult = await params.wallet.payX402({
        amount: cost,
        currency: 'USDC',
        recipient: 'TaxiServiceWallet',
        description: `Taxi: ${pickup} → ${destination}`,
      });
      tx = payResult.tx;
    }

    const eta = time === 'now' ? '~10 min' : `at ${time}`;

    return {
      message: `Taxi booked! ${pickup} → ${destination} for ${people} passenger${people > 1 ? 's' : ''}. Cost: $${cost} USDC. Pickup ${eta}.`,
      transaction: {
        amount: cost,
        recipient: 'TaxiService',
        description: `Taxi: ${pickup} → ${destination}`,
        tx,
      },
    };
  },
};
