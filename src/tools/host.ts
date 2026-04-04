/**
 * Host-facing tools — called when the host DMs the bot.
 * These let the host manage properties and bookings conversationally.
 */

import { addProperty as storeAddProperty, listProperties as storeListProperties } from '../store/properties.js';
import { addBooking as storeAddBooking, listBookings as storeListBookings } from '../store/bookings.js';
import { readConfig } from '../store/steward.js';
import type { Property, Booking } from '../types.js';

export function addPropertyTool(input: {
  telegram_group_id: number;
  name: string;
  address: string;
  check_in_instructions: string;
  house_rules: string;
  wifi_name: string;
  wifi_password: string;
  amenities: string[];
  nearby_places: string;
}): { success: boolean; error?: string } {
  const property: Property = {
    name: input.name,
    address: input.address,
    checkInInstructions: input.check_in_instructions,
    houseRules: input.house_rules,
    wifiName: input.wifi_name,
    wifiPassword: input.wifi_password,
    amenities: input.amenities,
    nearbyPlaces: input.nearby_places,
  };

  try {
    storeAddProperty(input.telegram_group_id, property);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export function addBookingTool(input: {
  group_id: number;
  guest_name: string;
  check_in: string;
  check_out: string;
  preferences?: string;
  guest_telegram_username?: string;
}): { success: boolean; booking_id?: string; error?: string } {
  const mmdd = input.check_in.slice(5, 7) + input.check_in.slice(8, 10);
  const rand = Math.random().toString(36).slice(2, 6);
  const id = `bk-${mmdd}-${rand}`;

  const booking: Booking = {
    id,
    guestName: input.guest_name,
    checkIn: input.check_in,
    checkOut: input.check_out,
    preferences: input.preferences,
    guestTelegramUsername: input.guest_telegram_username,
    status: 'pending',
  };

  try {
    storeAddBooking(input.group_id, booking);
    return { success: true, booking_id: id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export function listPropertiesTool(): { properties: { group_id: number; name: string; address: string; bookings_count: number }[] } {
  const config = readConfig();
  return {
    properties: config.groups.map((g) => ({
      group_id: g.telegramGroupId,
      name: g.property.name,
      address: g.property.address,
      bookings_count: g.bookings.length,
    })),
  };
}

export function listBookingsTool(input: { group_id?: number }): { bookings: { id: string; guest_name: string; property_name: string; check_in: string; check_out: string; status: string }[] } {
  const config = readConfig();
  const results: { id: string; guest_name: string; property_name: string; check_in: string; check_out: string; status: string }[] = [];

  for (const group of config.groups) {
    if (input.group_id && group.telegramGroupId !== input.group_id) continue;
    for (const b of group.bookings) {
      results.push({
        id: b.id,
        guest_name: b.guestName,
        property_name: group.property.name,
        check_in: b.checkIn,
        check_out: b.checkOut,
        status: b.status,
      });
    }
  }

  return { bookings: results };
}

export function getStatusTool(): {
  properties_count: number;
  active_bookings: number;
  pending_bookings: number;
  properties: { name: string; group_id: number; active_guest?: string }[];
} {
  const config = readConfig();
  let active = 0;
  let pending = 0;
  const properties: { name: string; group_id: number; active_guest?: string }[] = [];

  for (const group of config.groups) {
    const activeBooking = group.bookings.find((b) => b.status === 'active');
    const pendingBooking = group.bookings.find((b) => b.status === 'pending');
    active += group.bookings.filter((b) => b.status === 'active').length;
    pending += group.bookings.filter((b) => b.status === 'pending').length;

    properties.push({
      name: group.property.name,
      group_id: group.telegramGroupId,
      active_guest: activeBooking?.guestName ?? pendingBooking?.guestName,
    });
  }

  return { properties_count: config.groups.length, active_bookings: active, pending_bookings: pending, properties };
}
