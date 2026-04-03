import { updateProperty } from '../src/store/properties.js';
const propertyId = process.argv[2];
const groupId = Number(process.argv[3]);
if (!propertyId || !groupId) {
  console.log('Usage: npx tsx scripts/link-group.ts <property-id> <group-id>');
  process.exit(1);
}
updateProperty(propertyId, { telegramGroupId: groupId });
console.log(`Linked ${propertyId} to group ${groupId}`);
