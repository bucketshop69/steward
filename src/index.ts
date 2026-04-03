#!/usr/bin/env node

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
  steward init                          First-time setup
  steward property add                  Add a property
  steward property list                 List properties
  steward booking add --property <id>   Add a booking
  steward booking list                  List active bookings
  steward start                         Start the bot
  steward start --mock                  Start with mocked plugins
      `);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
