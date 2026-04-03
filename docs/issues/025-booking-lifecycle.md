# Issue #025: Booking Lifecycle — Check-in Welcome, Check-out Summary

## Summary

Implement the booking lifecycle events: automated check-in day welcome message and check-out day summary with spending report and cleaning scheduling.

## What needs to happen

### Check-in day

On the check-in date, if guest is already linked:
- Send a welcome reminder with property details
- "Your stay starts today! Here's everything you need..."

### Check-out day

On the check-out date, auto-trigger:
1. Send checkout reminder
2. Generate spending summary:
   ```
   📊 Booking summary:
     - Food orders: $87 USDC (3 orders)
     - Taxi: $24 USDC (1 trip)
     - Total services: $111 USDC
   ```
3. Auto-schedule standard cleaning via cleaning plugin
4. Thank the guest

### Implementation

- A periodic check (e.g., runs every hour or on bot startup) that compares current date against booking dates
- Or: a cron-style scheduler that fires at a specific time on check-in/check-out days
- For MVP: check on every message if today is a lifecycle date, and fire once (flag to prevent repeats)

### Status transitions

- Check-in day: `pending` → `active` (if not already)
- Check-out day: `active` → `checked_out`

## Acceptance criteria

- [ ] Check-in day message fires automatically
- [ ] Check-out day summary includes spending breakdown
- [ ] Cleaning is auto-scheduled on check-out
- [ ] Status transitions work correctly
- [ ] Messages only fire once (not on every message that day)

---

## Discovered during build

_No entries yet._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/025-booking-lifecycle`

### Prerequisites

1. **Issue #009 merged** — Claude agent
2. **Issue #012 merged** — budget/transaction tools
3. **Issue #017 merged** — cleaning plugin

### Assignee checklist

- [ ] I have read the "Guest checks out" section of `docs/steward.md`
- [ ] All prerequisite issues are merged
