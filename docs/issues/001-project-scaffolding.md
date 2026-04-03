# Issue #001: Project Scaffolding

## Summary

Set up the full project structure for Steward — TypeScript config, folder layout, entry point, `.env` template, and all empty module stubs. This is the foundation every other issue builds on.

## What needs to happen

1. **tsconfig.json** — strict mode, ESM output, `src/` → `dist/`
2. **package.json** — update with all dependencies, scripts (`build`, `dev`, `start`), bin entry for `steward` CLI
3. **Folder structure** — create all directories from the spec:
   ```
   src/
   ├── index.ts              # Entry point — CLI parser
   ├── bot.ts                # Telegram bot (stub)
   ├── agent.ts              # Claude agent (stub)
   ├── wallet.ts             # OWS wallet wrapper (stub)
   ├── x402.ts               # x402 payment client (stub)
   ├── tools/
   │   ├── context.ts
   │   ├── property.ts
   │   ├── budget.ts
   │   ├── onboarding.ts
   │   └── escalate.ts
   ├── plugins/
   │   ├── registry.ts
   │   ├── food.ts
   │   ├── cleaning.ts
   │   ├── taxi.ts
   │   ├── tickets.ts
   │   └── maintenance.ts
   ├── store/
   │   ├── properties.ts
   │   ├── bookings.ts
   │   └── transactions.ts
   ├── cli/
   │   ├── init.ts
   │   ├── property.ts
   │   └── booking.ts
   └── types.ts
   ```
4. **`.env.example`** — template with all required env vars (no real values)
5. **`src/index.ts`** — minimal CLI entry point that parses commands (can use `commander` or raw `process.argv`)
6. **All stubs** — every file should export empty functions/interfaces with `// TODO: implement in issue #XXX` comments

## Acceptance criteria

- [ ] `npm run build` compiles with zero errors
- [ ] `npm run dev` starts the entry point via `tsx`
- [ ] Folder structure matches the spec
- [ ] `.env.example` has all env vars documented
- [ ] Every stub file exports its expected interface (even if empty)

---

## Discovered during build

> This section is maintained by the assignee during implementation. Document decisions, surprises, blockers, and anything the next person needs to know.

_No entries yet — assignee updates this as work progresses._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/001-project-scaffolding`

**Branch convention:** `feat/<issue-number>-<short-description>`

### Prerequisites for working on this issue

1. **Node.js >= 18** — required for native fetch and ESM
2. **npm** — package manager
3. **TypeScript** — `npm install -D typescript tsx @types/node`
4. **Clone the repo** — `git clone git@github.com:bucketshop69/steward.git && cd steward`
5. **Install deps** — `npm install`

### Assignee checklist (fill before starting)

- [ ] I have read `docs/steward.md` (the full spec)
- [ ] I have Node.js >= 18 installed
- [ ] I can run `npm install` successfully
- [ ] I understand this issue creates stubs only — no real implementation
