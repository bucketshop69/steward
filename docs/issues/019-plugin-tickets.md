# Issue #019: Event Tickets Plugin (Mocked)

## Summary

Implement the event/activity tickets plugin. Handles booking local activities, tours, shows, etc. Mock mode estimates cost and returns confirmation.

## What needs to happen

### `src/plugins/tickets.ts`

- Triggers: `["tickets", "event", "show", "tour", "activity", "museum", "concert", "booking"]`
- Cost estimation: $20-150 per person based on event type
- Tool params: event description, people count, date

### Tool schema

```typescript
{
  name: "book_tickets",
  description: "Book tickets for local events, tours, activities, or attractions",
  input_schema: {
    type: "object",
    properties: {
      event: { type: "string", description: "What event or activity" },
      people: { type: "number", description: "Number of tickets" },
      date: { type: "string", description: "Preferred date" }
    },
    required: ["event", "people"]
  }
}
```

## Acceptance criteria

- [ ] Plugin implements Plugin interface
- [ ] Cost varies by event type
- [ ] Mock transaction generated

---

## Discovered during build

_No entries yet._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/019-plugin-tickets`

### Prerequisites

1. **Issue #015 merged** — plugin registry

### Assignee checklist

- [ ] Issue #015 (plugin registry) is merged
