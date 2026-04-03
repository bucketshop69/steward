import { callMinimax, type AnthropicMessage, type AnthropicToolDefinition, type ContentBlock } from './minimax.js';
import { getPropertyByGroup, identifyUser, getBooking } from './tools/context.js';
import { getPropertyInfo } from './tools/property.js';
import { checkBudget, getTransactionHistory } from './tools/budget.js';
import { linkGuest } from './tools/onboarding.js';
import { escalateToHost } from './tools/escalate.js';
import { executePlugin, getPluginToolSchemas } from './plugins/registry.js';
import { createWalletService } from './wallet.js';
import { saveHistory, loadHistory, loadSnapshot, saveSnapshot, generateSnapshot, buildContextMessages } from './memory.js';
import { getBookingByGroupId } from './store/bookings.js';
import { getTotalSpend } from './store/transactions.js';

const MAX_TOOL_DEPTH = 10;

// Per-group conversation history (in-memory)
const conversationHistory = new Map<number, AnthropicMessage[]>();

const SYSTEM_PROMPT = `You are Steward, an AI property host assistant. You manage short-term rental properties via Telegram groups. You help guests with check-in info, local recommendations, food orders, transport, cleaning, and anything else they need during their stay.

You have access to tools to look up property info, check budgets, order services, and escalate to the host. You discover everything through tool calls — you know nothing upfront.

Rules:
- On every message, first call get_property_by_group to know which property this is
- Then call identify_user to know who you're talking to
- Always check the budget before ordering any paid service
- If a request exceeds the budget, tell the guest and escalate to the host
- For maintenance issues, try simple troubleshooting first, then escalate
- Be friendly, helpful, and concise — this is a chat, not an email
- When a new guest confirms their identity, call link_guest to connect them to their booking`;

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
        property_id: { type: 'string', description: 'Property ID' },
      },
      required: ['telegram_id', 'property_id'],
    },
  },
  {
    name: 'get_booking',
    description: 'Get current booking details including dates, preferences, and remaining budget.',
    input_schema: {
      type: 'object',
      properties: {
        property_id: { type: 'string', description: 'Property ID' },
        booking_id: { type: 'string', description: 'Specific booking ID (optional — defaults to active booking)' },
      },
      required: ['property_id'],
    },
  },
  {
    name: 'get_property_info',
    description: 'Get property details to answer guest questions about WiFi, rules, amenities, check-in, nearby places.',
    input_schema: {
      type: 'object',
      properties: {
        property_id: { type: 'string', description: 'Property ID' },
      },
      required: ['property_id'],
    },
  },
  {
    name: 'check_budget',
    description: 'Check if an amount is within the daily budget and per-transaction limit. Call before any paid service.',
    input_schema: {
      type: 'object',
      properties: {
        property_id: { type: 'string', description: 'Property ID' },
        amount: { type: 'number', description: 'Amount in USDC to check' },
      },
      required: ['property_id', 'amount'],
    },
  },
  {
    name: 'get_transaction_history',
    description: 'Get spending log for a property, optionally filtered by booking.',
    input_schema: {
      type: 'object',
      properties: {
        property_id: { type: 'string', description: 'Property ID' },
        booking_id: { type: 'string', description: 'Filter by booking ID (optional)' },
      },
      required: ['property_id'],
    },
  },
  {
    name: 'link_guest',
    description: 'Connect a new Telegram user to a booking. Call when a guest confirms their identity.',
    input_schema: {
      type: 'object',
      properties: {
        telegram_id: { type: 'number', description: 'Guest Telegram user ID' },
        property_id: { type: 'string', description: 'Property ID' },
        booking_ref: { type: 'string', description: 'Booking reference (optional — auto-finds pending booking)' },
      },
      required: ['telegram_id', 'property_id'],
    },
  },
  {
    name: 'escalate_to_host',
    description: 'Escalate an issue to the property host. Use when budget exceeded, maintenance needed, or you cannot resolve.',
    input_schema: {
      type: 'object',
      properties: {
        property_id: { type: 'string', description: 'Property ID' },
        reason: { type: 'string', description: 'Clear explanation of what needs host attention' },
        urgency: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Urgency level' },
      },
      required: ['property_id', 'reason', 'urgency'],
    },
  },
  // Plugin tools are appended dynamically
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

