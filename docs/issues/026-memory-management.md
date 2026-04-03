# Issue #026: Memory & Context Management — Per-Booking Folders, Periodic Snapshots

## Summary

Implement the conversation memory system. Each booking gets its own folder (`data/<property>_<guest>_<date>/`) with conversation history and periodic memory snapshots. This prevents context window overflow on long stays and enables the agent to resume context after restarts.

## What needs to happen

### Folder structure

```
data/
  beach-house_john_20260410/
    history.json          # Full conversation history
    memory.json           # Compressed memory snapshot (latest)
    memory_20260411.json  # Daily snapshot
    memory_20260412.json
    transactions.json     # Booking-specific transactions
```

### Conversation history

- Store all messages (guest + agent + tool calls) in `history.json`
- On each agent call, load history and pass to Claude
- When history exceeds a threshold (e.g., 50 messages), summarize older messages into a memory snapshot

### Memory snapshots

- **Periodic** (every ~1 hour): save a compressed summary of the conversation so far
- **Daily** (end of day): save a daily snapshot with key events
- **On demand** — agent can trigger a snapshot when important context is established

### Snapshot format

```typescript
interface MemorySnapshot {
  bookingId: string;
  timestamp: string;
  summary: string;          // AI-generated summary of conversation
  keyFacts: string[];       // Guest preferences discovered, issues reported, etc.
  pendingActions: string[]; // Things the agent needs to follow up on
  totalSpent: number;
}
```

### Context window management

- Keep last 20 messages in full
- Older messages → replaced by memory snapshot summary
- System prompt includes: property info + memory snapshot + recent messages

## Acceptance criteria

- [ ] Per-booking folders are created on booking activation
- [ ] Conversation history is persisted to disk
- [ ] Memory snapshots are generated periodically
- [ ] Agent resumes context correctly after restart
- [ ] Context window stays manageable on long stays

---

## Discovered during build

_No entries yet._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/026-memory-management`

### Prerequisites

1. **Issue #009 merged** — Claude agent with conversation handling
2. **Issue #004 merged** — JSON store
3. **Issue #013 merged** — onboarding (booking activation creates folder)

### Assignee checklist

- [ ] I understand the conversation history → memory snapshot flow
- [ ] All prerequisite issues are merged
- [ ] I understand Claude's context window limits and token counting
