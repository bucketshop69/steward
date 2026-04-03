// Taxi plugin — implement in issue #018

import type { Plugin } from '../types.js';

export const taxiPlugin: Plugin = {
  name: 'taxi',
  description: 'Book taxi or transport services',
  triggers: ['taxi', 'ride', 'uber', 'transport', 'car', 'pickup', 'airport', 'drive'],
  async handle(_params) {
    // TODO: implement in issue #018
    return { message: 'Taxi plugin not yet implemented. See issue #018.' };
  },
};
