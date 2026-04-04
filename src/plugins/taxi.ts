import type { Plugin } from '../types.js';

interface RideOption {
  type: string;
  description: string;
  capacity: number;
  baseCost: number;
  perKm: number;
  eta: string;
}

const RIDE_OPTIONS: RideOption[] = [
  { type: 'Economy', description: 'Standard sedan, A/C', capacity: 4, baseCost: 5, perKm: 1.5, eta: '5-10 min' },
  { type: 'Comfort', description: 'Premium sedan, leather seats', capacity: 4, baseCost: 8, perKm: 2.0, eta: '8-12 min' },
  { type: 'XL', description: 'SUV or minivan, fits luggage', capacity: 6, baseCost: 10, perKm: 2.5, eta: '10-15 min' },
];

// Simulated distance estimates
const DESTINATION_DISTANCES: Record<string, number> = {
  airport: 25,
  downtown: 12,
  beach: 5,
  mall: 8,
  restaurant: 4,
  market: 6,
  station: 15,
  hospital: 10,
};

function estimateDistance(destination: string): number {
  const lower = destination.toLowerCase();
  for (const [keyword, km] of Object.entries(DESTINATION_DISTANCES)) {
    if (lower.includes(keyword)) return km;
  }
  return 10; // default ~10km
}

export const taxiPlugin: Plugin = {
  name: 'taxi',
  description: 'Get ride quotes and book transport',
  triggers: ['taxi', 'ride', 'uber', 'transport', 'car', 'pickup', 'airport', 'drive'],

  async handle(params) {
    const input = params.request ? JSON.parse(params.request) : {};
    const pickup = input.pickup ?? 'the property';
    const destination = input.destination ?? 'requested location';
    const time = input.time ?? 'now';
    const people = input.people ?? 1;

    const distance = estimateDistance(destination);

    const options = RIDE_OPTIONS
      .filter((r) => r.capacity >= people)
      .map((r) => ({
        type: r.type,
        description: r.description,
        capacity: r.capacity,
        eta: time === 'now' ? r.eta : `Scheduled for ${time}`,
        price: Math.round(r.baseCost + r.perKm * distance),
        distance: `~${distance} km`,
      }));

    return {
      message: JSON.stringify({
        type: 'quote',
        pickup,
        destination,
        options,
        people,
        note: 'Show these ride options to the guest. Prices are in USDC. Guest must pay before ride is confirmed.',
      }),
    };
  },
};
