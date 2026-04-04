import { getPropertyByGroupId } from '../store/properties.js';
import type { Property } from '../types.js';

export function getPropertyInfo(groupId: number): Property | undefined {
  return getPropertyByGroupId(groupId);
}
