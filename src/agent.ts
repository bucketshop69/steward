import { callMinimax, type AnthropicMessage, type AnthropicToolDefinition, type ContentBlock } from './minimax.js';
import { getPropertyByGroup, identifyUser, getBooking } from './tools/context.js';
import { getPropertyInfo } from './tools/property.js';
import { linkGuest } from './tools/onboarding.js';
import { escalateToHost } from './tools/escalate.js';
import { executePlugin, getPluginToolSchemas } from './plugins/registry.js';
import { saveHistory, loadHistory, loadSnapshot, saveSnapshot, generateSnapshot, buildContextMessages } from './memory.js';
import { getBookingByGroupId } from './store/bookings.js';

const MAX_TOOL_DEPTH = 10;

// Per-group conversation history (in-memory)
const conversationHistory = new Map<number, AnthropicMessage[]>();

// Resolved lazily on first use
let _stewardWallet: string | null = null;
async function getStewardWallet(): Promise<string> {
  if (_stewardWallet) return _stewardWallet;
  const { getWalletSolanaAddress } = await import('./wallet.js');
  const walletName = process.env['OWS_WALLET_NAME'] ?? 'steward-main';
  const address = await getWalletSolanaAddress(walletName);
  if (!address) throw new Error(`OWS wallet "${walletName}" not found. Run: steward init`);
  _stewardWallet = address;
  return address;
}

function buildSystemPrompt(walletAddress: string): string {
  return `You are Steward, an AI property host assistant. You manage short-term rental properties via Telegram groups. You help guests with check-in info, local recommendations, food orders, transport, cleaning, and anything else they need during their stay.

You have access to tools to look up property info, order services, and escalate to the host. You discover everything through tool calls — you know nothing upfront.

PAYMENT FLOW — this is critical:
1. When a guest requests a paid service (food, taxi, tickets, cleaning), first call the plugin tool to get the price quote
2. The plugin returns the cost. Tell the guest the price and ask them to send USDC to the steward wallet: ${walletAddress}
3. When the guest confirms they've paid, call check_payment to verify the transaction
4. Only after payment is confirmed, tell the guest their order is placed

Rules:
- On every message, first call get_property_by_group to know which property this is
- Then call identify_user to know who you're talking to
- Guests are auto-linked when they join the group — no need to ask them to confirm identity
- If identify_user returns "unknown", treat them as the guest anyway and be helpful
- NEVER tell the guest an order is placed until payment is confirmed
- For maintenance issues, try simple troubleshooting first, then escalate
- Be friendly, helpful, and concise — this is a chat, not an email`;
}

const TOOL_DEFINITIONS: AnthropicToolDefinition[] = [
  {
    name: 'get_property_by_group',
    description: 'Look up which property a Telegram group belongs to. Call this first on every message.',
    input_schema: {
      type: 'object',
      properties: {
        group_id: { type: 'number', description: 'Telegram group/chat ID' },
      },
      required: ['group_id'],
    },
  },
  {
    name: 'identify_user',
    description: 'Identify who sent the message — guest, host, or unknown.',
    input_schema: {
      type: 'object',
      properties: {
        telegram_id: { type: 'number', description: 'Sender Telegram user ID' },
        group_id: { type: 'number', description: 'Telegram group ID' },
      },
      required: ['telegram_id', 'group_id'],
    },
  },
  {
    name: 'get_booking',
    description: 'Get current booking details including dates and guest info.',
    input_schema: {
      type: 'object',
      properties: {
        group_id: { type: 'number', description: 'Telegram group ID' },
        booking_id: { type: 'string', description: 'Specific booking ID (optional — defaults to active booking)' },
      },
      required: ['group_id'],
    },
  },
  {
    name: 'get_property_info',
    description: 'Get property details to answer guest questions about WiFi, rules, amenities, check-in, nearby places.',
    input_schema: {
      type: 'object',
      properties: {
        group_id: { type: 'number', description: 'Telegram group ID' },
      },
      required: ['group_id'],
    },
  },
  {
    name: 'link_guest',
    description: 'Connect a new Telegram user to a booking. Call when a guest confirms their identity.',
    input_schema: {
      type: 'object',
      properties: {
        telegram_id: { type: 'number', description: 'Guest Telegram user ID' },
        group_id: { type: 'number', description: 'Telegram group ID' },
        booking_ref: { type: 'string', description: 'Booking reference (optional — auto-finds pending booking)' },
      },
      required: ['telegram_id', 'group_id'],
    },
  },
  {
    name: 'escalate_to_host',
    description: 'Escalate an issue to the property host. Use when maintenance needed or you cannot resolve.',
    input_schema: {
      type: 'object',
      properties: {
        group_id: { type: 'number', description: 'Telegram group ID' },
        reason: { type: 'string', description: 'Clear explanation of what needs host attention' },
        urgency: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Urgency level' },
      },
      required: ['group_id', 'reason', 'urgency'],
    },
  },
  {
    name: 'check_payment',
    description: 'Check if USDC payment was received in the steward wallet. Call when guest says they have paid.',
    input_schema: {
      type: 'object',
      properties: {
        expected_amount: { type: 'number', description: 'Expected USDC amount' },
      },
      required: ['expected_amount'],
    },
  },
  ...getPluginToolSchemas(),
];

