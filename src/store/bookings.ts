// Booking store — implement in issue #004

import type { Booking } from '../types.js';

export function listBookings(_propertyId?: string): Booking[] {
  // TODO: implement in issue #004
  return [];
}

export function getBooking(_id: string): Booking | undefined {
  // TODO: implement in issue #004
  return undefined;
}

export function getActiveBooking(_propertyId: string): Booking | undefined {
  // TODO: implement in issue #004
  return undefined;
}

export function addBooking(_booking: Booking): void {
  // TODO: implement in issue #004
}

export function updateBooking(_id: string, _updates: Partial<Booking>): void {
  // TODO: implement in issue #004
}

export function linkGuest(_bookingId: string, _telegramId: number): void {
  // TODO: implement in issue #004
}