function executeTool(name: string, input: Record<string, unknown>, mock: boolean): string {
  try {
    switch (name) {
      case 'get_property_by_group': {
        const result = getPropertyByGroup(input.group_id as number);
        return JSON.stringify(result ?? { error: 'No property found for this group' });
      }
      case 'identify_user': {
        const result = identifyUser(input.telegram_id as number, input.property_id as string);
        return JSON.stringify(result);
      }
      case 'get_booking': {
        const result = getBooking(input.property_id as string, input.booking_id as string | undefined);
        return JSON.stringify(result ?? { error: 'No active booking found' });
      }
      case 'get_property_info': {
        const result = getPropertyInfo(input.property_id as string);
        return JSON.stringify(result ?? { error: 'Property not found' });
      }
      case 'check_budget': {
        const result = checkBudget(input.property_id as string, input.amount as number);
        return JSON.stringify(result);
      }
      case 'get_transaction_history': {
        const result = getTransactionHistory(input.property_id as string, input.booking_id as string | undefined);
        return JSON.stringify(result);
      }
      case 'link_guest': {
        const result = linkGuest(
          input.telegram_id as number,
          input.property_id as string,
          input.booking_ref as string | undefined,
        );
        return JSON.stringify(result);
      }
      case 'escalate_to_host': {
        const result = escalateToHost(
          input.property_id as string,
          input.reason as string,
          input.urgency as 'low' | 'medium' | 'high',
        );
        return JSON.stringify(result);
      }
      default: {
        // Check if it's a plugin tool
        if (PLUGIN_TOOL_NAMES.has(name)) {
          const pluginName = PLUGIN_NAME_MAP[name];
          // Plugin execution is async but we need sync for tool dispatch
          // Return a placeholder — actual execution happens in executePluginTool
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
  mock: boolean,
  propertyId?: string,
  guestInfo?: { name: string; telegramId: number; preferences?: string },
): Promise<string> {
  const pluginName = PLUGIN_NAME_MAP[name];
  if (!pluginName) return JSON.stringify({ error: `Unknown plugin tool: ${name}` });

  const { getProperty } = await import('./store/properties.js');
  const property = propertyId ? getProperty(propertyId) : undefined;

  if (!property) {
    return JSON.stringify({ error: 'Property context not available for plugin execution' });
  }

  const wallet = createWalletService(mock);
  const result = await executePlugin(pluginName, {
    guest: guestInfo ?? { name: 'Guest', telegramId: 0 },
    property,
    request: JSON.stringify(input),
    wallet,
    mock,
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

  // Tool use loop
  let depth = 0;
  while (depth < MAX_TOOL_DEPTH) {
    const response = await callMinimax(history, TOOL_DEFINITIONS, SYSTEM_PROMPT);

    // Check for tool use
    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use') as Extract<ContentBlock, { type: 'tool_use' }>[];

    if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
      // No tool calls — extract text response
      const textBlock = response.content.find((b) => b.type === 'text') as Extract<ContentBlock, { type: 'text' }> | undefined;
      const text = textBlock?.text ?? '';

      // Save assistant response to history
      history.push({ role: 'assistant', content: response.content });
      conversationHistory.set(groupId, history);

      // Persist to disk
      persistHistory(groupId, history);

      return text;
    }

    // Execute tool calls
    history.push({ role: 'assistant', content: response.content });

    for (const toolUse of toolUseBlocks) {
      const toolInput = toolUse.input as Record<string, unknown>;
      let result: string;

      if (PLUGIN_TOOL_NAMES.has(toolUse.name)) {
        // Plugin tools need async execution with property/guest context
        result = await executePluginTool(toolUse.name, toolInput, mock);
      } else {
        result = executeTool(toolUse.name, toolInput, mock);
      }

      history.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: result }],
      });
    }

    depth++;
  }

  // If we hit max depth, return what we have
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
    const totalSpent = getTotalSpend(booking.id);
    const snapshot = generateSnapshot(booking, history, totalSpent);
    saveSnapshot(booking, snapshot);
  }
}

export function clearHistory(groupId: number): void {
  conversationHistory.delete(groupId);
}

export function getHistory(groupId: number): AnthropicMessage[] {
  return conversationHistory.get(groupId) ?? [];
}
