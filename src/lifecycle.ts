/**
 * Booking Lifecycle Manager
 *
 * Handles check-in day welcome messages and check-out day summaries.
 * Runs on each message (lazy check) with a per-booking "fired" flag to prevent repeats.
 */

import { listBookings, updateBooking } from './store/bookings.js';
import { getProperty } from './store/properties.js';
import { listTransactions } from './store/transactions.js';
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

  for (const booking of listBookings()) {
    const property = getProperty(booking.propertyId);
    if (!property || !booking.telegramGroupId) continue;

    // Check-in day
    if (booking.checkIn === today && !hasFired(booking.id, 'checkin')) {
      const msg = buildCheckinMessage(booking, property);
      if (msg) {
        messages.push({ groupId: booking.telegramGroupId, text: msg });
        markFired(booking.id, 'checkin');

        // Transition pending → active
        if (booking.status === 'pending') {
          updateBooking(booking.id, { status: 'active' });
        }
      }
    }

    // Check-out day
    if (booking.checkOut === today && booking.status === 'active' && !hasFired(booking.id, 'checkout')) {
      const msg = buildCheckoutMessage(booking, property);
      messages.push({ groupId: booking.telegramGroupId, text: msg });
      markFired(booking.id, 'checkout');

      // Transition active → checked_out
      updateBooking(booking.id, { status: 'checked_out' });
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
  const txs = listTransactions(booking.propertyId, booking.id);
  const total = txs.reduce((sum, t) => sum + t.amount, 0);

  let msg = `👋 Check-out day, ${booking.guestName}! We hope you enjoyed ${property.name}.\n\n`;

  if (txs.length > 0) {
    msg += '📊 Your stay summary:\n';

    const byPlugin = new Map<string, { amount: number; count: number }>();
    for (const t of txs) {
      const existing = byPlugin.get(t.plugin) ?? { amount: 0, count: 0 };
      byPlugin.set(t.plugin, { amount: existing.amount + t.amount, count: existing.count + 1 });
    }

    for (const [plugin, { amount, count }] of byPlugin) {
      msg += `   - ${plugin}: $${amount} USDC (${count} ${count === 1 ? 'order' : 'orders'})\n`;
    }

    msg += `\n   Total: $${total} USDC\n`;
  } else {
    msg += 'No services were ordered during your stay.\n';
  }

  msg += '\nA standard cleaning has been scheduled. Thank you for staying with us! 🙏';
  return msg;
}

/** Reset fired events (for tests). */
export function resetLifecycleEvents(): void {
  firedEvents.clear();
}

/** Expose for tests. */
export { hasFired, markFired };
