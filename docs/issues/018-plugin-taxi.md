# Issue #018: Taxi/Transport Plugin (Mocked)

## Summary

Implement the taxi/transport plugin. Handles ride booking with pickup, destination, and time. Mock mode estimates cost based on distance keywords and returns a confirmation.

## What needs to happen

### `src/plugins/taxi.ts`

- Triggers: `["taxi", "ride", "uber", "transport", "car", "pickup", "airport", "drive"]`
- Cost estimation: $10-80 based on destination keywords (airport = $50, nearby = $10, default = $25)
- Tool params: pickup, destination, time, people count

### Tool schema

```typescript
{
  name: "book_taxi",
  description: "Book a taxi or transport service",
  input_schema: {
    type: "object",
    properties: {
      pickup: { type: "string", description: "Pickup location (or 'property' for the rental)" },
      destination: { type: "string", description: "Where to go" },
      time: { type: "string", description: "When (e.g., 'now', 'in 30 min', '3pm')" },
      people: { type: "number", description: "Number of passengers" }
    },
    required: ["destination"]
  }
}
```

## Acceptance criteria

- [ ] Plugin implements Plugin interface
- [ ] Cost varies by destination type
- [ ] Mock transaction generated
- [ ] Response includes ETA

---

## Discovered during build

_No entries yet._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/018-plugin-taxi`

### Prerequisites

1. **Issue #015 merged** — plugin registry

### Assignee checklist

- [ ] Issue #015 (plugin registry) is merged
