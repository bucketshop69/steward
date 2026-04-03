# Issue #012: Budget Tools — check_budget, get_transaction_history

## Summary

Implement budget checking and transaction history tools. The agent calls `check_budget` before any paid service to verify the spend is within limits. `get_transaction_history` gives a spending log for the host or for summary requests.

## What needs to happen

### `src/tools/budget.ts`

#### `check_budget(property_id: string, amount: number)`

- Get property's `dailyBudget` and `perTransactionLimit`
- Get today's spend from `store.getTodaySpend(propertyId)`
- Check:
  - `amount <= perTransactionLimit` — single transaction limit
  - `todaySpend + amount <= dailyBudget` — daily budget limit
- Return:
  ```typescript
  {
    allowed: boolean;
    remaining: number;       // dailyBudget - todaySpend
    dailyBudget: number;
    spentToday: number;
    reason?: string;         // if not allowed, explain why
  }
  ```

#### `get_transaction_history(property_id: string, booking_id?: string)`

- Return list of transactions for the property (optionally filtered by booking)
- Include running total
- Return:
  ```typescript
  {
    transactions: Transaction[];
    totalSpent: number;
    dailyBudget: number;
    remaining: number;
  }
  ```

### Tool schemas

Define both tools for Claude tool use with clear descriptions so the agent knows when to call each.

## Acceptance criteria

- [ ] `check_budget` correctly enforces daily and per-transaction limits
- [ ] `check_budget` returns clear reasons when a request is denied
- [ ] `get_transaction_history` returns filtered transaction list with totals
- [ ] Tool schemas are defined

---

## Discovered during build

> This section is maintained by the assignee during implementation. Document decisions, surprises, blockers, and anything the next person needs to know.

_No entries yet — assignee updates this as work progresses._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/012-budget-tools`

**Branch convention:** `feat/<issue-number>-<short-description>`

### Prerequisites for working on this issue

1. **Issue #004 merged** — JSON store with transaction queries
2. **Issue #003 merged** — types

### Assignee checklist (fill before starting)

- [ ] I have read the Budget Tools + OWS Policy sections of `docs/steward.md`
- [ ] Issues #003 and #004 are merged
- [ ] I understand the budget enforcement flow (check before pay)
