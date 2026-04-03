# Issue #003: Types & Data Model

## Summary

Define all TypeScript interfaces and types for Steward. This is the contract that every other module builds against — properties, bookings, transactions, group mappings, plugins, and tool results.

## What needs to happen

Create `src/types.ts` with all interfaces from the spec:

### Core data types

```typescript
interface Property {
  id: string;
  name: string;
  address: string;
  hostTelegramId: number;
  telegramGroupId?: number;
  checkInInstructions: string;
  houseRules: string;
  wifiName: string;
  wifiPassword: string;
  amenities: string[];
  nearbyPlaces: string;
  dailyBudget: number;
  perTransactionLimit: number;
}

interface Booking {
  id: string;
  propertyId: string;
  guestName: string;
  guestTelegramId?: number;
  guestTelegramUsername?: string;
  telegramGroupId?: number;
  checkIn: string;         // ISO date
  checkOut: string;        // ISO date
  preferences?: string;
  status: 'pending' | 'active' | 'checked_out';
  totalSpent: number;
}

interface Transaction {
  id: string;
  propertyId: string;
  bookingId: string;
  plugin: string;
  amount: number;
  description: string;
  tx: string;
  timestamp: string;       // ISO datetime
}

interface GroupMapping {
  telegramGroupId: number;
  propertyId: string;
  bookingId: string;
}
```

### Plugin types

```typescript
interface Plugin {
  name: string;
  description: string;
  triggers: string[];
  handle(params: PluginParams): Promise<PluginResult>;
}

interface PluginParams {
  guest: { name: string; telegramId: number; preferences?: string };
  property: Property;
  request: string;
  wallet: WalletService;
  mock: boolean;
}

interface PluginResult {
  message: string;
  transaction?: {
    amount: number;
    recipient: string;
    description: string;
    tx?: string;
  };
}
```

### Tool result types

```typescript
interface UserIdentity {
  role: 'guest' | 'host' | 'unknown';
  name?: string;
  booking?: Booking;
}

interface BudgetCheck {
  allowed: boolean;
  remaining: number;
  dailyBudget: number;
  spentToday: number;
}
```

### Wallet types

```typescript
interface WalletService {
  getBalance(): Promise<number>;
  payX402(params: {
    amount: number;
    currency: string;
    recipient: string;
    description: string;
  }): Promise<{ tx: string }>;
}
```

## Acceptance criteria

- [ ] `src/types.ts` exports all interfaces listed above
- [ ] `npm run build` passes with no type errors
- [ ] Types match the spec in `docs/steward.md` exactly
- [ ] No `any` types

---

## Discovered during build

> This section is maintained by the assignee during implementation. Document decisions, surprises, blockers, and anything the next person needs to know.

_No entries yet — assignee updates this as work progresses._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/003-types-and-data-model`

**Branch convention:** `feat/<issue-number>-<short-description>`

### Prerequisites for working on this issue

1. **Issue #001 merged** — project scaffolding must exist
2. **Read `docs/steward.md`** — data model section specifically
3. **TypeScript strict mode** — no implicit any, strict null checks

### Assignee checklist (fill before starting)

- [ ] I have read the Data Model section of `docs/steward.md`
- [ ] Issue #001 (scaffolding) is merged
- [ ] I understand all the interfaces and their relationships
