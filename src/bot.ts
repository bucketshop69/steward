import { Bot, Context, GrammyError, HttpError } from 'grammy';
import { getPropertyByGroupId } from './store/properties.js';
import { getBookingByGroupId, getActiveBooking } from './store/bookings.js';
import { processMessage } from './agent.js';

export interface BotOptions {
  mock: boolean;
}

// Per-group pause state (host can pause the agent)
const pausedGroups = new Set<number>();

function isHostMessage(senderId: number, hostTelegramId: number): boolean {
  return senderId === hostTelegramId;
}

function hasStewardMention(text: string): boolean {
  return /[@]steward/i.test(text);
}

function parseStewardCommand(text: string): string | null {
  const match = text.match(/@steward\s+(.+)/i);
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
      '  @steward summary — booking summary\n' +
      '  @steward budget — remaining budget'
    );
  });

  // New member detection (guest onboarding)
  bot.on('message:new_chat_members', async (ctx) => {
    const groupId = ctx.chat.id;
    const property = getPropertyByGroupId(groupId);
    if (!property) return;

    const newMembers = ctx.message.new_chat_members;
    for (const member of newMembers) {
      // Skip bots
      if (member.is_bot) continue;

      const booking = getActiveBooking(property.id) ??
        getBookingByGroupId(groupId);

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
    if (!property) return; // Not a managed group

    // Host message handling
    if (isHostMessage(senderId, property.hostTelegramId)) {
      if (hasStewardMention(text)) {
        const command = parseStewardCommand(text);
        await handleHostCommand(ctx, command, groupId, property.id, mock);
      }
      // Otherwise: host is talking, agent stays quiet
      return;
    }

    // Agent is paused in this group
    if (pausedGroups.has(groupId)) return;

    // Guest or unknown message → forward to agent
    try {
      const response = await processMessage(groupId, senderId, text, mock);
      if (response) {
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
  const properties = (await import('./store/properties.js')).listProperties();
  const bookings = (await import('./store/bookings.js')).listBookings();
  const activeBookings = bookings.filter((b) => b.status === 'active' || b.status === 'pending');

  console.log(`
🏠 Steward is running!
   Mode: ${mock ? 'mock' : 'production'}
   Properties: ${properties.length} configured
   Active bookings: ${activeBookings.length}

   Listening for messages...
  `);

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down Steward...');
    bot.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start polling
  await bot.start();
}

async function handleHostCommand(
  ctx: Context,
  command: string | null,
  groupId: number,
  propertyId: string,
  _mock: boolean,
): Promise<void> {
  if (!command) {
    await ctx.reply('Use: @steward handle this | stop | summary | budget');
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
    const { listTransactions } = await import('./store/transactions.js');
    const { getActiveBooking } = await import('./store/bookings.js');
    const booking = getActiveBooking(propertyId);
    if (!booking) {
      await ctx.reply('No active booking for this property.');
      return;
    }

    const txs = listTransactions(propertyId, booking.id);
    const total = txs.reduce((sum, t) => sum + t.amount, 0);

    const byPlugin = new Map<string, number>();
    for (const t of txs) {
      byPlugin.set(t.plugin, (byPlugin.get(t.plugin) ?? 0) + t.amount);
    }

    let summary = `📊 Booking summary: ${booking.guestName}\n`;
    summary += `   ${booking.checkIn} → ${booking.checkOut}\n`;
    summary += `   Status: ${booking.status}\n\n`;

    if (byPlugin.size > 0) {
      for (const [plugin, amount] of byPlugin) {
        const count = txs.filter((t) => t.plugin === plugin).length;
        summary += `   - ${plugin}: $${amount} USDC (${count} ${count === 1 ? 'order' : 'orders'})\n`;
      }
      summary += `\n   Total: $${total} USDC`;
    } else {
      summary += '   No transactions yet.';
    }

    await ctx.reply(summary);
    return;
  }

  if (command === 'budget') {
    const { getProperty } = await import('./store/properties.js');
    const { getTodaySpend } = await import('./store/transactions.js');
    const property = getProperty(propertyId);
    if (!property) return;

    const todaySpend = getTodaySpend(propertyId);
    const remaining = property.dailyBudget - todaySpend;

    await ctx.reply(
      `💰 Budget for ${property.name}\n\n` +
      `   Daily limit: $${property.dailyBudget} USDC\n` +
      `   Spent today: $${todaySpend} USDC\n` +
      `   Remaining: $${remaining} USDC\n` +
      `   Per-tx limit: $${property.perTransactionLimit} USDC`
    );
    return;
  }

  await ctx.reply(`Unknown command: "${command}". Use: handle this | stop | summary | budget`);
}
