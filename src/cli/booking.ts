import readline from 'node:readline';
import { addBooking, listBookings } from '../store/bookings.js';
import { readConfig } from '../store/steward.js';
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
  const config = readConfig();

  // Parse --group flag
  const groupIdx = args.indexOf('--group');
  let groupId: number | undefined = groupIdx !== -1 ? Number(args[groupIdx + 1]) : undefined;

  if (!groupId) {
    if (config.groups.length === 0) {
      console.log('\nNo properties configured. Run: steward property add\n');
      return;
    }
    if (config.groups.length === 1) {
      groupId = config.groups[0].telegramGroupId;
      console.log(`\nUsing group: ${groupId} (${config.groups[0].property.name})`);
    } else {
      console.log('\nAvailable groups:');
      for (const g of config.groups) {
        console.log(`  ${g.telegramGroupId} — ${g.property.name}`);
      }
      const rl = createPrompt();
      groupId = Number(await ask(rl, '\nGroup ID'));
      rl.close();
    }
  }

  const group = config.groups.find((g) => g.telegramGroupId === groupId);
  if (!group) {
    console.log(`\nNo property for group ${groupId}. Run: steward property list\n`);
    return;
  }

  console.log(`\n📋 Add a Booking for ${group.property.name}\n`);
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
    guestName,
    checkIn,
    checkOut,
    preferences: preferences || undefined,
    guestTelegramUsername: guestTelegramUsername || undefined,
    status: 'pending',
  };

  addBooking(groupId!, booking);

  console.log(`\n✅ Booking created: ${id}`);
  console.log(`  Guest: ${guestName}`);
  console.log(`  Dates: ${formatDate(checkIn)} - ${formatDate(checkOut)}`);
  console.log(`  Property: ${group.property.name}`);
  console.log(`\nNext: Start the bot with \`steward start\`\n`);
}

function listBookingsFlow(): void {
  const bookings = listBookings();

  if (bookings.length === 0) {
    console.log('\nNo bookings. Run: steward booking add\n');
    return;
  }

  console.log('\nBookings:\n');
  const idWidth = Math.max(4, ...bookings.map((b) => b.id.length)) + 2;
  const nameWidth = Math.max(5, ...bookings.map((b) => b.guestName.length)) + 2;

  for (const b of bookings) {
    const dates = `${formatDate(b.checkIn)} - ${formatDate(b.checkOut)}`;
    console.log(`  ${b.id.padEnd(idWidth)}${b.guestName.padEnd(nameWidth)}${dates.padEnd(22)}${b.status}`);
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
  steward booking add --group <group-id>   Add a new booking
  steward booking list                     List all bookings
      `);
  }
}
