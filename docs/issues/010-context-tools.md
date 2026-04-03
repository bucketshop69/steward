# Issue #010: Context Tools — get_property_by_group, identify_user, get_booking

## Summary

Implement the three context tools the agent calls on every message to understand who's talking, which property this is, and what booking is active. These are the foundation — every agent interaction starts with these.

## What needs to happen

### `src/tools/context.ts`

#### `get_property_by_group(group_id: number)`

- Calls `store.getPropertyByGroupId(groupId)`
- Returns full property object (name, rules, WiFi, amenities, budget, etc.)
- Returns error if no property mapped to this group

#### `identify_user(telegram_id: number, property_id: string)`

- Check if `telegram_id === property.hostTelegramId` → return `{ role: "host" }`
- Check if any booking for this property has `guestTelegramId === telegram_id` → return `{ role: "guest", name, booking }`
- Otherwise → return `{ role: "unknown" }`

#### `get_booking(property_id: string, booking_id?: string)`

- If `booking_id` provided → return that specific booking
- Otherwise → return the active booking for the property (`status === 'active'`)
- Include `budgetRemaining` calculated from daily budget minus today's spend

### Tool schema format

Each tool needs a JSON schema for Claude's tool use:

```typescript
{
  name: "get_property_by_group",
  description: "Look up which property a Telegram group belongs to. Call this first on every message.",
  input_schema: {
    type: "object",
    properties: {
      group_id: { type: "number", description: "Telegram group/chat ID" }
    },
    required: ["group_id"]
  }
}
```

## Acceptance criteria

- [ ] All three tools work with the JSON store
- [ ] Tool schemas are defined for Claude tool use
- [ ] `identify_user` correctly distinguishes host, guest, and unknown
- [ ] `get_booking` includes calculated `budgetRemaining`
- [ ] Error cases return meaningful messages (not crashes)

---

## Discovered during build

> This section is maintained by the assignee during implementation. Document decisions, surprises, blockers, and anything the next person needs to know.

_No entries yet — assignee updates this as work progresses._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/010-context-tools`

**Branch convention:** `feat/<issue-number>-<short-description>`

### Prerequisites for working on this issue

1. **Issue #004 merged** — JSON store must exist
2. **Issue #003 merged** — types defined
3. **Read "Agent Context Discovery"** section of `docs/steward.md`

### Assignee checklist (fill before starting)

- [ ] I have read the "Agent Context Discovery" section of `docs/steward.md`
- [ ] Issues #003 and #004 are merged
- [ ] I understand how the agent uses these tools (called on every message)
- [ ] I understand the tool schema format for Claude tool use
