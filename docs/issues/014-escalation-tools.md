# Issue #014: Escalation Tools — escalate_to_host

## Summary

Implement the escalation tool. When the agent can't handle something (maintenance, over-budget requests, emergencies), it escalates to the host with context. Since everyone is in the same Telegram group, "escalation" means tagging the host and providing a summary.

## What needs to happen

### `src/tools/escalate.ts`

#### `escalate_to_host(property_id: string, reason: string, urgency: 'low' | 'medium' | 'high')`

- Get host's Telegram ID from property
- Format escalation message:
  ```
  ⚠️ @host — [reason]
  
  Urgency: [low/medium/high]
  Property: [name]
  Guest: [name] (if known)
  ```
- Return the formatted message for the bot to send
- Log the escalation in transaction history (as a non-payment event, amount: 0)

### When the agent escalates

- Maintenance issues that can't be resolved with troubleshooting
- Budget exceeded — guest wants something over the limit
- Safety concerns — anything the agent isn't confident handling
- Guest complaints — after first attempt to resolve
- Unknown requests — things outside the agent's capabilities

### Tool schema

```typescript
{
  name: "escalate_to_host",
  description: "Escalate an issue to the property host. Use when you can't resolve something, budget is exceeded, or there's a maintenance/safety issue.",
  input_schema: {
    type: "object",
    properties: {
      property_id: { type: "string" },
      reason: { type: "string", description: "Clear explanation of what needs host attention" },
      urgency: { type: "string", enum: ["low", "medium", "high"] }
    },
    required: ["property_id", "reason", "urgency"]
  }
}
```

## Acceptance criteria

- [ ] Escalation formats a clear message with host mention
- [ ] Urgency levels produce different formatting (emoji/emphasis)
- [ ] Escalation is logged
- [ ] Tool schema defined

---

## Discovered during build

> This section is maintained by the assignee during implementation. Document decisions, surprises, blockers, and anything the next person needs to know.

_No entries yet — assignee updates this as work progresses._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/014-escalation-tools`

**Branch convention:** `feat/<issue-number>-<short-description>`

### Prerequisites for working on this issue

1. **Issue #004 merged** — JSON store
2. **Issue #003 merged** — types

### Assignee checklist (fill before starting)

- [ ] I have read the escalation scenarios in `docs/steward.md`
- [ ] Issues #003 and #004 are merged
- [ ] I understand that escalation = message in group, not a separate channel
