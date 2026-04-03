# Issue #007: `steward booking add/list` — Booking Management CLI

## Summary

Implement CLI commands for adding and listing bookings. `steward booking add --property <id>` creates a booking with guest details and dates. `steward booking list` shows active bookings. Group creation and invite link generation happen here (or are stubbed for the Telegram bot issue).

## What needs to happen

### `steward booking add --property <id>`

Interactive prompts:

```
📋 Add a Booking for Beach House

Guest name: ___
Check-in date (YYYY-MM-DD): ___
Check-out date (YYYY-MM-DD): ___
Guest preferences (optional): ___
Guest Telegram username (optional): ___
```

Behavior:
1. Validate property exists
2. Validate dates (check-in before check-out, not in the past)
3. Generate booking ID: `bk-<MMDD>-<random4>`
4. Save to store via `addBooking()`
5. **If Telegram bot is running** — create group, generate invite link (this may be deferred to issue #008)
6. Print confirmation:
   ```
   ✅ Booking created: bk-0410-a3x7
      Guest: John Smith
      Dates: Apr 10 - Apr 15
      Property: Beach House
   
   Next: Start the bot with `steward start` to create the Telegram group.
   ```

### `steward booking list`

```
Active Bookings:
  bk-0410-a3x7   Beach House   John Smith   Apr 10 - Apr 15   pending
  bk-0420-b2y8   City Apt      Jane Doe     Apr 20 - Apr 25   active
```

### Wire into CLI

- `steward booking add --property <id>` → interactive add flow
- `steward booking list` → table output

## Acceptance criteria

- [ ] `steward booking add` collects all fields and saves to store
- [ ] Property ID is validated (must exist)
- [ ] Dates are validated (check-in < check-out, reasonable format)
- [ ] Booking ID is auto-generated
- [ ] `steward booking list` shows all bookings with status
- [ ] Optional fields (preferences, username) can be skipped

---

## Discovered during build

> This section is maintained by the assignee during implementation. Document decisions, surprises, blockers, and anything the next person needs to know.

_No entries yet — assignee updates this as work progresses._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/007-cli-booking`

**Branch convention:** `feat/<issue-number>-<short-description>`

### Prerequisites for working on this issue

1. **Issue #004 merged** — JSON store with booking CRUD
2. **Issue #006 merged** — property CLI (need properties to exist before bookings)
3. **Read the Guest Onboarding section** of `docs/steward.md`

### Assignee checklist (fill before starting)

- [ ] I have read the Guest Onboarding + CLI Commands sections of `docs/steward.md`
- [ ] Issue #004 (JSON store) and #006 (property CLI) are merged
- [ ] I understand the Booking interface from `src/types.ts`
- [ ] I understand that Telegram group creation may be deferred to the bot issue
