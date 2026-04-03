// Tickets plugin — implement in issue #019

import type { Plugin } from '../types.js';

export const ticketsPlugin: Plugin = {
  name: 'tickets',
  description: 'Book tickets for local events, tours, and attractions',
  triggers: ['tickets', 'event', 'show', 'tour', 'activity', 'museum', 'concert', 'booking'],
  async handle(_params) {
    // TODO: implement in issue #019
    return { message: 'Tickets plugin not yet implemented. See issue #019.' };
  },
};
