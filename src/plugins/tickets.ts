import type { Plugin } from '../types.js';

const EVENT_COSTS: Record<string, number> = {
  museum: 20,
  tour: 40,
  concert: 60,
  show: 50,
  activity: 35,
  dive: 80,
  surf: 45,
  spa: 70,
};
const DEFAULT_COST = 30;

function estimateCost(event: string): number {
  const lower = event.toLowerCase();
  for (const [keyword, cost] of Object.entries(EVENT_COSTS)) {
    if (lower.includes(keyword)) return cost;
  }
  return DEFAULT_COST;
}

export const ticketsPlugin: Plugin = {
  name: 'tickets',
  description: 'Book tickets for local events, tours, and attractions',
  triggers: ['tickets', 'event', 'show', 'tour', 'activity', 'museum', 'concert', 'booking'],

  async handle(params) {
    const input = params.request ? JSON.parse(params.request) : {};
    const event = input.event ?? 'local activity';
    const people = input.people ?? 1;
    const date = input.date ?? 'today';

    const perPerson = estimateCost(event);
    const cost = perPerson * people;

    let tx: string;
    if (params.mock) {
      tx = `mock_tickets_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    } else {
      const payResult = await params.wallet.payX402({
        amount: cost,
        currency: 'USDC',
        recipient: 'TicketServiceWallet',
        description: `${people}x ${event}`,
      });
      tx = payResult.tx;
    }

    return {
      message: `Booked! ${people} ticket${people > 1 ? 's' : ''} for ${event} on ${date}. Total: $${cost} USDC ($${perPerson}/person).`,
      transaction: {
        amount: cost,
        recipient: 'TicketService',
        description: `${people}x ${event} on ${date}`,
        tx,
      },
    };
  },
};
