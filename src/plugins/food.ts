import type { Plugin } from '../types.js';

interface MenuItem {
  name: string;
  description: string;
  price: number;
}

interface Restaurant {
  name: string;
  cuisine: string;
  deliveryTime: string;
  deliveryFee: number;
  menu: MenuItem[];
}

// Simulated local restaurants near the property
const RESTAURANTS: Restaurant[] = [
  {
    name: 'Mama Thai Kitchen',
    cuisine: 'thai',
    deliveryTime: '25-35 min',
    deliveryFee: 2,
    menu: [
      { name: 'Pad Thai', description: 'Rice noodles, shrimp, peanuts, lime', price: 12 },
      { name: 'Green Curry', description: 'Chicken, coconut milk, Thai basil, rice', price: 14 },
      { name: 'Tom Yum Soup', description: 'Spicy shrimp soup with lemongrass', price: 10 },
      { name: 'Mango Sticky Rice', description: 'Sweet coconut rice with fresh mango', price: 7 },
    ],
  },
  {
    name: 'Napoli Express',
    cuisine: 'pizza',
    deliveryTime: '20-30 min',
    deliveryFee: 1,
    menu: [
      { name: 'Margherita', description: 'Tomato, mozzarella, basil', price: 11 },
      { name: 'Pepperoni', description: 'Tomato, mozzarella, pepperoni', price: 13 },
      { name: 'Quattro Formaggi', description: 'Mozzarella, gorgonzola, parmesan, fontina', price: 14 },
      { name: 'Tiramisu', description: 'Classic Italian dessert', price: 8 },
    ],
  },
  {
    name: 'Sakura Sushi',
    cuisine: 'sushi',
    deliveryTime: '30-40 min',
    deliveryFee: 3,
    menu: [
      { name: 'Salmon Nigiri (6pc)', description: 'Fresh Atlantic salmon', price: 14 },
      { name: 'Dragon Roll (8pc)', description: 'Eel, avocado, cucumber, unagi sauce', price: 16 },
      { name: 'Bento Box', description: 'Chef\'s selection: sashimi, tempura, rice, miso', price: 22 },
      { name: 'Edamame', description: 'Steamed soybeans with sea salt', price: 5 },
    ],
  },
  {
    name: 'The Breakfast Club',
    cuisine: 'breakfast',
    deliveryTime: '20-25 min',
    deliveryFee: 1,
    menu: [
      { name: 'Pancake Stack', description: 'Fluffy pancakes, maple syrup, butter', price: 9 },
      { name: 'Eggs Benedict', description: 'Poached eggs, hollandaise, English muffin', price: 13 },
      { name: 'Acai Bowl', description: 'Acai, granola, banana, berries, honey', price: 11 },
      { name: 'Fresh Juice', description: 'Orange, mango, or green detox', price: 6 },
    ],
  },
  {
    name: 'Burger Barn',
    cuisine: 'burgers',
    deliveryTime: '15-25 min',
    deliveryFee: 1,
    menu: [
      { name: 'Classic Burger', description: 'Beef patty, lettuce, tomato, cheese', price: 11 },
      { name: 'BBQ Bacon Burger', description: 'Beef, bacon, cheddar, BBQ sauce, onion rings', price: 14 },
      { name: 'Veggie Burger', description: 'Plant-based patty, avocado, sprouts', price: 12 },
      { name: 'Loaded Fries', description: 'Cheese, bacon bits, sour cream, chives', price: 8 },
    ],
  },
];

function findRestaurants(cuisine: string, dietary: string): Restaurant[] {
  const lower = cuisine.toLowerCase();

  // Filter by cuisine preference
  let matches = RESTAURANTS.filter((r) =>
    r.cuisine.includes(lower) ||
    r.name.toLowerCase().includes(lower) ||
    r.menu.some((m) => m.name.toLowerCase().includes(lower) || m.description.toLowerCase().includes(lower))
  );

  // If no match, return all
  if (matches.length === 0) matches = RESTAURANTS;

  // Filter out non-dietary-friendly options (basic filter)
  if (dietary && (dietary.includes('vegetarian') || dietary.includes('vegan'))) {
    // Prefer restaurants with veggie options, but still show all
    matches.sort((a, b) => {
      const aVeg = a.menu.filter((m) => m.description.toLowerCase().includes('plant') || m.description.toLowerCase().includes('veg')).length;
      const bVeg = b.menu.filter((m) => m.description.toLowerCase().includes('plant') || m.description.toLowerCase().includes('veg')).length;
      return bVeg - aVeg;
    });
  }

  return matches.slice(0, 3);
}

export const foodPlugin: Plugin = {
  name: 'food-delivery',
  description: 'Browse restaurants and get food delivery quotes',
  triggers: ['food', 'hungry', 'dinner', 'lunch', 'breakfast', 'order food', 'eat', 'pizza', 'restaurant'],

  async handle(params) {
    const input = params.request ? JSON.parse(params.request) : {};
    const cuisine = input.cuisine ?? '';
    const people = input.people ?? 1;
    const dietary = input.dietary ?? params.guest.preferences ?? '';
    const specialRequests = input.special_requests ?? '';

    const restaurants = findRestaurants(cuisine, dietary);

    // Build response with options
    const options = restaurants.map((r) => ({
      restaurant: r.name,
      cuisine: r.cuisine,
      deliveryTime: r.deliveryTime,
      deliveryFee: r.deliveryFee,
      menu: r.menu.map((m) => ({
        item: m.name,
        description: m.description,
        price: m.price,
        priceForGroup: m.price * people,
      })),
    }));

    return {
      message: JSON.stringify({
        type: 'quote',
        restaurants: options,
        people,
        dietary: dietary || undefined,
        specialRequests: specialRequests || undefined,
        note: 'Show these options to the guest. Prices are in USDC. Add delivery fee to the total. Guest must pay before order is placed.',
      }),
    };
  },
};
