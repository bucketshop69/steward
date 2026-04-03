# Issue #024: Guest Onboarding Flow — New Member Detection + Identity Linking

## Summary

Wire up the full guest onboarding experience. When a new member joins the Telegram group, the agent welcomes them, confirms their identity, links them to a booking, and sends check-in info. This is the first impression — it needs to feel smooth.

## What needs to happen

### Flow

1. **New member detected** — grammy `message:new_chat_members` event
2. **Agent sends welcome** — "Welcome to [Property]! I'm Steward. Are you [Guest Name]?"
3. **Guest confirms** — "Yes" / "That's me" / confirms name
4. **Agent calls `link_guest`** — connects Telegram ID to booking
5. **Agent sends check-in info** — door code, WiFi, rules, etc.

### Edge cases

- Guest says "No" or gives a different name → check other pending bookings, or ask for name
- Multiple people join (family/group) → only link the primary guest, welcome others
- Bot is added to group before any booking → respond with "This property hasn't been set up yet"
- Guest was already linked (rejoining group) → welcome back, skip identity confirmation

### Integration

- Uses onboarding tools (issue #013) for `link_guest`
- Uses context tools (issue #010) for property/booking lookup
- Uses property tools (issue #011) for check-in info
- Uses bot (issue #008) for message sending

## Acceptance criteria

- [ ] New members get a welcome message
- [ ] Identity confirmation works with natural language ("yes", "that's me", etc.)
- [ ] `link_guest` is called and booking status updates to active
- [ ] Check-in info is sent after successful linking
- [ ] Edge cases handled gracefully

---

## Discovered during build

_No entries yet._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/024-guest-onboarding-flow`

### Prerequisites

1. **Issue #008 merged** — Telegram bot
2. **Issue #009 merged** — Claude agent
3. **Issue #010 merged** — context tools
4. **Issue #013 merged** — onboarding tools

### Assignee checklist

- [ ] I have read the "Guest Onboarding (Production Flow)" section of `docs/steward.md`
- [ ] All prerequisite issues are merged
- [ ] I have a test Telegram group to verify the flow
