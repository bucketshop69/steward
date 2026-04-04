import type { Plugin, PluginParams, PluginResult } from '../types.js';
import type { AnthropicToolDefinition } from '../minimax.js';
import { foodPlugin } from './food.js';
import { cleaningPlugin } from './cleaning.js';
import { taxiPlugin } from './taxi.js';
import { ticketsPlugin } from './tickets.js';
import { maintenancePlugin } from './maintenance.js';

const plugins: Plugin[] = [
  foodPlugin,
  cleaningPlugin,
  taxiPlugin,
  ticketsPlugin,
  maintenancePlugin,
];

export function getPlugins(): Plugin[] {
  return plugins;
}

export function getPlugin(name: string): Plugin | undefined {
  return plugins.find((p) => p.name === name);
}

export async function executePlugin(name: string, params: PluginParams): Promise<PluginResult> {
  const plugin = getPlugin(name);
  if (!plugin) {
    return { message: `Unknown service: ${name}` };
  }

  return plugin.handle(params);
}

export function getPluginToolSchemas(): AnthropicToolDefinition[] {
  return [
    {
      name: 'order_food',
      description: 'Order food delivery. Respects guest dietary preferences automatically.',
      input_schema: {
        type: 'object',
        properties: {
          cuisine: { type: 'string', description: 'Type of food (e.g., Thai, Pizza, Sushi)' },
          people: { type: 'number', description: 'Number of people to feed' },
          dietary: { type: 'string', description: 'Dietary restrictions (e.g., vegetarian, no nuts)' },
          special_requests: { type: 'string', description: 'Any special requests' },
        },
        required: ['cuisine', 'people'],
      },
    },
    {
      name: 'book_cleaning',
      description: 'Schedule a cleaning service for the property.',
      input_schema: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'When to clean (ISO date or today/tomorrow)' },
          type: { type: 'string', enum: ['standard', 'deep'], description: 'Cleaning type' },
          notes: { type: 'string', description: 'Special instructions' },
        },
        required: ['date', 'type'],
      },
    },
    {
      name: 'book_taxi',
      description: 'Book a taxi or transport service.',
      input_schema: {
        type: 'object',
        properties: {
          pickup: { type: 'string', description: 'Pickup location (or "property" for the rental)' },
          destination: { type: 'string', description: 'Where to go' },
          time: { type: 'string', description: 'When (e.g., "now", "in 30 min", "3pm")' },
          people: { type: 'number', description: 'Number of passengers' },
        },
        required: ['destination'],
      },
    },
    {
      name: 'book_tickets',
      description: 'Book tickets for local events, tours, activities, or attractions.',
      input_schema: {
        type: 'object',
        properties: {
          event: { type: 'string', description: 'What event or activity' },
          people: { type: 'number', description: 'Number of tickets' },
          date: { type: 'string', description: 'Preferred date' },
        },
        required: ['event', 'people'],
      },
    },
    {
      name: 'report_maintenance',
      description: 'Report a maintenance issue. Will attempt troubleshooting first, then escalate to host.',
      input_schema: {
        type: 'object',
        properties: {
          issue: { type: 'string', description: 'What is broken or not working' },
          location: { type: 'string', description: 'Where in the property' },
          severity: { type: 'string', enum: ['minor', 'major', 'urgent'], description: 'How urgent' },
        },
        required: ['issue'],
      },
    },
  ];
}
