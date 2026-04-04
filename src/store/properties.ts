import type { Property } from '../types.js';
import { readConfig, writeConfig } from './steward.js';

export function listProperties(): (Property & { groupId: number })[] {
  const { groups } = readConfig();
  return groups.map((g) => ({ ...g.property, groupId: g.telegramGroupId }));
}

export function getProperty(groupId: number): Property | undefined {
  const { groups } = readConfig();
  const group = groups.find((g) => g.telegramGroupId === groupId);
  return group?.property;
}

export function getPropertyByGroupId(groupId: number): Property | undefined {
  return getProperty(groupId);
}

export function addProperty(telegramGroupId: number, property: Property): void {
  const config = readConfig();
  if (config.groups.some((g) => g.telegramGroupId === telegramGroupId)) {
    throw new Error(`Group ${telegramGroupId} already has a property configured.`);
  }
  config.groups.push({ telegramGroupId, property, bookings: [] });
  writeConfig(config);
}

export function updateProperty(groupId: number, updates: Partial<Property>): void {
  const config = readConfig();
  const group = config.groups.find((g) => g.telegramGroupId === groupId);
  if (!group) throw new Error(`No group with ID ${groupId}`);
  group.property = { ...group.property, ...updates };
  writeConfig(config);
}

export function getHostTelegramId(): number {
  return readConfig().hostTelegramId;
}
