# Issue #023: Host Takeover Logic

## Summary

Implement the host takeover system. When the host types in the group, the agent backs off. When the host mentions @steward, the agent executes commands. This is critical for trust — the host must always feel in control.

## What needs to happen

### Host detection (in `src/bot.ts`)

```typescript
if (sender === property.hostTelegramId) {
  if (message.includes('@steward')) {
    await handleHostCommand(message, property);
  }
  return; // Agent stays quiet
}
```

### Host commands

| Command | Action |
|---------|--------|
| `@steward handle this` | Agent resumes responding to guests |
| `@steward stop` | Agent pauses in this group (won't respond to guests) |
| `@steward summary` | Agent posts booking + spending summary |
| `@steward budget` | Agent posts remaining budget |

### State management

- Per-group `paused` flag (in-memory, default: false)
- When paused, agent ignores guest messages until `@steward handle this`
- Pause state can be stored in the booking or as a separate in-memory map

### Command parsing

Parse `@steward <command>` from host messages. Be flexible — handle "@ steward", "@Steward", case-insensitive.

## Acceptance criteria

- [ ] Host messages are detected and agent stays quiet
- [ ] @steward commands are parsed and executed
- [ ] `stop` pauses the agent, `handle this` resumes
- [ ] `summary` and `budget` return correct info
- [ ] Pause state persists during the session

---

## Discovered during build

_No entries yet._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/023-host-takeover`

### Prerequisites

1. **Issue #008 merged** — Telegram bot with message handler
2. **Issue #010 merged** — context tools (to identify host)
3. **Issue #012 merged** — budget tools (for @steward budget)

### Assignee checklist

- [ ] I have read the "Host Takeover" section of `docs/steward.md`
- [ ] Issues #008, #010, #012 are merged
- [ ] I understand the pause/resume state model
