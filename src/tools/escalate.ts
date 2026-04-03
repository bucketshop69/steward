import { getProperty } from '../store/properties.js';

export function escalateToHost(
  propertyId: string,
  reason: string,
  urgency: 'low' | 'medium' | 'high',
): { message: string; hostTelegramId?: number } {
  const property = getProperty(propertyId);
  if (!property) return { message: 'Cannot escalate: property not found' };

  const urgencyEmoji = urgency === 'high' ? '🚨' : urgency === 'medium' ? '⚠️' : 'ℹ️';

  const message = [
    `${urgencyEmoji} Host attention needed`,
    '',
    `Property: ${property.name}`,
    `Urgency: ${urgency}`,
    `Reason: ${reason}`,
  ].join('\n');

  return { message, hostTelegramId: property.hostTelegramId };
}
