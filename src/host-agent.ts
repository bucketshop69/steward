/**
 * Host Agent — handles DMs from the property host.
 * Separate from the guest-facing agent. Uses host-specific tools
 * to manage properties, bookings, and status.
 */

import { callMinimax, type AnthropicMessage, type AnthropicToolDefinition, type ContentBlock } from './minimax.js';
import { addPropertyTool, addBookingTool, listPropertiesTool, listBookingsTool, getStatusTool } from './tools/host.js';

const MAX_TOOL_DEPTH = 10;

// Host conversation history (single thread — host is one person)
let hostHistory: AnthropicMessage[] = [];

const HOST_SYSTEM_PROMPT = `You are Steward, an AI property management assistant. The person chatting with you is the property HOST — your boss. They manage short-term rental properties and you help them do it.

You can:
1. Add new properties (you need: Telegram group ID, name, address, check-in instructions, house rules, WiFi name/password, amenities, nearby places)
2. Add bookings for a property (you need: group ID, guest name, check-in date, check-out date, and optionally preferences and guest telegram username)
3. List all properties
4. List all bookings
5. Show overall status

IMPORTANT BEHAVIOR:
- When the host wants to add a property or booking, collect the required info conversationally. Don't demand everything at once — ask follow-up questions if info is missing.
- For dates, accept natural language like "April 10" and convert to YYYY-MM-DD format yourself.
- Be concise and helpful. This is a chat, not a form.
- When listing properties or bookings, format them nicely.
- After adding a property, remind the host they need to add the bot to the Telegram group.
- After adding a booking, tell the host to send the group invite link to the guest.
- If the host asks something you can't do with your tools, let them know honestly.`;

const HOST_TOOLS: AnthropicToolDefinition[] = [
  {
    name: 'add_property',
    description: 'Add a new property. Requires the Telegram group ID where this property will be managed.',
    input_schema: {
      type: 'object',
      properties: {
        telegram_group_id: { type: 'number', description: 'Telegram group/chat ID (negative number)' },
        name: { type: 'string', description: 'Property name (e.g., "Beach House")' },
        address: { type: 'string', description: 'Property address' },
        check_in_instructions: { type: 'string', description: 'How to get in (door code, key location, etc.)' },
        house_rules: { type: 'string', description: 'Rules for guests' },
        wifi_name: { type: 'string', description: 'WiFi network name' },
        wifi_password: { type: 'string', description: 'WiFi password' },
        amenities: { type: 'array', items: { type: 'string' }, description: 'List of amenities' },
        nearby_places: { type: 'string', description: 'Nearby restaurants, shops, landmarks' },
      },
      required: ['telegram_group_id', 'name', 'address', 'check_in_instructions', 'house_rules', 'wifi_name', 'wifi_password', 'amenities', 'nearby_places'],
    },
  },
  {
    name: 'add_booking',
    description: 'Add a new guest booking to a property.',
    input_schema: {
      type: 'object',
      properties: {
        group_id: { type: 'number', description: 'Telegram group ID for the property' },
        guest_name: { type: 'string', description: 'Guest full name' },
        check_in: { type: 'string', description: 'Check-in date (YYYY-MM-DD)' },
        check_out: { type: 'string', description: 'Check-out date (YYYY-MM-DD)' },
        preferences: { type: 'string', description: 'Guest preferences (dietary, etc.)' },
        guest_telegram_username: { type: 'string', description: 'Guest Telegram username (optional)' },
      },
      required: ['group_id', 'guest_name', 'check_in', 'check_out'],
    },
  },
  {
    name: 'list_properties',
    description: 'List all configured properties.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_bookings',
    description: 'List all bookings, optionally filtered by property.',
    input_schema: {
      type: 'object',
      properties: {
        group_id: { type: 'number', description: 'Filter by property group ID (optional)' },
      },
    },
  },
  {
    name: 'get_status',
    description: 'Get an overview of all properties and bookings.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];

function executeHostTool(name: string, input: Record<string, unknown>): string {
  try {
    switch (name) {
      case 'add_property':
        return JSON.stringify(addPropertyTool(input as Parameters<typeof addPropertyTool>[0]));
      case 'add_booking':
        return JSON.stringify(addBookingTool(input as Parameters<typeof addBookingTool>[0]));
      case 'list_properties':
        return JSON.stringify(listPropertiesTool());
      case 'list_bookings':
        return JSON.stringify(listBookingsTool(input as Parameters<typeof listBookingsTool>[0]));
      case 'get_status':
        return JSON.stringify(getStatusTool());
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({ error: `Tool error: ${(err as Error).message}` });
  }
}

export async function processHostMessage(message: string): Promise<string> {
  hostHistory.push({ role: 'user', content: message });

  // Trim history if too long
  if (hostHistory.length > 40) {
    hostHistory = hostHistory.slice(-40);
  }

  let depth = 0;
  while (depth < MAX_TOOL_DEPTH) {
    let response;
    try {
      response = await callMinimax(hostHistory, HOST_TOOLS, HOST_SYSTEM_PROMPT);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('tool_result') || msg.includes('tool id') || msg.includes('2013')) {
        console.warn('[host-agent] Stale history detected, resetting');
        hostHistory = [hostHistory[hostHistory.length - 1]];
        response = await callMinimax(hostHistory, HOST_TOOLS, HOST_SYSTEM_PROMPT);
      } else {
        throw err;
      }
    }

    const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use') as Extract<ContentBlock, { type: 'tool_use' }>[];

    if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
      const textBlock = response.content.find((b) => b.type === 'text') as Extract<ContentBlock, { type: 'text' }> | undefined;
      const text = textBlock?.text ?? '';
      hostHistory.push({ role: 'assistant', content: response.content });
      return text;
    }

    hostHistory.push({ role: 'assistant', content: response.content });

    for (const toolUse of toolUseBlocks) {
      const result = executeHostTool(toolUse.name, toolUse.input as Record<string, unknown>);
      hostHistory.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: result }],
      });
    }

    depth++;
  }

  return 'I got a bit stuck. Can you try rephrasing?';
}

export function clearHostHistory(): void {
  hostHistory = [];
}

export function getHostHistory(): AnthropicMessage[] {
  return hostHistory;
}