const PLUGIN_TOOL_NAMES = new Set(['order_food', 'book_cleaning', 'book_taxi', 'book_tickets', 'report_maintenance']);
const PLUGIN_NAME_MAP: Record<string, string> = {
  order_food: 'food-delivery',
  book_cleaning: 'cleaning',
  book_taxi: 'taxi',
  book_tickets: 'tickets',
  report_maintenance: 'maintenance',
};

function executeTool(name: string, input: Record<string, unknown>, groupId: number): string {
  try {
    switch (name) {
      case 'get_property_by_group': {
        const result = getPropertyByGroup(input.group_id as number);
        return JSON.stringify(result ?? { error: 'No property found for this group' });
      }
      case 'identify_user': {
        const result = identifyUser(input.telegram_id as number, (input.group_id as number) ?? groupId);
        return JSON.stringify(result);
      }
      case 'get_booking': {
        const result = getBooking((input.group_id as number) ?? groupId, input.booking_id as string | undefined);
        return JSON.stringify(result ?? { error: 'No active booking found' });
      }
      case 'get_property_info': {
        const result = getPropertyInfo((input.group_id as number) ?? groupId);
        return JSON.stringify(result ?? { error: 'Property not found' });
      }
      case 'link_guest': {
        const result = linkGuest(
          input.telegram_id as number,
          (input.group_id as number) ?? groupId,
          input.booking_ref as string | undefined,
        );
        return JSON.stringify(result);
      }
      case 'escalate_to_host': {
        const result = escalateToHost(
          (input.group_id as number) ?? groupId,
          input.reason as string,
          input.urgency as 'low' | 'medium' | 'high',
        );
        return JSON.stringify(result);
      }
      default: {
        if (PLUGIN_TOOL_NAMES.has(name)) {
          const pluginName = PLUGIN_NAME_MAP[name];
          return JSON.stringify({ pending_plugin: pluginName, input });
        }
        return JSON.stringify({ error: `Unknown tool: ${name}` });
      }
    }
  } catch (err) {
    return JSON.stringify({ error: `Tool error: ${(err as Error).message}` });
  }
}

async function executePluginTool(
  name: string,
  input: Record<string, unknown>,
  guestInfo?: { name: string; telegramId: number; preferences?: string },
  groupId?: number,
): Promise<string> {
  const pluginName = PLUGIN_NAME_MAP[name];
  if (!pluginName) return JSON.stringify({ error: `Unknown plugin tool: ${name}` });

  const { getPropertyByGroupId } = await import('./store/properties.js');
  const property = groupId ? getPropertyByGroupId(groupId) : undefined;

  if (!property) {
    return JSON.stringify({ error: 'Property context not available for plugin execution' });
  }

  const result = await executePlugin(pluginName, {
    guest: guestInfo ?? { name: 'Guest', telegramId: 0 },
    property,
    request: JSON.stringify(input),
  });

  return JSON.stringify(result);
}

