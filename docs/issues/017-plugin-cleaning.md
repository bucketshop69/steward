# Issue #017: Cleaning Plugin (Mocked)

## Summary

Implement the cleaning service plugin. Supports scheduling standard and deep cleans. Auto-triggered on check-out day. Mock mode simulates the booking and payment.

## What needs to happen

### `src/plugins/cleaning.ts`

```typescript
const cleaningPlugin: Plugin = {
  name: "cleaning",
  description: "Schedule cleaning services for the property",
  triggers: ["clean", "cleaning", "housekeeping", "tidy", "maid"],
  
  async handle(params: PluginParams): Promise<PluginResult> {
    // 1. Determine cleaning type: "standard" ($50) or "deep" ($120)
    // 2. Parse requested date/time
    // 3. Generate mock transaction
    // 4. Return confirmation with scheduled time
  }
}
```

### Cleaning types

| Type | Cost | When |
|------|------|------|
| Standard | $50 | Between guests, routine |
| Deep | $120 | Monthly, after long stays, special request |

### Tool schema

```typescript
{
  name: "book_cleaning",
  description: "Schedule a cleaning service for the property",
  input_schema: {
    type: "object",
    properties: {
      property_id: { type: "string" },
      date: { type: "string", description: "When to clean (ISO date or 'today'/'tomorrow')" },
      type: { type: "string", enum: ["standard", "deep"], description: "Cleaning type" },
      notes: { type: "string", description: "Special instructions" }
    },
    required: ["property_id", "date", "type"]
  }
}
```

## Acceptance criteria

- [ ] Plugin handles standard and deep cleaning types
- [ ] Cost is correct per type
- [ ] Date parsing works for common formats
- [ ] Mock transaction generated

---

## Discovered during build

_No entries yet._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/017-plugin-cleaning`

### Prerequisites

1. **Issue #015 merged** — plugin registry

### Assignee checklist

- [ ] Issue #015 (plugin registry) is merged
- [ ] I understand the Plugin interface
