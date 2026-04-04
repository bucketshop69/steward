/**
 * Booking Lifecycle Manager
 *
 * Handles check-in day welcome messages and check-out day summaries.
 * Runs on each message (lazy check) with a per-booking "fired" flag to prevent repeats.
 */

import { listBookings, updateBooking } from './store/bookings.js';
import { readConfig } from './store/steward.js';
import type { Booking, Property } from './types.js';

// Track which lifecycle events have fired (bookingId → Set of event names)
const firedEvents = new Map<string, Set<string>>();

function hasFired(bookingId: string, event: string): boolean {
  return firedEvents.get(bookingId)?.has(event) ?? false;
}

function markFired(bookingId: string, event: string): void {
  if (!firedEvents.has(bookingId)) firedEvents.set(bookingId, new Set());
  firedEvents.get(bookingId)!.add(event);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface LifecycleMessage {
  groupId: number;
  text: string;
}

/**
 * Check all bookings for lifecycle events that should fire today.
 * Returns messages to send (caller handles actual delivery).
 */
export function checkLifecycleEvents(): LifecycleMessage[] {
  const today = todayISO();
  const messages: LifecycleMessage[] = [];
  const config = readConfig();

  for (const group of config.groups) {
    for (const booking of group.bookings) {
      // Check-in day
      if (booking.checkIn === today && !hasFired(booking.id, 'checkin')) {
        const msg = buildCheckinMessage(booking, group.property);
        if (msg) {
          messages.push({ groupId: group.telegramGroupId, text: msg });
          markFired(booking.id, 'checkin');

          // Transition pending → active
          if (booking.status === 'pending') {
            updateBooking(booking.id, { status: 'active' });
          }
        }
      }

      // Check-out day
      if (booking.checkOut === today && booking.status === 'active' && !hasFired(booking.id, 'checkout')) {
        const msg = buildCheckoutMessage(booking, group.property);
        messages.push({ groupId: group.telegramGroupId, text: msg });
        markFired(booking.id, 'checkout');

        // Transition active → checked_out
        updateBooking(booking.id, { status: 'checked_out' });
      }
    }
  }

  return messages;
}

function buildCheckinMessage(booking: Booking, property: Property): string {
  const guest = booking.guestName;
  let msg = `🏠 Welcome, ${guest}! Your stay at ${property.name} starts today.\n\n`;

  msg += `📍 Check-in instructions:\n${property.checkInInstructions}\n\n`;
  msg += `📶 WiFi: ${property.wifiName} / ${property.wifiPassword}\n`;
  msg += `📋 House rules: ${property.houseRules}\n`;

  if (property.amenities.length > 0) {
    msg += `\n🎯 Amenities: ${property.amenities.join(', ')}`;
  }

  if (property.nearbyPlaces) {
    msg += `\n📍 Nearby: ${property.nearbyPlaces}`;
  }

  msg += '\n\nJust ask if you need anything — food, transport, cleaning, or local tips!';
  return msg;
}

function buildCheckoutMessage(booking: Booking, property: Property): string {
  let msg = `👋 Check-out day, ${booking.guestName}! We hope you enjoyed ${property.name}.\n\n`;
  msg += 'A standard cleaning has been scheduled. Thank you for staying with us! 🙏';
  return msg;
}

/** Reset fired events (for tests). */
export function resetLifecycleEvents(): void {
  firedEvents.clear();
}

/** Expose for tests. */
export { hasFired, markFired };
