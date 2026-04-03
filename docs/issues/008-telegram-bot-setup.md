# Issue #008: Telegram Bot Setup — grammy, Group Handler, Host Detection

## Summary

Set up the Telegram bot using grammy. Handle group messages, detect who's talking (host vs guest vs unknown), and implement the core message routing: host messages → agent stays quiet, guest messages → agent processes, @steward mentions → agent executes command.

## What needs to happen

### `src/bot.ts`

1. **Bot initialization** — create grammy bot instance with token from `.env`
2. **Group message handler** — listen for all text messages in groups
3. **Message routing logic**:
   ```
   Message arrives in group
     ├─ From host? → Stay quiet (unless @steward mentioned)
     ├─ From guest? → Forward to agent for processing
     └─ From unknown? → Could be new guest, trigger onboarding check
   ```
4. **Host detection** — compare `ctx.from.id` against `property.hostTelegramId`
5. **New member detection** — listen for `message:new_chat_members` event for guest onboarding
6. **Group creation helper** — function to create a Telegram group for a booking and generate an invite link (called from booking CLI or on demand)
7. **Bot commands**:
   - `/start` — basic info when bot is added to a group
   - `/help` — list what the bot can do

### Integration points

- Calls store functions to look up property by group ID
- Calls store functions to identify user
- Forwards guest messages to the agent (issue #009)
- The bot is the I/O layer — it receives messages and sends responses

## Acceptance criteria

- [ ] Bot starts and connects to Telegram
- [ ] Bot receives messages in groups
- [ ] Host messages are detected and ignored (agent stays quiet)
- [ ] @steward mentions from host are detected and routed
- [ ] New member joins are detected
- [ ] Invite link generation works
- [ ] Bot handles errors gracefully (doesn't crash on bad messages)

---

## Discovered during build

> This section is maintained by the assignee during implementation. Document decisions, surprises, blockers, and anything the next person needs to know.

_No entries yet — assignee updates this as work progresses._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/008-telegram-bot-setup`

**Branch convention:** `feat/<issue-number>-<short-description>`

### Prerequisites for working on this issue

1. **Issue #004 merged** — JSON store (need property lookups)
2. **A Telegram bot token** — create via @BotFather
3. **grammy docs** — https://grammy.dev/
4. **A test Telegram group** — create manually for testing
5. **Know your Telegram user ID** — you'll use this as the host ID

### Assignee checklist (fill before starting)

- [ ] I have read the "How Messages Flow" and "Host Takeover" sections of `docs/steward.md`
- [ ] I have a Telegram bot token from @BotFather
- [ ] I have created a test Telegram group and added the bot
- [ ] I know my Telegram user ID (host ID for testing)
- [ ] I have read the grammy quickstart guide
- [ ] Issue #004 (JSON store) is merged
