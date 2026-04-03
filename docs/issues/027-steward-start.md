# Issue #027: `steward start` + `steward start --mock` — Tie It All Together

## Summary

Implement the main `steward start` command that boots everything: loads config, initializes wallet, registers plugins, starts the Telegram bot, and connects the Claude agent. `--mock` flag enables mock mode for all plugins and wallet operations.

## What needs to happen

### `steward start` flow

1. Load `.env` config
2. Validate required env vars (bot token, API key)
3. Initialize wallet service (mock or real based on flag)
4. Register all plugins with mock flag
5. Initialize Claude agent with tools (context + plugins)
6. Start Telegram bot
7. Print startup message:
   ```
   🏠 Steward is running!
   Mode: mock
   Properties: 2 configured
   Active bookings: 1
   Wallet: steward-main (mock mode)
   
   Listening for messages...
   ```

### `--mock` flag

- Passed to wallet service → mock payments
- Passed to all plugins → mock responses
- Passed to x402 client → skip real HTTP

### Graceful shutdown

- Handle SIGINT/SIGTERM
- Stop Telegram bot polling
- Save any pending state
- Print shutdown message

### Wire into CLI

- `steward start` → production mode
- `steward start --mock` → demo/mock mode

## Acceptance criteria

- [ ] `steward start --mock` boots successfully with no external dependencies
- [ ] Bot connects to Telegram and receives messages
- [ ] Agent processes messages and responds
- [ ] All plugins are registered and callable
- [ ] Mock mode works end-to-end (guest message → agent → plugin → response)
- [ ] Graceful shutdown works
- [ ] Startup message shows correct status

---

## Discovered during build

_No entries yet._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/027-steward-start`

### Prerequisites

1. **ALL previous issues merged** — this is the integration issue
2. **A Telegram bot token** in `.env`
3. **An Anthropic API key** in `.env`
4. **At least one property and booking** configured

### Assignee checklist

- [ ] All issues #001-#026 are merged
- [ ] `.env` is configured with real bot token and API key
- [ ] At least one test property and booking exist
- [ ] I have a test Telegram group ready
