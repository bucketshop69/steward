// Context tools — implement in issue #010

import type { Property, UserIdentity, Booking } from '../types.js';

export async function getPropertyByGroup(_groupId: number): Promise<Property | undefined> {
  // TODO: implement in issue #010
  return undefined;
}

export async function identifyUser(_telegramId: number, _propertyId: string): Promise<UserIdentity> {
  // TODO: implement in issue #010
  return { role: 'unknown' };
}

export async function getBooking(_propertyId: string, _bookingId?: string): Promise<Booking | undefined> {
  // TODO: implement in issue #010
  return undefined;
}
