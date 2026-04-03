#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

// Load .env into process.env (no external dependency)
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

async function main() {
  switch (command) {
    case 'init': {
      const { runInit } = await import('./cli/init.js');
      await runInit();
      break;
    }

    case 'property': {
      const { runProperty } = await import('./cli/property.js');
      await runProperty(subcommand, args.slice(2));
      break;
    }

    case 'booking': {
      const { runBooking } = await import('./cli/booking.js');
      await runBooking(subcommand, args.slice(2));
      break;
    }

    case 'start': {
      const mock = args.includes('--mock');
      const { startBot } = await import('./bot.js');
      await startBot({ mock });
      break;
    }

    default:
      console.log(`
Steward — Autonomous AI Property Host

Usage:
  steward init                                  First-time setup
  steward property add                          Add a property
  steward property list                         List properties
  steward property link <id> <group-id>         Link property to Telegram group
  steward booking add --property <id>           Add a booking
  steward booking list                          List active bookings
  steward start                                 Start the bot
  steward start --mock                          Start with mock payments
      `);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
