// Food delivery plugin — implement in issue #016

import type { Plugin } from '../types.js';

export const foodPlugin: Plugin = {
  name: 'food-delivery',
  description: 'Order food delivery from local restaurants',
  triggers: ['food', 'hungry', 'dinner', 'lunch', 'breakfast', 'order food', 'eat', 'pizza', 'restaurant'],
  async handle(_params) {
    // TODO: implement in issue #016
    return { message: 'Food plugin not yet implemented. See issue #016.' };
  },
};
