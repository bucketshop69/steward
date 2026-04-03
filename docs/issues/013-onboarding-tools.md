# Issue #013: Onboarding Tools — link_guest, Welcome Flow

## Summary

Implement the guest onboarding tool. When a new user joins a Telegram group, the agent asks who they are and links them to a booking. `link_guest` connects a Telegram user ID to a booking, enabling the agent to identify them on all future messages.

## What needs to happen

### `src/tools/onboarding.ts`

#### `link_guest(telegram_id: number, property_id: string, booking_ref: string)`

- Find the booking by `booking_ref` (or by `property_id` if only one pending booking)
- Update booking: set `guestTelegramId = telegram_id`
- Update booking status: `pending` → `active`
- Update group mapping if needed
- Return:
  ```typescript
  {
    success: boolean;
    booking: Booking;      // the linked booking with check-in info
    property: Property;    // for the welcome message
  }
  ```

### Welcome message flow (agent-side, but tool supports it)

1. New member detected → agent asks "Are you [guest name]?"
2. Guest confirms → agent calls `link_guest(telegramId, propertyId, bookingRef)`
3. Tool returns booking + property info
4. Agent formats welcome message with check-in details

### Edge cases

- Multiple pending bookings for same property → agent should ask which one
- Guest already linked → return existing booking (idempotent)
- Unknown person joins → agent asks name, tries to match against pending bookings

## Acceptance criteria

- [ ] `link_guest` correctly updates booking with Telegram ID
- [ ] Booking status transitions from `pending` to `active`
- [ ] Tool is idempotent (calling twice doesn't break anything)
- [ ] Returns property + booking info for the welcome message
- [ ] Tool schema defined for Claude tool use

---

## Discovered during build

> This section is maintained by the assignee during implementation. Document decisions, surprises, blockers, and anything the next person needs to know.

_No entries yet — assignee updates this as work progresses._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/013-onboarding-tools`

**Branch convention:** `feat/<issue-number>-<short-description>`

### Prerequisites for working on this issue

1. **Issue #004 merged** — JSON store with booking updates
2. **Read "Guest Onboarding (Production Flow)"** — steps 3-4 in `docs/steward.md`

### Assignee checklist (fill before starting)

- [ ] I have read the "Guest Onboarding" section of `docs/steward.md`
- [ ] Issue #004 (JSON store) is merged
- [ ] I understand the booking status transitions (pending → active → checked_out)
