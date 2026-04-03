# Issue #004: JSON Store — CRUD for Properties, Bookings, Transactions

## Summary

Implement the local JSON file storage layer. Three files (`data/properties.json`, `data/bookings.json`, `data/transactions.json`) with full CRUD operations. This is the source of truth the agent queries via tool calls.

## What needs to happen

### `src/store/properties.ts`

- `listProperties(): Property[]`
- `getProperty(id: string): Property | undefined`
- `getPropertyByGroupId(groupId: number): Property | undefined`
- `addProperty(property: Property): void`
- `updateProperty(id: string, updates: Partial<Property>): void`

### `src/store/bookings.ts`

- `listBookings(propertyId?: string): Booking[]`
- `getBooking(id: string): Booking | undefined`
- `getActiveBooking(propertyId: string): Booking | undefined`
- `addBooking(booking: Booking): void`
- `updateBooking(id: string, updates: Partial<Booking>): void`
- `linkGuest(bookingId: string, telegramId: number): void`

### `src/store/transactions.ts`

- `listTransactions(propertyId: string, bookingId?: string): Transaction[]`
- `addTransaction(transaction: Transaction): void`
- `getTodaySpend(propertyId: string): number`
- `getTotalSpend(bookingId: string): number`

### Storage details

- Files live in `data/` directory (created on first write)
- Read/write with `fs.readFileSync` / `fs.writeFileSync` (simple, synchronous — fine for local JSON)
- Initialize with empty arrays if file doesn't exist
- Generate IDs with a simple pattern: `prop-<slugified-name>`, `bk-<date>-<random>`, `tx-<timestamp>-<random>`

## Acceptance criteria

- [ ] All CRUD functions work correctly
- [ ] Files are created in `data/` on first write
- [ ] `getPropertyByGroupId` correctly maps Telegram groups to properties
- [ ] `getTodaySpend` correctly sums today's transactions for budget checking
- [ ] `linkGuest` updates both the booking's `guestTelegramId` and creates/updates a group mapping
- [ ] No data corruption on concurrent reads (not critical for MVP, but no silent overwrites)

---

## Discovered during build

> This section is maintained by the assignee during implementation. Document decisions, surprises, blockers, and anything the next person needs to know.

_No entries yet — assignee updates this as work progresses._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/004-json-store`

**Branch convention:** `feat/<issue-number>-<short-description>`

### Prerequisites for working on this issue

1. **Issue #003 merged** — types must be defined
2. **Read `docs/steward.md`** — data model + agent context discovery sections
3. **Understand the query patterns** — the agent calls `get_property_by_group(groupId)` on every message, so that lookup must be fast

### Assignee checklist (fill before starting)

- [ ] I have read the Data Model section of `docs/steward.md`
- [ ] Issue #003 (types) is merged
- [ ] I understand the relationship between properties, bookings, and group mappings
- [ ] I understand that `data/` is gitignored — only the code ships, not the data
