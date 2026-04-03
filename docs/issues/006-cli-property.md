# Issue #006: `steward property add/list` — Property Management CLI

## Summary

Implement CLI commands for adding and listing properties. `steward property add` walks through interactive prompts to configure a property (name, address, WiFi, rules, budget, host Telegram ID). `steward property list` shows all configured properties.

## What needs to happen

### `steward property add`

Interactive prompts:

```
🏠 Add a Property

Property name: ___
Address: ___
Check-in instructions: ___
House rules: ___
WiFi name: ___
WiFi password: ___
Amenities (comma-separated): ___
Nearby places: ___
Daily budget (USDC) [200]: ___
Per-transaction limit (USDC) [100]: ___
Your Telegram user ID: ___
```

Behavior:
1. Collect all fields via interactive prompts
2. Generate property ID from name: `beach-house` from "Beach House"
3. Check for duplicate IDs
4. Save to store via `addProperty()`
5. Print confirmation with property ID

### `steward property list`

```
Properties:
  beach-house     Beach House       123 Ocean Drive    Budget: $200/day
  city-apt        City Apartment    456 Main St        Budget: $150/day
```

### Wire into CLI

- `steward property add` → interactive add flow
- `steward property list` → table output

## Acceptance criteria

- [ ] `steward property add` collects all fields and saves to store
- [ ] Property ID is auto-generated from name (slugified)
- [ ] Duplicate IDs are rejected with a helpful message
- [ ] `steward property list` shows all properties in a readable format
- [ ] Default values work for budget fields
- [ ] Host Telegram ID is validated as a number

---

## Discovered during build

> This section is maintained by the assignee during implementation. Document decisions, surprises, blockers, and anything the next person needs to know.

_No entries yet — assignee updates this as work progresses._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/006-cli-property`

**Branch convention:** `feat/<issue-number>-<short-description>`

### Prerequisites for working on this issue

1. **Issue #004 merged** — JSON store with property CRUD
2. **Issue #001 merged** — CLI entry point exists
3. **Know your Telegram user ID** — send `/start` to @userinfobot on Telegram

### Assignee checklist (fill before starting)

- [ ] I have read the CLI Commands + Guest Onboarding sections of `docs/steward.md`
- [ ] Issue #004 (JSON store) is merged
- [ ] I know how to get a Telegram user ID
- [ ] I understand the Property interface from `src/types.ts`
