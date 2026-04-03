import type { Plugin } from '../types.js';

const BASE_COST_PER_PERSON = 15;
const DELIVERY_FEE = 5;
const PREMIUM_CUISINES = ['sushi', 'japanese', 'steak', 'seafood', 'french'];

function estimateCost(cuisine: string, people: number): number {
  const isPremium = PREMIUM_CUISINES.some((c) => cuisine.toLowerCase().includes(c));
  const perPerson = BASE_COST_PER_PERSON + (isPremium ? 5 : 0);
  return perPerson * people + DELIVERY_FEE;
}

export const foodPlugin: Plugin = {
  name: 'food-delivery',
  description: 'Order food delivery from local restaurants',
  triggers: ['food', 'hungry', 'dinner', 'lunch', 'breakfast', 'order food', 'eat', 'pizza', 'restaurant'],

  async handle(params) {
    const input = params.request ? JSON.parse(params.request) : {};
    const cuisine = input.cuisine ?? 'local food';
    const people = input.people ?? 1;
    const dietary = input.dietary ?? params.guest.preferences ?? '';
    const specialRequests = input.special_requests ?? '';

    const cost = estimateCost(cuisine, people);

    let tx: string;
    if (params.mock) {
      tx = `mock_food_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    } else {
      const payResult = await params.wallet.payX402({
        amount: cost,
        currency: 'USDC',
        recipient: 'FoodServiceWallet',
        description: `Food delivery: ${cuisine} for ${people}`,
      });
      tx = payResult.tx;
    }

    let details = `${cuisine} for ${people}`;
    if (dietary) details += ` (${dietary})`;
    if (specialRequests) details += ` — ${specialRequests}`;

    return {
      message: `Ordered! ${details}. Total: $${cost} USDC. Arriving in ~30 min.`,
      transaction: {
        amount: cost,
        recipient: 'FoodService',
        description: `Food delivery: ${details}`,
        tx,
      },
    };
  },
};
