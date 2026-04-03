# Steward — "Steward knows how to manage"

An autonomous AI agent that replaces the human Airbnb/property host. One Telegram group per property — guest, host, and agent all in the same chat. The agent handles everything: check-in instructions, guest questions, food orders, cleaning, taxis, maintenance — paying for services via x402 micropayments from an OWS wallet. The host watches the group and can take over anytime.

---

## The Problem

Managing a short-term rental today:

- Host is on-call 24/7 for guest questions ("where's the WiFi?", "AC isn't working")
- Host manually coordinates cleaners, maintenance, restocking between guests
- Host uses 5 different apps: Airbnb messaging, WhatsApp, cleaning service app, food delivery, taxi
- Scaling to 10+ properties means hiring staff

**Steward replaces the host with an agent.** One agent can manage 100 properties. It never sleeps. It pays for services autonomously. The host just sets policies and jumps in when needed.

---

## How It Works

```
┌──────────────────────────────────────────────┐
│  Telegram Group: "Beach House - Apr 10"      │
│                                              │
│  👤 Guest (John)                             │
│  👤 Guest (John's wife)                      │
│  🤖 Steward Bot (agent)                      │
│  🏠 Host (property owner)                    │
│                                              │
│  Everyone sees everything.                   │
│  Host can take over at any time.             │
│  Agent shuts up when host is typing.         │
└──────────────────────────────────────────────┘
                      │
                 Steward Agent
              (Claude + tool use)
                      │
              ┌───────┼───────┐
              │       │       │
         OWS Wallet  Store   Tools
         (USDC/SOL)  (local)  │
              │               │
    ┌─────────┼─────────┐     ├─ get_property_by_group()
    │         │         │     ├─ identify_user()
 Plugin:   Plugin:   Plugin:  ├─ get_property_info()
  Food     Clean      Taxi    ├─ get_booking()
    │         │         │     ├─ check_budget()
 x402 pay  x402 pay  x402    ├─ order_food()
    │         │         │     ├─ book_cleaning()
 (mocked)  (mocked)  (mocked) └─ escalate_to_host()
```

### The Group Model

**One Telegram group per property per booking.** Guest, host, and agent are all in the same group.

Why groups, not DMs:

- **Host sees everything** — no separate notification channel needed
- **Host can take over** — just type in the group, agent backs off
- **Multiple guests** — a couple or family can all be in the same group
- **Transparency** — guest sees what agent orders, host sees what guest asks
- **Simple** — no routing logic, no separate host/guest channels

### How Messages Flow

```
Message arrives in group
  │
  ├─ From host? → Agent stays quiet (unless @steward is mentioned)
  │
  ├─ From guest? → Agent processes:
  │     1. get_property_by_group(group_id)     → which property?
  │     2. identify_user(telegram_id)           → who is this?
  │     3. [tool calls based on request]        → handle it
  │     4. Reply in group                       → guest + host see it
  │
  └─ @steward command from host? → Agent executes
        "@steward handle this"  → agent resumes
        "@steward stop"         → agent pauses in this group
        "@steward summary"      → agent posts booking summary
```

---

## CLI Commands

```bash
steward init                          # First-time setup (wallet, bot token, Claude key)
steward property add                  # Add a property (interactive prompts)
steward property list                 # List all properties
steward booking add --property <id>   # Add a booking (guest name, dates → creates Telegram group)
steward booking list                  # List active bookings
steward start                         # Start the bot (production)
steward start --mock                  # Start with mocked plugins (for demo)
```

---

## Guest Onboarding (Production Flow)

This is how a real deployment works, end to end.

### Step 1: Host sets up a property

```bash
steward property add
```

Interactive prompts:

```
Property name: Beach House
Address: 123 Ocean Drive, Miami
Check-in instructions: Door code is 4521. Parking spot #3.
House rules: No smoking. Quiet after 10pm. No parties.
WiFi name: BeachLife2026
WiFi password: sunny123
Amenities: pool, AC, parking, washer, dishwasher
Nearby: Whole Foods (5 min walk), Beach Bar (2 min), Hospital (10 min drive)
Daily budget (USDC): 200
Per-transaction limit (USDC): 100
Your Telegram user ID: 7883754831
```

Saved to `data/properties.json`.

### Step 2: Host adds a booking

```bash
steward booking add --property beach-house
```

Interactive prompts:

```
Guest name: John Smith
Check-in: 2026-04-10
Check-out: 2026-04-15
Guest preferences (optional): Vegetarian, allergic to nuts
Guest Telegram username (optional): @johnsmith
```

