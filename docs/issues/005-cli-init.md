# Issue #005: `steward init` — First-Time Setup

## Summary

Implement the `steward init` command that walks the user through first-time configuration: Telegram bot token, Anthropic API key, OWS wallet name, Solana RPC URL, and default budget settings. Saves to `.env` file.

## What needs to happen

### `src/cli/init.ts`

Interactive prompts (use `readline` or a small lib like `inquirer`):

```
🏗️  Steward Setup

Telegram Bot Token (from @BotFather): ___
Anthropic API Key: ___
OWS Wallet Name [steward-main]: ___
Solana RPC URL (optional, press enter to skip): ___
Default Daily Budget (USDC) [200]: ___
Default Per-Transaction Limit (USDC) [100]: ___
```

### Behavior

1. Check if `.env` already exists → warn "Config already exists. Overwrite? (y/N)"
2. Validate inputs:
   - Bot token format check (numeric:alphanumeric)
   - API key starts with `sk-ant-`
   - Budget values are positive numbers
3. Write `.env` file with all values
4. Create `data/` directory if it doesn't exist
5. Print success message with next steps:
   ```
   ✅ Steward configured!
   
   Next steps:
     steward property add    — add your first property
     steward start --mock    — start in demo mode
   ```

### Wire into CLI

`src/index.ts` should route `steward init` → this handler.

## Acceptance criteria

- [ ] `steward init` runs interactive prompts
- [ ] `.env` file is created with correct values
- [ ] Existing `.env` is not silently overwritten
- [ ] Input validation works for bot token and API key formats
- [ ] `data/` directory is created
- [ ] Success message shows next steps

---

## Discovered during build

> This section is maintained by the assignee during implementation. Document decisions, surprises, blockers, and anything the next person needs to know.

_No entries yet — assignee updates this as work progresses._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/005-cli-init`

**Branch convention:** `feat/<issue-number>-<short-description>`

### Prerequisites for working on this issue

1. **Issue #001 merged** — project scaffolding with CLI entry point
2. **A Telegram bot token** — create one via @BotFather for testing
3. **An Anthropic API key** — for validation testing

### Assignee checklist (fill before starting)

- [ ] I have read the CLI Commands + Environment Variables sections of `docs/steward.md`
- [ ] Issue #001 (scaffolding) is merged
- [ ] I have a test Telegram bot token from @BotFather
- [ ] I understand the `.env` format and all required variables
