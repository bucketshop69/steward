import readline from 'node:readline';
import { addProperty, listProperties, getProperty, updateProperty } from '../store/properties.js';
import type { Property } from '../types.js';

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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function addPropertyFlow(): Promise<void> {
  console.log('\n🏠 Add a Property\n');
  const rl = createPrompt();

  const name = await ask(rl, 'Property name');
  if (!name) { rl.close(); console.log('Property name is required.'); return; }

  const id = slugify(name);

  // Check for duplicate
  const existing = listProperties().find((p) => p.id === id);
  if (existing) {
    rl.close();
    console.log(`Property "${id}" already exists.`);
    return;
  }

  const address = await ask(rl, 'Address');
  const checkInInstructions = await ask(rl, 'Check-in instructions');
  const houseRules = await ask(rl, 'House rules');
  const wifiName = await ask(rl, 'WiFi name');
  const wifiPassword = await ask(rl, 'WiFi password');
  const amenitiesRaw = await ask(rl, 'Amenities (comma-separated)');
  const amenities = amenitiesRaw ? amenitiesRaw.split(',').map((a) => a.trim()).filter(Boolean) : [];
  const nearbyPlaces = await ask(rl, 'Nearby places');

  let dailyBudget = 0;
  while (dailyBudget <= 0) {
    const val = await ask(rl, 'Daily budget (USDC)', '200');
    dailyBudget = Number(val);
    if (isNaN(dailyBudget) || dailyBudget <= 0) {
      console.log('  Must be a positive number.');
      dailyBudget = 0;
    }
  }

  let perTransactionLimit = 0;
  while (perTransactionLimit <= 0) {
    const val = await ask(rl, 'Per-transaction limit (USDC)', '100');
    perTransactionLimit = Number(val);
    if (isNaN(perTransactionLimit) || perTransactionLimit <= 0) {
      console.log('  Must be a positive number.');
      perTransactionLimit = 0;
    }
  }

  let hostTelegramId = 0;
  while (hostTelegramId <= 0) {
    const val = await ask(rl, 'Your Telegram user ID');
    hostTelegramId = Number(val);
    if (isNaN(hostTelegramId) || hostTelegramId <= 0) {
      console.log('  Must be a valid number. Send /start to @userinfobot on Telegram to get yours.');
      hostTelegramId = 0;
    }
  }

  rl.close();

  const property: Property = {
    id,
    name,
    address,
    hostTelegramId,
    checkInInstructions,
    houseRules,
    wifiName,
    wifiPassword,
    amenities,
    nearbyPlaces,
    dailyBudget,
    perTransactionLimit,
  };

  addProperty(property);

  console.log(`\n✅ Property added: ${id}`);
  console.log(`  Name: ${name}`);
  console.log(`  Budget: $${dailyBudget}/day, $${perTransactionLimit}/tx`);
  console.log(`\nNext: steward booking add --property ${id}\n`);
}

function listPropertiesFlow(): void {
  const properties = listProperties();

  if (properties.length === 0) {
    console.log('\nNo properties configured. Run: steward property add\n');
    return;
  }

  console.log('\nProperties:\n');
  const idWidth = Math.max(4, ...properties.map((p) => p.id.length)) + 2;
  const nameWidth = Math.max(4, ...properties.map((p) => p.name.length)) + 2;

  for (const p of properties) {
    const budget = `$${p.dailyBudget}/day`;
    console.log(`  ${p.id.padEnd(idWidth)}${p.name.padEnd(nameWidth)}${p.address.slice(0, 30).padEnd(32)}${budget}`);
  }
  console.log('');
}

function linkPropertyFlow(args: string[]): void {
  const propertyId = args[0];
  const groupIdStr = args[1];

  if (!propertyId || !groupIdStr) {
    console.log('\nUsage: steward property link <property-id> <telegram-group-id>\n');
    console.log('To get the group ID:');
    console.log('  1. Add the bot to your Telegram group');
    console.log('  2. Run: steward start');
    console.log('  3. Send any message in the group');
    console.log('  4. Check the bot logs for the group ID\n');
    return;
  }

  const property = getProperty(propertyId);
  if (!property) {
    console.log(`\nProperty "${propertyId}" not found. Run: steward property list\n`);
    return;
  }

  const groupId = Number(groupIdStr);
  if (isNaN(groupId) || groupId === 0) {
    console.log('\nInvalid group ID. Telegram group IDs are negative numbers like -1001234567890\n');
    return;
  }

  updateProperty(propertyId, { telegramGroupId: groupId });
  console.log(`\n✅ Linked "${property.name}" to Telegram group ${groupId}`);
  console.log(`\nNext: steward booking add --property ${propertyId}\n`);
}

export async function runProperty(subcommand: string, args: string[]): Promise<void> {
  switch (subcommand) {
    case 'add':
      await addPropertyFlow();
      break;
    case 'list':
      listPropertiesFlow();
      break;
    case 'link':
      linkPropertyFlow(args);
      break;
    default:
      console.log(`
Usage:
  steward property add                          Add a new property
  steward property list                         List all properties
  steward property link <id> <group-id>         Link property to Telegram group
      `);
  }
}
