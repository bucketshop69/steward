import type { Booking } from '../types.js';
import { readConfig, writeConfig } from './steward.js';

export function listBookings(groupId?: number): Booking[] {
  const { groups } = readConfig();
  if (groupId !== undefined) {
    const group = groups.find((g) => g.telegramGroupId === groupId);
    return group?.bookings ?? [];
  }
  return groups.flatMap((g) => g.bookings);
}

export function getBooking(bookingId: string): Booking | undefined {
  const { groups } = readConfig();
  for (const g of groups) {
    const b = g.bookings.find((b) => b.id === bookingId);
    if (b) return b;
  }
  return undefined;
}

export function getActiveBooking(groupId: number): Booking | undefined {
  const { groups } = readConfig();
  const group = groups.find((g) => g.telegramGroupId === groupId);
  return group?.bookings.find((b) => b.status === 'active');
}

export function getBookingByGroupId(groupId: number): Booking | undefined {
  return getActiveBooking(groupId);
}

export function addBooking(groupId: number, booking: Booking): void {
  const config = readConfig();
  const group = config.groups.find((g) => g.telegramGroupId === groupId);
  if (!group) throw new Error(`No group with ID ${groupId}`);
  if (group.bookings.some((b) => b.id === booking.id)) {
    throw new Error(`Booking "${booking.id}" already exists`);
  }
  group.bookings.push(booking);
  writeConfig(config);
}

export function updateBooking(bookingId: string, updates: Partial<Booking>): void {
  const config = readConfig();
  for (const group of config.groups) {
    const idx = group.bookings.findIndex((b) => b.id === bookingId);
    if (idx !== -1) {
      group.bookings[idx] = { ...group.bookings[idx], ...updates };
      writeConfig(config);
      return;
    }
  }
  throw new Error(`Booking "${bookingId}" not found`);
}
