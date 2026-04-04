import type { Plugin } from '../types.js';

interface CleaningPackage {
  type: string;
  description: string;
  duration: string;
  price: number;
  includes: string[];
}

const PACKAGES: CleaningPackage[] = [
  {
    type: 'Quick Tidy',
    description: 'Light cleanup between days',
    duration: '~1 hour',
    price: 25,
    includes: ['Bed making', 'Bathroom wipe-down', 'Trash removal', 'Floor sweep'],
  },
  {
    type: 'Standard Clean',
    description: 'Full regular cleaning',
    duration: '~2 hours',
    price: 50,
    includes: ['All rooms vacuumed & mopped', 'Bathroom deep clean', 'Kitchen clean', 'Fresh linens', 'Trash & recycling'],
  },
  {
    type: 'Deep Clean',
    description: 'Thorough top-to-bottom cleaning',
    duration: '~3-4 hours',
    price: 120,
    includes: ['Everything in Standard', 'Appliance cleaning', 'Window cleaning', 'Upholstery refresh', 'Grout & tile scrub'],
  },
];

export const cleaningPlugin: Plugin = {
  name: 'cleaning',
  description: 'Get cleaning service quotes',
  triggers: ['clean', 'cleaning', 'housekeeping', 'tidy', 'maid'],

  async handle(params) {
    const input = params.request ? JSON.parse(params.request) : {};
    const date = input.date ?? 'today';
    const notes = input.notes ?? '';

    const options = PACKAGES.map((p) => ({
      type: p.type,
      description: p.description,
      duration: p.duration,
      price: p.price,
      includes: p.includes,
    }));

    return {
      message: JSON.stringify({
        type: 'quote',
        date,
        options,
        notes: notes || undefined,
        note: 'Show these cleaning packages to the guest. Prices are in USDC. Guest must pay before service is scheduled.',
      }),
    };
  },
};
