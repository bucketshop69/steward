import { getPropertyByGroupId, getHostTelegramId } from '../store/properties.js';
import { getActiveBooking, getBooking as storeGetBooking, listBookings } from '../store/bookings.js';
import type { Property, Booking, UserIdentity } from '../types.js';

export function getPropertyByGroup(groupId: number): (Property & { groupId: number }) | undefined {
  const property = getPropertyByGroupId(groupId);
  if (!property) return undefined;
  return { ...property, groupId };
}

export function identifyUser(telegramId: number, groupId: number): UserIdentity {
  const property = getPropertyByGroupId(groupId);
  if (!property) return { role: 'unknown' };

  const hostId = getHostTelegramId();
  if (telegramId === hostId) {
    return { role: 'host' };
  }

  const bookings = listBookings(groupId);
  const guestBooking = bookings.find((b) => b.guestTelegramId === telegramId);

  if (guestBooking) {
    return { role: 'guest', name: guestBooking.guestName, booking: guestBooking };
  }

  return { role: 'unknown' };
}

export function getBooking(groupId: number, bookingId?: string): Booking | undefined {
  if (bookingId) return storeGetBooking(bookingId);
  return getActiveBooking(groupId);
}