export async function processMessage(
  groupId: number,
  senderId: number,
  message: string,
  mock: boolean,
): Promise<string> {
  // Get or initialize conversation history for this group
  let history = conversationHistory.get(groupId) ?? [];

  // On first message in session, try to restore from disk
  if (history.length === 0) {
    const booking = getBookingByGroupId(groupId);
    if (booking) {
      const saved = loadHistory(booking);
      const snapshot = loadSnapshot(booking);
      if (saved.length > 0) {
        history = buildContextMessages(saved, snapshot);
      }
    }
  }

  // Add user message with context metadata
  history.push({
    role: 'user',
    content: `[group_id=${groupId}, sender_id=${senderId}] ${message}`,
  });

  // Trim history if too long (keep last 40 messages)
  if (history.length > 40) {
    history = history.slice(-40);
  }

  // Resolve wallet address for system prompt and payment checks
  const stewardWallet = await getStewardWallet();
  const systemPrompt = buildSystemPrompt(stewardWallet);

  // Track context discovered during tool calls
  let discoveredGuest: { name: string; telegramId: number; preferences?: string } | undefined;

  // Tool use loop
  let depth = 0;
  while (depth < MAX_TOOL_DEPTH) {
    let response;
    try {
      response = await callMinimax(history, TOOL_DEFINITIONS, systemPrompt);
    } catch (err) {
      const msg = (err as Error).message;
      // Stale tool_use ID in history — reset and retry with just the latest message
      if (msg.includes('tool_result') || msg.includes('tool id') || msg.includes('2013')) {
        console.warn('[agent] Stale history detected, resetting conversation');
        history = [history[history.length - 1]];
        conversationHistory.set(groupId, history);
        response = await callMinimax(history, TOOL_DEFINITIONS, systemPrompt);
      } else {
        throw err;
      }
    }

    // Check for tool use
    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use') as Extract<ContentBlock, { type: 'tool_use' }>[];

    if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
      const textBlock = response.content.find((b) => b.type === 'text') as Extract<ContentBlock, { type: 'text' }> | undefined;
      const text = textBlock?.text ?? '';

      history.push({ role: 'assistant', content: response.content });
      conversationHistory.set(groupId, history);
      persistHistory(groupId, history);

      return text;
    }

    // Execute tool calls
    history.push({ role: 'assistant', content: response.content });

    for (const toolUse of toolUseBlocks) {
      const toolInput = toolUse.input as Record<string, unknown>;
      let result: string;

      if (PLUGIN_TOOL_NAMES.has(toolUse.name)) {
        result = await executePluginTool(toolUse.name, toolInput, discoveredGuest, groupId);
      } else if (toolUse.name === 'check_payment') {
        const expectedAmount = toolInput.expected_amount as number;
        if (mock) {
          result = JSON.stringify({
            received: true,
            amount: expectedAmount,
            wallet: stewardWallet,
            message: `Payment of $${expectedAmount} USDC confirmed (mock mode)`,
          });
        } else {
          try {
            const { getUSDCBalance } = await import('./wallet.js');
            const balance = await getUSDCBalance(stewardWallet);
            result = JSON.stringify({
              received: balance >= expectedAmount,
              balance,
              expected: expectedAmount,
              wallet: stewardWallet,
              message: balance >= expectedAmount
                ? `Payment confirmed! Balance: $${balance} USDC`
                : `Waiting for payment. Current balance: $${balance} USDC, need $${expectedAmount} USDC`,
            });
          } catch (err) {
            result = JSON.stringify({ received: false, error: (err as Error).message });
          }
        }
      } else {
        result = executeTool(toolUse.name, toolInput, groupId);

        // Capture guest context from identify_user
        if (toolUse.name === 'identify_user') {
          try {
            const parsed = JSON.parse(result);
            if (parsed.role === 'guest' && parsed.booking) {
              discoveredGuest = {
                name: parsed.name ?? parsed.booking.guestName ?? 'Guest',
                telegramId: senderId,
                preferences: parsed.booking.preferences,
              };
            }
          } catch { /* ignore */ }
        }
      }

      history.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: result }],
      });
    }

    depth++;
  }

  conversationHistory.set(groupId, history);
  persistHistory(groupId, history);
  return 'I ran into a complex situation. Let me get the host to help.';
}

/** Persist history and generate snapshot if needed. */
function persistHistory(groupId: number, history: AnthropicMessage[]): void {
  const booking = getBookingByGroupId(groupId);
  if (!booking) return;

  saveHistory(booking, history);

  // Generate snapshot every 20 messages
  if (history.length > 0 && history.length % 20 === 0) {
    const snapshot = generateSnapshot(booking, history);
    saveSnapshot(booking, snapshot);
  }
}

export function clearHistory(groupId: number): void {
  conversationHistory.delete(groupId);
}

export function getHistory(groupId: number): AnthropicMessage[] {
  return conversationHistory.get(groupId) ?? [];
}
