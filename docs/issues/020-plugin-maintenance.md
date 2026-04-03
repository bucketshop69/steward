# Issue #020: Maintenance Plugin (Escalates to Host)

## Summary

Implement the maintenance plugin. Unlike other plugins, this one doesn't pay for anything — it guides the guest through basic troubleshooting and escalates to the host if the issue persists. This is the safety net.

## What needs to happen

### `src/plugins/maintenance.ts`

- Triggers: `["broken", "not working", "maintenance", "repair", "fix", "leak", "ac", "heating", "plumbing"]`
- Flow:
  1. Identify the issue type (AC, plumbing, electrical, appliance, other)
  2. Suggest basic troubleshooting (reset button, check circuit breaker, etc.)
  3. If guest says it's still broken → call `escalate_to_host` with the issue details
- No payment — maintenance is always escalated to host for real action

### Tool schema

```typescript
{
  name: "report_maintenance",
  description: "Report a maintenance issue. Will attempt basic troubleshooting first, then escalate to the host if needed.",
  input_schema: {
    type: "object",
    properties: {
      issue: { type: "string", description: "What's broken or not working" },
      location: { type: "string", description: "Where in the property" },
      severity: { type: "string", enum: ["minor", "major", "urgent"], description: "How urgent" }
    },
    required: ["issue"]
  }
}
```

## Acceptance criteria

- [ ] Plugin identifies issue types
- [ ] Troubleshooting suggestions are reasonable
- [ ] Escalation to host happens when troubleshooting fails
- [ ] No payment transaction is created

---

## Discovered during build

_No entries yet._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/020-plugin-maintenance`

### Prerequisites

1. **Issue #015 merged** — plugin registry
2. **Issue #014 merged** — escalation tools

### Assignee checklist

- [ ] Issues #014 and #015 are merged
