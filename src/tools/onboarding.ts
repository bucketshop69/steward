import { getProperty } from '../store/properties.js';
import { listBookings, updateBooking, getBooking } from '../store/bookings.js';
import type { Booking, Property } from '../types.js';

export function linkGuest(
  telegramId: number,
  propertyId: string,
  bookingRef?: string,
): { success: boolean; booking?: Booking; property?: Property; error?: string } {
  const property = getProperty(propertyId);
  if (!property) return { success: false, error: 'Property not found' };

  let booking: Booking | undefined;

  if (bookingRef) {
    booking = getBooking(bookingRef);
  } else {
    // Find a pending booking for this property
    const bookings = listBookings(propertyId);
    booking = bookings.find((b) => b.status === 'pending');
  }

  if (!booking) return { success: false, error: 'No pending booking found' };

  // Check if already linked (idempotent)
  if (booking.guestTelegramId === telegramId) {
    return { success: true, booking, property };
  }

  // Link guest
  updateBooking(booking.id, {
    guestTelegramId: telegramId,
    status: 'active',
  });

  const updated = getBooking(booking.id)!;
  return { success: true, booking: updated, property };
}