Steward does:

1. Saves booking to `data/bookings.json`
2. Creates a Telegram group: "Beach House - Apr 10"
3. Adds the Steward bot to the group
4. Generates an invite link for the group
5. Prints: `Invite link: https://t.me/+abc123xyz — Send this to the guest`

### Step 3: Host sends invite link to guest

Host copies the group invite link and sends it to the guest via Airbnb messaging, SMS, email, WhatsApp — whatever channel they already use.

### Step 4: Guest joins the group

Guest clicks the invite link, joins the Telegram group. The agent detects a new member:

```
Agent: "Welcome to Beach House! 👋 I'm Steward, your property assistant.
I can help with check-in, local recommendations, food orders, transport,
and anything else you need during your stay.

Are you John Smith? (Just confirming so I can load your booking.)"
```

Guest: "Yes that's me"

Agent calls `link_guest(telegram_id: 12345, property_id: "beach-house", booking_ref: "bk-0410")`:

```
Agent: "Great, John! You're booked Apr 10-15.

🏠 Check-in info:
- Door code: 4521
- Parking: Spot #3
- WiFi: BeachLife2026 / sunny123

House rules: No smoking, quiet after 10pm.

I'm here 24/7 — ask me anything!"
```

### Step 5: Ongoing — agent handles everything

The agent now knows:

- **Who** is in the group (guest John, host, other guests)
- **Which property** this group is for
- **Booking details** (dates, preferences, budget)
- **Property knowledge** (WiFi, rules, amenities, nearby places)

All discovered via tool calls — nothing hardcoded.

### Step 6: Guest checks out

On check-out day, agent auto-triggers:

```
Agent: "Hi John! Today's your check-out day (Apr 15).

🧹 I've scheduled a cleaning for 12pm.
📊 Booking summary:
  - Food orders: $87 USDC (3 orders)
  - Taxi: $24 USDC (1 trip)
  - Total services: $111 USDC

Thanks for staying at Beach House! Safe travels. 🏖️"
```

Agent calls `book_cleaning(property_id, date: today, type: "standard")` → x402 payment.

---

## Agent Context Discovery (Tool Calling)

The agent knows NOTHING upfront. It discovers everything through tool calls. This is the core architectural decision — the agent is stateless, the store is the source of truth.

### Context Tools (called on every message)

| Tool | Purpose | Returns |
|------|---------|---------|
| `get_property_by_group(group_id)` | Which property is this group for? | Property object (name, rules, WiFi, amenities, budget) |
| `identify_user(telegram_id, property_id)` | Who sent this? Guest or host? | `{ role: "guest"\|"host"\|"unknown", name, booking }` |
| `get_booking(property_id, guest_id)` | Current booking details | Dates, preferences, budget remaining, transaction history |

### Action Tools (called based on guest request)

| Tool | Purpose | x402 Payment |
|------|---------|-------------|
| `get_property_info(property_id, question)` | Answer property questions (WiFi, rules, etc.) | No |
| `order_food(cuisine, people, dietary, budget)` | Food delivery | Yes (mocked) |
| `book_cleaning(property_id, date, type)` | Schedule cleaning | Yes (mocked) |
| `book_taxi(pickup, destination, time)` | Transport | Yes (mocked) |
| `book_tickets(event, people, date)` | Activities/events | Yes (mocked) |
| `check_budget(property_id, amount)` | Can we afford this? | No |
| `escalate_to_host(reason, urgency)` | Flag for host attention | No |
| `link_guest(telegram_id, property_id, booking_ref)` | Connect new user to booking | No |
| `get_transaction_history(property_id)` | Spending log | No |

### Agent Reasoning Flow (example)

```
Message: "Can you order pizza?" from user 12345 in group 67890

Agent thinks:
1. Call get_property_by_group(67890)
   → { id: "beach-house", name: "Beach House", dailyBudget: 200, ... }

2. Call identify_user(12345, "beach-house")
   → { role: "guest", name: "John", bookingId: "bk-0410" }

3. Call get_booking("beach-house", "bk-0410")
   → { checkOut: "2026-04-15", preferences: "vegetarian, no nuts", budgetRemaining: 113 }

4. Call check_budget("beach-house", 25)
   → { allowed: true, remaining: 113 }

5. Call order_food({ cuisine: "pizza", people: 1, dietary: "vegetarian, no nuts", budget: 25 })
   → { message: "Ordered veggie pizza, $22 USDC", tx: "3xK9..." }

6. Reply: "Ordered a veggie pizza (no nuts) for $22 USDC. Should arrive in ~25 min!"
   (Host sees this in the same group — no separate notification needed)
```

