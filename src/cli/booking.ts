import readline from 'node:readline';
import { addBooking, listBookings } from '../store/bookings.js';
import { getProperty, listProperties } from '../store/properties.js';
import type { Booking } from '../types.js';

function createPrompt(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl: readline.Interface, question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

function generateBookingId(checkIn: string): string {
  const mmdd = checkIn.slice(5, 7) + checkIn.slice(8, 10);
  const rand = Math.random().toString(36).slice(2, 6);
  return `bk-${mmdd}-${rand}`;
}

function isValidDate(dateStr: string): boolean {
  const match = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  if (!match) return false;
  const date = new Date(dateStr + 'T00:00:00');
  return !isNaN(date.getTime());
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

async function addBookingFlow(args: string[]): Promise<void> {
  // Parse --property flag
  const propIdx = args.indexOf('--property');
  let propertyId = propIdx !== -1 ? args[propIdx + 1] : undefined;

  if (!propertyId) {
    const properties = listProperties();
    if (properties.length === 0) {
      console.log('\nNo properties configured. Run: steward property add\n');
      return;
    }
    if (properties.length === 1) {
      propertyId = properties[0].id;
      console.log(`\nUsing property: ${properties[0].name} (${propertyId})`);
    } else {
      console.log('\nAvailable properties:');
      for (const p of properties) {
        console.log(`  ${p.id} — ${p.name}`);
      }
      const rl = createPrompt();
      propertyId = await ask(rl, '\nProperty ID');
      rl.close();
    }
  }

  const property = getProperty(propertyId!);
  if (!property) {
    console.log(`\nProperty "${propertyId}" not found. Run: steward property list\n`);
    return;
  }

  console.log(`\n📋 Add a Booking for ${property.name}\n`);
  const rl = createPrompt();

  const guestName = await ask(rl, 'Guest name');
  if (!guestName) { rl.close(); console.log('Guest name is required.'); return; }

  let checkIn = '';
  while (!checkIn) {
    checkIn = await ask(rl, 'Check-in date (YYYY-MM-DD)');
    if (!isValidDate(checkIn)) {
      console.log('  Invalid date format. Use YYYY-MM-DD.');
      checkIn = '';
    }
  }

  let checkOut = '';
  while (!checkOut) {
    checkOut = await ask(rl, 'Check-out date (YYYY-MM-DD)');
    if (!isValidDate(checkOut)) {
      console.log('  Invalid date format. Use YYYY-MM-DD.');
      checkOut = '';
    } else if (checkOut <= checkIn) {
      console.log('  Check-out must be after check-in.');
      checkOut = '';
    }
  }

  const preferences = await ask(rl, 'Guest preferences (optional)');
  const guestTelegramUsername = await ask(rl, 'Guest Telegram username (optional)');

  rl.close();

  const id = generateBookingId(checkIn);

  const booking: Booking = {
    id,
    propertyId: property.id,
    guestName,
    checkIn,
    checkOut,
    preferences: preferences || undefined,
    guestTelegramUsername: guestTelegramUsername || undefined,
    status: 'pending',
    totalSpent: 0,
  };

  addBooking(booking);

  console.log(`\n✅ Booking created: ${id}`);
  console.log(`  Guest: ${guestName}`);
  console.log(`  Dates: ${formatDate(checkIn)} - ${formatDate(checkOut)}`);
  console.log(`  Property: ${property.name}`);
  console.log(`\nNext: Start the bot with \`steward start\` to create the Telegram group.\n`);
}

function listBookingsFlow(): void {
  const bookings = listBookings();

  if (bookings.length === 0) {
    console.log('\nNo bookings. Run: steward booking add --property <id>\n');
    return;
  }

  console.log('\nBookings:\n');
  const idWidth = Math.max(4, ...bookings.map((b) => b.id.length)) + 2;
  const propWidth = Math.max(8, ...bookings.map((b) => b.propertyId.length)) + 2;
  const nameWidth = Math.max(5, ...bookings.map((b) => b.guestName.length)) + 2;

  for (const b of bookings) {
    const dates = `${formatDate(b.checkIn)} - ${formatDate(b.checkOut)}`;
    console.log(`  ${b.id.padEnd(idWidth)}${b.propertyId.padEnd(propWidth)}${b.guestName.padEnd(nameWidth)}${dates.padEnd(22)}${b.status}`);
  }
  console.log('');
}

export async function runBooking(subcommand: string, args: string[]): Promise<void> {
  switch (subcommand) {
    case 'add':
      await addBookingFlow(args);
      break;
    case 'list':
      listBookingsFlow();
      break;
    default:
      console.log(`
Usage:
  steward booking add --property <id>   Add a new booking
  steward booking list                  List all bookings
      `);
  }
}
