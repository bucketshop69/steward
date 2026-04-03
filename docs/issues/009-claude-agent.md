# Issue #009: Claude Agent — System Prompt, Tool Use Loop, Conversation Handling

## Summary

Implement the Claude agent that powers Steward's reasoning. Uses `@anthropic-ai/sdk` with tool use. The agent receives a guest message + context, reasons about what tools to call, executes them, and returns a response. This is the brain of Steward.

## What needs to happen

### `src/agent.ts`

1. **System prompt** — define the Steward persona:
   ```
   You are Steward, an AI property host assistant. You manage short-term rental 
   properties via Telegram groups. You help guests with check-in, local info, 
   food orders, transport, cleaning, and anything else they need.
   
   You have access to tools to look up property info, check budgets, order 
   services, and escalate to the host. Always be friendly, helpful, and concise.
   
   Rules:
   - Always check the budget before ordering services
   - If a request exceeds the budget, tell the guest and escalate to the host
   - For maintenance issues, try simple troubleshooting first, then escalate
   - Never share sensitive info (WiFi passwords) in responses — use the 
     check-in info tool which the guest already received
   - Be concise — this is a chat, not an email
   ```

2. **Tool definitions** — register all tools as Claude tool schemas:
   - Context tools (get_property_by_group, identify_user, get_booking)
   - Property tools (get_property_info)
   - Budget tools (check_budget, get_transaction_history)
   - Onboarding tools (link_guest)
   - Escalation tools (escalate_to_host)
   - Plugin tools (order_food, book_cleaning, book_taxi, book_tickets)

3. **Message processing loop**:
   ```
   receive guest message
   → build messages array (system + history + new message)
   → call Claude API with tools
   → if tool_use → execute tool → feed result back → loop
   → if text response → return to bot for sending
   ```

4. **Conversation history** — maintain per-group message history (in-memory map, keyed by group ID)

5. **Tool execution** — dispatch tool calls to the actual tool implementations

### Key design decisions

- History is in-memory (lost on restart) — fine for MVP. Issue #025 handles persistence.
- Each group has its own conversation history
- Tool results are fed back into the conversation for Claude to reason about
- Max tool call depth: 10 (prevent infinite loops)

## Acceptance criteria

- [ ] Agent processes a message and returns a text response
- [ ] Tool use loop works — agent calls tools and reasons about results
- [ ] Conversation history is maintained per group
- [ ] System prompt establishes Steward persona correctly
- [ ] All tool schemas are defined and match the actual tool implementations
- [ ] Error handling — bad tool calls don't crash the agent

---

## Discovered during build

> This section is maintained by the assignee during implementation. Document decisions, surprises, blockers, and anything the next person needs to know.

_No entries yet — assignee updates this as work progresses._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/009-claude-agent`

**Branch convention:** `feat/<issue-number>-<short-description>`

### Prerequisites for working on this issue

1. **Issue #003 merged** — types defined
2. **Issue #004 merged** — store layer exists
3. **An Anthropic API key** — needed for testing
4. **Familiarity with Claude tool use** — https://docs.anthropic.com/en/docs/build-with-claude/tool-use
5. **`@anthropic-ai/sdk`** — already in package.json

### Assignee checklist (fill before starting)

- [ ] I have read the "Agent Context Discovery" and "Agent Reasoning Flow" sections of `docs/steward.md`
- [ ] I have an Anthropic API key set in `.env`
- [ ] I understand Claude's tool use API (tool definitions, tool_use blocks, tool_result blocks)
- [ ] Issues #003 and #004 are merged
- [ ] I understand the conversation history model (per-group, in-memory)
