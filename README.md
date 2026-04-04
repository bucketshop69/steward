# Steward — "Steward can manage anything"

> Your guests text at 3am asking where the WiFi password is. Your cleaner no-shows. A pipe leaks. You're juggling 5 different apps — Airbnb messaging, WhatsApp, food delivery, cleaning service, taxi. And your guest? They're doing the same thing on the other side — downloading local apps, figuring out how to pay, searching for restaurants they can't read the menu of.
>
> **What if neither of you had to do any of that?**

Steward is an autonomous AI agent that runs your entire property — built on [Open Wallet Standard (OWS)](https://github.com/nicholasgriffintn/open-wallet-standard) for payments. It lives in a single Telegram group with your guests. They ask for anything — food, taxi, tickets, cleaning — and Steward handles it end-to-end: finds the service, quotes the price, collects USDC payment, and fulfills the order. All through x402 micropayments from an OWS wallet on Solana.

One group. One agent. One wallet. One hundred properties. It never sleeps.

## See It In Action

```text
┌──────────────────────────────────────────────────────────┐
│  Telegram Group: "Beach House - Apr 10"                  │
│                                                          │
│  👤 John:      Can you order dinner? Thai for 2,         │
│                no peanuts                                 │
│                                                          │
│  🤖 Steward:   Pad Thai + Green Curry for 2 (no peanuts) │
│                Total: $32 USDC                           │
│                Send to: 5eykt...7Kdp                     │
│                                                          │
│  👤 John:      Sent!                                     │
│                                                          │
│  🤖 Steward:   Payment confirmed on-chain. Order placed! │
│                Arriving in ~30 min. 🍜                   │
│                                                          │
│  🏠 Host:      (sees everything, didn't lift a finger)   │
└──────────────────────────────────────────────────────────┘
```

No app to download. No local currency to figure out. No restaurant menu to decode. The guest just texts what they want, pays in USDC, and it happens.

## Why OWS + x402

This is the core of Steward — not just another chatbot, but an **agent with a wallet**.

**For the host:**
- No payment processing setup, no merchant accounts, no invoicing
- OWS wallet holds USDC on Solana with built-in policy engine (spend limits, chain allowlists)
- Every service payment flows through x402 — one protocol for food, cleaning, taxi, everything
- Full transaction log per property, per booking — transparent and auditable

**For the guest:**
- No downloading 5 local apps in a foreign country
- No fumbling with local currency or card declines abroad
- Just text what you need in the group → pay USDC → done
- One conversation replaces: food delivery app + taxi app + concierge phone + Google Maps + host messaging

**The x402 payment flow:**
```text
Guest: "Order pizza for 2"
  → Steward calls order_food plugin → gets $32 quote
  → Steward: "$32 USDC. Send to: 5eykt...7Kdp"
  → Guest sends USDC on Solana
  → Guest: "Sent!"
  → Steward calls check_payment → verified on-chain
  → Steward: "Order placed! Arriving in ~30 min."
```

Every plugin speaks x402. Add a new service? Same wallet, same payment protocol, same agent. In `--mock` mode, payments auto-confirm with simulated tx signatures for demos.

## What Steward Handles

| Service | How it works |
| --- | --- |
| Check-in & property info | WiFi, door codes, house rules, amenities — instant answers |
| Food delivery | Orders food, respects dietary preferences, quotes price |
| Taxi & transport | Books rides to any destination |
| Cleaning | Schedules standard or deep cleans between guests |
| Event tickets | Books tours, activities, local attractions |
| Maintenance | Troubleshoots first ("try the reset button"), escalates if needed |
| Guest onboarding | Auto-links guests on group join, instant check-in info |

All services are plugins with the same interface. Swap mock for real APIs without changing agent code.

## The Host Takeover

This is what makes Steward practical, not just a demo.

When the host types in the group, the agent goes quiet. No interruptions. The host is in charge. When they're done, `@steward handle this` brings the agent back.

```text
👤 Guest:    The AC isn't working
🤖 Steward:  Have you tried the reset button on the unit?
👤 Guest:    Yes, still broken
🤖 Steward:  ⚠️ @host — AC issue. Guest tried reset. Needs maintenance.
🏠 Host:     I'll send someone in an hour
              (agent stays quiet — host is handling it)
```

| Host command | Effect |
| --- | --- |
| `@steward handle this` | Resume agent |
| `@steward stop` | Pause agent in this group |
| `@steward summary` | Booking + spending summary |
| `@steward budget` | Today's spending |
| *(just type normally)* | Agent stays quiet |

## Quick Start

```bash
npm install && npm run build

npx tsx src/index.ts init          # Bot token, API key, Telegram ID, wallet
npx tsx src/index.ts start --mock  # Launch (mock payments for demo)
```

That's it. Two commands. Everything else happens in Telegram.

### Host DM Mode

After starting the bot, DM it directly on Telegram to manage your properties:

```text
You: "Add a property called Beach House at 123 Ocean Dr,
      door code 4521, wifi BeachLife/sunny123, no smoking"
Bot: "What's the Telegram group ID?"
You: "-1001234567890"
Bot: "Beach House saved. Add the bot to that group."

You: "Book John Smith at Beach House, April 10-15, vegetarian"
Bot: "Booking created. Send the group invite link to John."

You: "What's the status?"
Bot: "1 property, 1 active booking. Wallet: 450 USDC."
```

The bot only responds to DMs from the Telegram ID set during `steward init`. CLI commands (`steward property add`, `steward booking add`) still work as a fallback.

### Environment Variables

```bash
TELEGRAM_BOT_TOKEN=           # From @BotFather
AGENT_API_KEY=                # MiniMax / Anthropic / OpenAI-compatible
HELIUS_RPC_URL=               # Solana RPC (optional, for balance checks)
OWS_WALLET_NAME=steward-main  # OWS wallet name
```

## Architecture

```text
Host DM ──→ Host Agent (add property, booking, status)
                │
             Store (steward.json)
                │
Telegram Group ──→ Guest Agent (MiniMax M2.7)
    │                  │
    ▼          ┌───────┼───────┐
Grammy Bot     │       │       │
           Context   Action   Plugins
           Tools     Tools    (food, taxi, clean...)
              │       │       │
           Store   Escalate  OWS Wallet ← x402 payments
          (JSON)   to Host   (USDC on Solana)
```

**Stack**: TypeScript, Grammy (Telegram), MiniMax M2.7, OWS, Solana/USDC, x402

<details>
<summary>Project Structure</summary>

```text
steward/
├── src/
│   ├── index.ts              # CLI entry point + .env loader
│   ├── bot.ts                # Telegram handler (groups + host DMs)
│   ├── agent.ts              # Guest-facing LLM agent with tool use
│   ├── host-agent.ts         # Host-facing LLM agent (property/booking mgmt)
│   ├── minimax.ts            # Anthropic-compatible API client
│   ├── wallet.ts             # OWS wallet (create, balance, pay)
│   ├── x402.ts               # x402 payment protocol
│   ├── lifecycle.ts          # Check-in/check-out automation (15-min timer)
│   ├── memory.ts             # Conversation persistence
│   ├── types.ts
│   ├── tools/                # Context + action + host tools
│   ├── plugins/              # Service plugins (food, taxi, etc.)
│   ├── store/                # JSON-backed CRUD (steward.json)
│   └── cli/                  # steward init/property/booking
├── data/                     # Local JSON storage
└── tests/                    # 271 tests across 13 files
```

</details>

## Built for OWS Hackathon

**Track 01 — Agentic Storefronts & Real-World Commerce**

The agent IS the business. It holds an OWS wallet, pays suppliers via x402, serves guests, and runs properties autonomously. The host sets policies and watches. The guest just texts.

- OWS wallet with USDC on Solana — real key custody, real policy engine
- x402 micropayments — every service plugin pays over HTTP, one protocol
- One agent scales to 100 properties with zero additional staff
- Guest doesn't need local apps, local currency, or a concierge — just Telegram and USDC

## License

MIT
