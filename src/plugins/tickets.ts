import type { Plugin } from '../types.js';

interface Activity {
  name: string;
  category: string;
  description: string;
  duration: string;
  pricePerPerson: number;
  available: string[];
}

// Simulated local activities near the property
const ACTIVITIES: Activity[] = [
  {
    name: 'City Walking Tour',
    category: 'tour',
    description: 'Guided 3-hour walk through historic center, markets, and street art',
    duration: '3 hours',
    pricePerPerson: 25,
    available: ['daily 9am', 'daily 2pm'],
  },
  {
    name: 'Sunset Sailing',
    category: 'activity',
    description: 'Catamaran cruise with drinks and snacks at sunset',
    duration: '2.5 hours',
    pricePerPerson: 55,
    available: ['daily 5pm (weather permitting)'],
  },
  {
    name: 'Surf Lesson',
    category: 'surf',
    description: 'Beginner-friendly lesson with board and wetsuit included',
    duration: '2 hours',
    pricePerPerson: 40,
    available: ['daily 8am', 'daily 11am', 'daily 3pm'],
  },
  {
    name: 'Cooking Class',
    category: 'activity',
    description: 'Learn to cook 3 local dishes with a chef, includes lunch',
    duration: '3 hours',
    pricePerPerson: 45,
    available: ['Tue/Thu/Sat 10am'],
  },
  {
    name: 'Scuba Diving',
    category: 'dive',
    description: 'Two-tank dive at reef sites, equipment included, certified divers',
    duration: '4 hours',
    pricePerPerson: 85,
    available: ['daily 7am', 'daily 1pm'],
  },
  {
    name: 'Museum Pass',
    category: 'museum',
    description: 'Day pass to the National Museum — art, history, and rooftop cafe',
    duration: 'Full day',
    pricePerPerson: 18,
    available: ['Tue-Sun 9am-6pm'],
  },
  {
    name: 'Spa & Wellness',
    category: 'spa',
    description: '90-minute massage, sauna, and pool access',
    duration: '2-3 hours',
    pricePerPerson: 70,
    available: ['daily 10am-8pm'],
  },
];

function findActivities(query: string): Activity[] {
  const lower = query.toLowerCase();

  let matches = ACTIVITIES.filter((a) =>
    a.name.toLowerCase().includes(lower) ||
    a.category.includes(lower) ||
    a.description.toLowerCase().includes(lower)
  );

  // If no match, return top picks
  if (matches.length === 0) matches = ACTIVITIES;

  return matches.slice(0, 5);
}

export const ticketsPlugin: Plugin = {
  name: 'tickets',
  description: 'Browse and get quotes for local activities and events',
  triggers: ['tickets', 'event', 'show', 'tour', 'activity', 'museum', 'concert', 'things to do'],

  async handle(params) {
    const input = params.request ? JSON.parse(params.request) : {};
    const event = input.event ?? '';
    const people = input.people ?? 1;
    const date = input.date ?? 'today';

    const activities = findActivities(event);

    const options = activities.map((a) => ({
      name: a.name,
      description: a.description,
      duration: a.duration,
      pricePerPerson: a.pricePerPerson,
      totalPrice: a.pricePerPerson * people,
      available: a.available,
    }));

    return {
      message: JSON.stringify({
        type: 'quote',
        date,
        people,
        options,
        note: 'Show these activities to the guest. Prices are in USDC. Guest must pay before booking is confirmed.',
      }),
    };
  },
};
