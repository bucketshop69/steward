// Cleaning plugin — implement in issue #017

import type { Plugin } from '../types.js';

export const cleaningPlugin: Plugin = {
  name: 'cleaning',
  description: 'Schedule cleaning services for the property',
  triggers: ['clean', 'cleaning', 'housekeeping', 'tidy', 'maid'],
  async handle(_params) {
    // TODO: implement in issue #017
    return { message: 'Cleaning plugin not yet implemented. See issue #017.' };
  },
};