### Host Takeover

The agent detects messages from the host's Telegram ID and behaves differently:

```typescript
// In message handler
const property = await getPropertyByGroup(groupId);
const sender = ctx.from.id;

if (sender === property.hostTelegramId) {
  // Host is talking — agent stays quiet unless mentioned
  if (message.includes('@steward')) {
    // Host is commanding the agent
    await handleHostCommand(message, property);
  }
  // Otherwise: shut up, host is handling it
  return;
}

// It's a guest message — agent handles it
await handleGuestMessage(message, property, sender);
```

Host commands:

- `@steward handle this` — agent resumes responding in this group
- `@steward stop` — agent pauses (won't respond to guests)
- `@steward summary` — agent posts booking + spending summary
- `@steward budget` — agent posts remaining budget
- Host just typing normally — agent stays quiet, lets host handle it

---

## Architecture

### Tech Stack

- **Runtime**: Node.js (TypeScript)
- **Chat**: Telegram Bot API (`grammy`)
- **AI**: Claude API (`@anthropic-ai/sdk`) — agent reasoning + tool use
- **Wallet**: OWS (`@open-wallet-standard/core`) — local key custody, policy engine
- **Payments**: x402 protocol — agent pays for services via HTTP micropayments
- **Storage**: Local JSON files — properties, bookings, transactions
- **Chain**: Solana only, USDC for all payments

### Project Structure

```
steward/
├── src/
│   ├── index.ts              # Entry point — CLI parser + start bot
│   ├── bot.ts                # Telegram bot (group message handler)
│   ├── agent.ts              # Claude agent with tool use
│   ├── wallet.ts             # OWS wallet wrapper (create, pay, balance)
│   ├── x402.ts               # x402 payment client
│   ├── tools/
│   │   ├── context.ts        # get_property_by_group, identify_user, get_booking
│   │   ├── property.ts       # get_property_info
│   │   ├── budget.ts         # check_budget, get_transaction_history
│   │   ├── onboarding.ts     # link_guest
│   │   └── escalate.ts       # escalate_to_host
│   ├── plugins/
│   │   ├── registry.ts       # Plugin loader + registry
│   │   ├── food.ts           # Food delivery (mocked)
│   │   ├── cleaning.ts       # Cleaning service (mocked)
│   │   ├── taxi.ts           # Taxi/transport (mocked)
│   │   ├── tickets.ts        # Event tickets (mocked)
│   │   └── maintenance.ts    # Maintenance (escalates to host)
│   ├── store/
│   │   ├── properties.ts     # CRUD for properties
│   │   ├── bookings.ts       # CRUD for bookings + guest linking
│   │   └── transactions.ts   # Transaction log
│   ├── cli/
│   │   ├── init.ts           # steward init
│   │   ├── property.ts       # steward property add/list
│   │   └── booking.ts        # steward booking add/list
│   └── types.ts              # Shared types
├── data/                     # Local JSON storage
│   ├── properties.json
│   ├── bookings.json
│   └── transactions.json
├── package.json
├── tsconfig.json
└── .env
```

### Key Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@open-wallet-standard/core": "^1.2.0",
    "grammy": "^1.35.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0",
    "tsx": "^4.7.0"
  }
}
```

---

## Plugin System

Every service is a plugin with the same interface:

```typescript
interface Plugin {
  name: string;                    // "food-delivery"
  description: string;             // "Order food from local restaurants"
  triggers: string[];              // ["food", "hungry", "dinner", "order food", "eat"]

  handle(params: {
    guest: Guest;
    property: Property;
    request: string;               // Guest's natural language request
    wallet: WalletService;         // OWS wallet for payments
    mock: boolean;                 // true = mocked response, false = real API
  }): Promise<PluginResult>;
}

