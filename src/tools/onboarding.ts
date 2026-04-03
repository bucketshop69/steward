// Onboarding tools — implement in issue #013

import type { Booking, Property } from '../types.js';

export async function linkGuest(
  _telegramId: number,
  _propertyId: string,
  _bookingRef: string,
): Promise<{ success: boolean; booking?: Booking; property?: Property }> {
  // TODO: implement in issue #013
  return { success: false };
}
