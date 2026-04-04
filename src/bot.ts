import { Bot, Context, GrammyError, HttpError } from 'grammy';
import { getPropertyByGroupId, getHostTelegramId } from './store/properties.js';
import { getBookingByGroupId, getActiveBooking } from './store/bookings.js';
import { processMessage } from './agent.js';
import { checkLifecycleEvents } from './lifecycle.js';
import { readConfig } from './store/steward.js';

export interface BotOptions {
  mock: boolean;
}

// Per-group pause state (host can pause the agent)
const pausedGroups = new Set<number>();

function isHostMessage(senderId: number): boolean {
  return senderId === getHostTelegramId();
}

function hasStewardMention(text: string): boolean {
  return /@steward/i.test(text);
}

function parseStewardCommand(text: string): string | null {
  const match = text.match(/@steward\S*\s+(.+)/i);
  return match ? match[1].trim().toLowerCase() : null;
}

export async function createInviteLink(bot: Bot, groupId: number): Promise<string> {
  const link = await bot.api.createChatInviteLink(groupId, {
    name: 'Steward Guest Invite',
    creates_join_request: false,
  });
  return link.invite_link;
}

export async function startBot(options: BotOptions): Promise<void> {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN not set. Run: steward init');
    process.exit(1);
  }

  const bot = new Bot(token);
  const mock = options.mock;

  // /start command
  bot.command('start', async (ctx) => {
    await ctx.reply(
      'I\'m Steward, your AI property host assistant.\n\n' +
      'I help guests with check-in info, food orders, transport, cleaning, and more.\n\n' +
      'The property host can take over at any time by typing in this group.'
    );
  });

  // /help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
      'What I can help with:\n\n' +
      '- Check-in instructions & WiFi\n' +
      '- Food delivery orders\n' +
      '- Taxi/transport booking\n' +
      '- Cleaning scheduling\n' +
      '- Event tickets\n' +
      '- Maintenance issues\n\n' +
      'Just ask in plain language!\n\n' +
      'Host commands:\n' +
      '  @steward handle this — resume agent\n' +
      '  @steward stop — pause agent\n' +
      '  @steward summary — booking summary'
    );
  });

  // New member detection (guest onboarding)
  bot.on('message:new_chat_members', async (ctx) => {
    const groupId = ctx.chat.id;
    const property = getPropertyByGroupId(groupId);
    if (!property) return;

    const newMembers = ctx.message.new_chat_members;
    for (const member of newMembers) {
      if (member.is_bot) continue;

      const booking = getActiveBooking(groupId);

      if (booking) {
        await ctx.reply(
          `Welcome to ${property.name}! I'm Steward, your property assistant.\n\n` +
          `I can help with check-in, local recommendations, food orders, transport, ` +
          `and anything else you need during your stay.\n\n` +
          `Are you ${booking.guestName}? (Just confirming so I can load your booking.)`
        );
      } else {
        await ctx.reply(
          `Welcome to ${property.name}! I'm Steward, your property assistant.\n\n` +
          `I don't see an active booking for this property yet. ` +
          `The host may need to set one up.`
        );
      }
    }
  });

  // Main message handler (text messages in groups)
  bot.on('message:text', async (ctx) => {
    const groupId = ctx.chat.id;
    const senderId = ctx.from.id;
    const text = ctx.message.text;

    // Only handle group/supergroup messages
    if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') return;

    // Look up property for this group
    const property = getPropertyByGroupId(groupId);
    if (!property) {
      console.log(`📍 Unlinked group message — group ID: ${groupId} | sender: ${senderId}`);
      return;
    }

    // Host message handling
    if (isHostMessage(senderId)) {
      if (hasStewardMention(text)) {
        console.log(`🏠 Host command: "${text}"`);
        const command = parseStewardCommand(text);
        await handleHostCommand(ctx, command, groupId, mock);
      } else {
        console.log(`🏠 Host is talking — agent stays quiet ("${text.slice(0, 50)}")`);
      }
      return;
    }

    console.log(`💬 Guest message from ${senderId}: "${text.slice(0, 80)}"`);

    // Agent is paused in this group
    if (pausedGroups.has(groupId)) return;

    // Guest or unknown message → forward to agent
    try {
      const response = await processMessage(groupId, senderId, text, mock);
      if (response) {
        console.log(`🤖 Agent response: "${response.slice(0, 150)}${response.length > 150 ? '...' : ''}"`);
        await ctx.reply(response);
      }
    } catch (err) {
      console.error('Agent error:', err);
      await ctx.reply(
        'Sorry, I ran into an issue processing your request. ' +
        'The host has been notified.'
      );
    }
  });

  // Error handler
  bot.catch((err) => {
    const ctx = err.ctx;
    const e = err.error;
    console.error(`Error handling update ${ctx.update.update_id}:`);
    if (e instanceof GrammyError) {
      console.error('Grammy error:', e.description);
    } else if (e instanceof HttpError) {
      console.error('HTTP error:', e);
    } else {
      console.error('Unknown error:', e);
    }
  });

  // Startup info
  const config = readConfig();
  const allBookings = config.groups.flatMap((g) => g.bookings);
  const activeBookings = allBookings.filter((b) => b.status === 'active' || b.status === 'pending');
  const walletName = process.env['OWS_WALLET_NAME'] ?? 'steward-main';

  console.log(`
🏠 Steward is running!
   Mode: ${mock ? 'mock' : 'production'}
   Groups: ${config.groups.length} configured
   Active bookings: ${activeBookings.length}
   Wallet: ${walletName}${mock ? ' (mock mode)' : ''}

   Listening for messages...
  `);

  // Fire any lifecycle events on startup
  const lifecycleMessages = checkLifecycleEvents();
  for (const msg of lifecycleMessages) {
    try {
      await bot.api.sendMessage(msg.groupId, msg.text);
    } catch (err) {
      console.error(`Failed to send lifecycle message to group ${msg.groupId}:`, (err as Error).message);
    }
  }

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down Steward...');
    bot.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await bot.start();
}

async function handleHostCommand(
  ctx: Context,
  command: string | null,
  groupId: number,
  _mock: boolean,
): Promise<void> {
  if (!command) {
    await ctx.reply('Use: @steward handle this | stop | summary');
    return;
  }

  if (command.startsWith('handle') || command === 'resume') {
    pausedGroups.delete(groupId);
    await ctx.reply('Agent resumed. I\'m listening for guest messages.');
    return;
  }

  if (command === 'stop' || command === 'pause') {
    pausedGroups.add(groupId);
    await ctx.reply('Agent paused. I won\'t respond to guests until you say @steward handle this.');
    return;
  }

  if (command === 'summary') {
    const booking = getActiveBooking(groupId);
    if (!booking) {
      await ctx.reply('No active booking for this group.');
      return;
    }

    const property = getPropertyByGroupId(groupId);
    let summary = `📊 Booking summary: ${booking.guestName}\n`;
    summary += `   Property: ${property?.name ?? 'unknown'}\n`;
    summary += `   ${booking.checkIn} → ${booking.checkOut}\n`;
    summary += `   Status: ${booking.status}`;

    await ctx.reply(summary);
    return;
  }

  await ctx.reply(`Unknown command: "${command}". Use: handle this | stop | summary`);
}
