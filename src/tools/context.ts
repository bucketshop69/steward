import { getPropertyByGroupId as storeGetPropertyByGroup, getProperty } from '../store/properties.js';
import { getActiveBooking as storeGetActiveBooking, getBooking as storeGetBooking, getBookingByGroupId, listBookings } from '../store/bookings.js';
import { getTodaySpend } from '../store/transactions.js';
import type { Property, Booking, UserIdentity } from '../types.js';

export function getPropertyByGroup(groupId: number): Property | undefined {
  return storeGetPropertyByGroup(groupId);
}

export function identifyUser(telegramId: number, propertyId: string): UserIdentity {
  const property = getProperty(propertyId);

  if (!property) return { role: 'unknown' };

  if (telegramId === property.hostTelegramId) {
    return { role: 'host' };
  }

  const bookings = listBookings(propertyId);
  const guestBooking = bookings.find((b) => b.guestTelegramId === telegramId);

  if (guestBooking) {
    return { role: 'guest', name: guestBooking.guestName, booking: guestBooking };
  }

  return { role: 'unknown' };
}

export function getBooking(propertyId: string, bookingId?: string): (Booking & { budgetRemaining: number }) | undefined {
  const property = getProperty(propertyId);
  if (!property) return undefined;

  const booking = bookingId
    ? storeGetBooking(bookingId)
    : storeGetActiveBooking(propertyId);

  if (!booking) return undefined;

  const todaySpend = getTodaySpend(propertyId);
  const budgetRemaining = property.dailyBudget - todaySpend;

  return { ...booking, budgetRemaining };
}
