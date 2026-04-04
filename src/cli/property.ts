import readline from 'node:readline';
import { addProperty, listProperties, updateProperty } from '../store/properties.js';
import { readConfig, writeConfig } from '../store/steward.js';
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

async function addPropertyFlow(): Promise<void> {
  console.log('\n🏠 Add a Property\n');
  const rl = createPrompt();

  let telegramGroupId = 0;
  while (telegramGroupId === 0) {
    const val = await ask(rl, 'Telegram group ID (negative number like -1001234567890)');
    telegramGroupId = Number(val);
    if (isNaN(telegramGroupId) || telegramGroupId === 0) {
      console.log('  Must be a valid Telegram group ID.');
      telegramGroupId = 0;
    }
  }

  const name = await ask(rl, 'Property name');
  if (!name) { rl.close(); console.log('Property name is required.'); return; }

  const address = await ask(rl, 'Address');
  const checkInInstructions = await ask(rl, 'Check-in instructions');
  const houseRules = await ask(rl, 'House rules');
  const wifiName = await ask(rl, 'WiFi name');
  const wifiPassword = await ask(rl, 'WiFi password');
  const amenitiesRaw = await ask(rl, 'Amenities (comma-separated)');
  const amenities = amenitiesRaw ? amenitiesRaw.split(',').map((a) => a.trim()).filter(Boolean) : [];
  const nearbyPlaces = await ask(rl, 'Nearby places');

  rl.close();

  const property: Property = {
    name,
    address,
    checkInInstructions,
    houseRules,
    wifiName,
    wifiPassword,
    amenities,
    nearbyPlaces,
  };

  addProperty(telegramGroupId, property);

  console.log(`\n✅ Property added for group ${telegramGroupId}`);
  console.log(`  Name: ${name}`);
  console.log(`\nNext: steward booking add --group ${telegramGroupId}\n`);
}

function listPropertiesFlow(): void {
  const properties = listProperties();

  if (properties.length === 0) {
    console.log('\nNo properties configured. Run: steward property add\n');
    return;
  }

  console.log('\nProperties:\n');
  for (const p of properties) {
    console.log(`  Group ${p.groupId}  ${p.name}  ${p.address.slice(0, 30)}`);
  }
  console.log('');
}

export async function runProperty(subcommand: string, args: string[]): Promise<void> {
  switch (subcommand) {
    case 'add':
      await addPropertyFlow();
      break;
    case 'list':
      listPropertiesFlow();
      break;
    default:
      console.log(`
Usage:
  steward property add                          Add a new property
  steward property list                         List all properties
      `);
  }
}