interface PluginResult {
  message: string;                 // Response to show in group
  transaction?: {
    amount: number;                // USDC amount
    recipient: string;             // Service provider wallet
    description: string;           // "Thai food delivery for 4"
    tx?: string;                   // x402 payment tx signature (real or simulated)
  };
}
```

### Mock vs Real

The `--mock` flag on `steward start` sets `mock: true` for all plugins:

```typescript
// food.ts
async handle(params): Promise<PluginResult> {
  const fee = estimateCost(params.request); // $20-80 based on people count

  let tx: string | undefined;
  if (params.mock) {
    // Simulated — generate fake tx signature
    tx = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  } else {
    // Real — x402 payment
    const payResult = await params.wallet.payX402({
      amount: fee,
      currency: 'USDC',
      recipient: 'RealFoodServiceWallet...',
      description: `Food delivery: ${params.request}`,
    });
    tx = payResult.tx;
  }

  return {
    message: `Ordered! ${params.request}. Total: $${fee} USDC. Arriving in ~30 min.`,
    transaction: { amount: fee, recipient: 'FoodService', description: params.request, tx },
  };
}
```

Post-hackathon, swap mock internals for real API integrations. The agent code doesn't change — only the plugin internals.

---

## Data Model

```typescript
interface Property {
  id: string;
  name: string;                    // "Beach House"
  address: string;
  hostTelegramId: number;          // Host's Telegram user ID
  telegramGroupId?: number;        // Current active group (set per booking)
  checkInInstructions: string;     // Door code, directions, etc.
  houseRules: string;              // No smoking, quiet after 10pm, etc.
  wifiName: string;
  wifiPassword: string;
  amenities: string[];             // ["pool", "AC", "parking", "washer"]
  nearbyPlaces: string;            // Restaurants, ATMs, hospitals, etc.
  dailyBudget: number;             // Max USDC spend per day
  perTransactionLimit: number;     // Max single transaction
}

interface Booking {
  id: string;
  propertyId: string;
  guestName: string;
  guestTelegramId?: number;        // Set when guest joins group and confirms
  guestTelegramUsername?: string;   // Optional, for invite
  telegramGroupId?: number;        // The group created for this booking
  checkIn: string;                 // ISO date
  checkOut: string;                // ISO date
  preferences?: string;            // Dietary restrictions, etc.
  status: 'pending' | 'active' | 'checked_out';
  totalSpent: number;              // Running total USDC
}

interface Transaction {
  id: string;
  propertyId: string;
  bookingId: string;
  plugin: string;                  // "food-delivery", "cleaning", etc.
  amount: number;                  // USDC
  description: string;
  tx: string;                      // Solana tx signature (real or mock)
  timestamp: string;               // ISO datetime
}

