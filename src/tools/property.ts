import { getProperty } from '../store/properties.js';
import type { Property } from '../types.js';

export function getPropertyInfo(propertyId: string): Omit<Property, 'hostTelegramId' | 'telegramGroupId'> | undefined {
  const property = getProperty(propertyId);
  if (!property) return undefined;

  // Return all info except host-internal fields
  const { hostTelegramId, telegramGroupId, ...info } = property;
  return info;
}