// Group-to-property mapping (for tool calls)
interface GroupMapping {
  telegramGroupId: number;
  propertyId: string;
  bookingId: string;
}
```

---

## OWS + x402 Integration

### Wallet Setup

Each Steward instance has ONE OWS wallet. Properties share the wallet but have separate policy scopes.

```bash
ows wallet create --name "steward-main"
ows fund balance --wallet steward-main
```

### Policy Engine

OWS policies control spending per property:

```json
{
  "name": "property-beach-house",
  "chain": "solana",
  "rules": {
    "max_per_transaction": 100,
    "max_per_day": 200,
    "currency": "USDC"
  }
}
```

When the agent tries to pay for a service:

1. Agent calls `check_budget(property_id, amount)` first
2. If within budget → `wallet.payX402(amount, recipient)`
3. OWS policy engine double-checks
4. If over budget → agent tells guest "I need to check with the host for this amount" and escalates

### x402 Payment Flow

```typescript
async function payForService(params: {
  wallet: string;
  amount: number;
  recipient: string;
  description: string;
}): Promise<{ tx: string }> {
  const ows = await import('@open-wallet-standard/core');
  const tx = await ows.signTransaction(params.wallet, 'solana', {
    type: 'transfer',
    token: 'USDC',
    amount: params.amount,
    to: params.recipient,
  });
  return { tx };
}
```

---

## What We Already Know (from LPCLI work)

### OWS

- Package: `@open-wallet-standard/core` (npm, v1.2.0)
- Embeds Rust core via FFI — fully self-contained
- Wallet creation: `ows wallet create --name "steward-main"`
- Signing: `ows.signTransaction(walletName, 'solana', txHex)`
- Policy engine: `ows policy create` — chain allowlists, spend limits, expiry
- API keys: `ows key create` — scoped keys for sub-agents
- Balance: `ows fund balance --wallet steward-main`
- x402: `ows pay request <url>` — make paid HTTP request with auto-payment
- x402: `ows pay discover` — find x402-enabled services
- Keys stored locally at `~/.ows/wallets/` — encrypted at rest

### x402 Protocol

- Server returns HTTP 402 with `x-402-payment` header (base64 JSON)
- Payment header contains: chain, currency, amount, recipient, description
- Client pays, gets receipt (tx signature)
- Client re-sends original request with `x-402-receipt` header
- Server verifies receipt and fulfills the request
- **Gotcha we found**: Node's HTTP rejects raw JSON in headers — must base64-encode

### Telegram via Node.js (grammy)

- `grammy` is the modern Telegram bot framework for Node/TS
- Groups: bot can be added to groups, receives all messages
- `ctx.chat.id` = group ID, `ctx.from.id` = sender's user ID
- Bot can create groups via Telegram API (or host creates manually)
- Invite links: `bot.api.createChatInviteLink(groupId)`
- Detect new members: `bot.on('chat_member')` or `message:new_chat_members`

### Claude Agent (Anthropic SDK)

- `@anthropic-ai/sdk` — official TypeScript SDK
- Tool use: define tools as JSON schemas, Claude calls them in conversation
- Each context tool + plugin = one tool in the Claude tool use schema
- Conversation history: pass full message array for context continuity
- System prompt: "You are Steward, a property host agent" + tool descriptions

---

## Hackathon Demo Script

### Setup (pre-demo, ~5 min)

```bash
steward init                    # Configure bot token, Claude key, OWS wallet
steward property add            # Add "Demo Beach House"
steward booking add --property demo-beach-house   # Add guest "John"
steward start --mock            # Start in mock mode
```

### Live Demo (2-3 minutes)

1. **Guest joins Telegram group** via invite link
2. **Agent**: "Welcome! I'm Steward. Are you John Smith?"
3. **Guest**: "Yes that's me"
4. **Agent**: "Great John! Here's your check-in info: Door code 4521, WiFi BeachLife2026/sunny123..."
5. **Guest**: "Can you order dinner? Thai food for 2, no peanuts"
6. **Agent**: "Found options: 1) Pad Thai + Green Curry ($32) 2) Tom Yum ($28). Which one?"
7. **Guest**: "Option 1"
8. **Agent**: "Ordered! $32 USDC charged. Arriving ~30 min. [tx: mock_abc123]"
9. **Host sees it all in the same group** — no context switching
10. **Guest**: "The AC isn't working"
11. **Agent**: "Have you tried the reset button on the unit?"
12. **Guest**: "Yes, still broken"
13. **Agent**: "⚠️ @host — AC issue at Beach House. Guest tried reset. Needs maintenance."
14. **Host types directly**: "I'll send someone in an hour"
15. **Agent stays quiet** — host is handling it
16. **Demo budget limit**: Guest tries to order $250 dinner → Agent: "That exceeds the daily budget ($200). Let me check with the host."

### What judges see

- Real Telegram group conversation (not mocked UI)
- Real AI reasoning (Claude tool use)
- Real OWS wallet (mock mode simulates tx signatures)
- Plugin architecture (food, cleaning, taxi — all same pattern)
- Host takeover (host types → agent backs off)
- Policy enforcement (budget limits work)
- Guest onboarding (join group → identify → load context)

---

## Environment Variables

```bash
# Telegram
TELEGRAM_BOT_TOKEN=           # From @BotFather

# AI
ANTHROPIC_API_KEY=            # Claude API key

# OWS
OWS_WALLET_NAME=steward-main # Wallet for payments

# Solana
SOLANA_RPC_URL=               # Helius or other RPC
CLUSTER=mainnet               # or devnet for testing

# Defaults
DAILY_BUDGET=200              # Default daily USDC limit per property
PER_TX_LIMIT=100              # Default per-transaction limit
```

---

```

---

## Track Fit

Steward is:

- Built on Solana (OWS wallet, USDC payments)
- Agentic AI (Claude-powered autonomous host with tool use)
- Vibecoded (built fast, demo-driven, mock plugins)
- Real product (not a toy — solves a real problem)

**OWS Hackathon Track 01** — Agentic Storefronts & Real-World Commerce:

- "Agents that run real businesses end-to-end"
- Agent holds an OWS wallet, pays suppliers via x402
- The agent IS the business (the host)

---

## Post-Hackathon Roadmap (not for now)

- Real API integrations (food delivery, cleaning, taxi APIs)
- Multi-property dashboard (web UI)
- Revenue tracking (host charges guest markup on services)
- Guest review/rating system
- Multi-language support (agent speaks guest's language)
- Integration with Airbnb/Booking.com APIs for auto-import of bookings
- Automated pricing (agent adjusts nightly rate based on demand)
- LPCLI integration — idle treasury funds earn yield via Meteora LP
- Dodo Payments integration — stablecoin checkout/billing for guest services (Solana Frontier hackathon, Dodo prize track: $5k/$3k/$2k)
