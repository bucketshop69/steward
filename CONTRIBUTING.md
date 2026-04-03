# Contributing to Steward

## How We Work

Steward is built issue-by-issue. Every piece of work has a GitHub issue and a matching local spec in `docs/issues/`. Human and AI contributors follow the same process.

## Branch Convention

```
feat/<issue-number>-<short-description>
```

Examples:
- `feat/003-types-and-data-model`
- `feat/008-telegram-bot-setup`
- `feat/016-plugin-food`

Always branch from `main`. Always PR back to `main`.

## Workflow

### 1. Pick an issue

- Check GitHub issues for open work
- Read the local spec: `docs/issues/<number>-<name>.md`
- Check prerequisites — don't start if upstream issues aren't merged

### 2. Fill the assignee checklist

Every issue has an "Assignee checklist" at the bottom. Fill it before writing code. This confirms you have the right context, dependencies, and environment.

### 3. Branch and build

```bash
git checkout main && git pull
git checkout -b feat/<issue-number>-<short-description>
npm install
npm run build   # verify clean build before starting
```

### 4. Implement

- Follow the issue spec — it describes what to build and the acceptance criteria
- Keep commits focused and reference the issue: `#004: implement property CRUD`
- Run `npm run build` frequently — keep the build green

### 5. Update "Discovered during build"

Every issue has a "Discovered during build" table. As you work, document:
- Decisions you made that weren't in the spec
- Surprises or gotchas
- Blockers and how you resolved them
- Anything the next person needs to know

This is mandatory. It's how we learn across issues.

### 6. PR and merge

```bash
git push -u origin feat/<issue-number>-<short-description>
gh pr create --title "#<number>: <short title>" --body "..."
```

- One PR per issue
- Link the PR to the GitHub issue (`Closes #<number>`)
- PR description: summary of what changed + test plan
- Merge to `main` after review

### 7. Update CHANGELOG

After merge, add an entry to `CHANGELOG.md` under `[Unreleased]`.

## Commit Messages

Format: `#<issue>: <what changed>`

```
#001: scaffold project structure
#004: implement property CRUD with JSON store
#009: add Claude agent with tool use loop
```

Keep them short. The issue has the context.

## Code Style

- **TypeScript strict mode** — no implicit any, strict null checks
- **ESM** — `import/export`, `.js` extensions in imports
- **No `any` types** — use `unknown` if you must, but prefer proper types
- **Descriptive names** — `getPropertyByGroupId` not `getProp`
- **No unnecessary comments** — code should be self-explanatory. Use comments for "why", not "what"
- **Unused parameters** — prefix with `_` (e.g., `_options`)

## Agent Contributors

AI agents follow the exact same process:
1. Read the issue spec
2. Check prerequisites
3. Branch, implement, commit, PR
4. Fill "Discovered during build"
5. Reference the issue number in all commits

Agents should not:
- Skip the assignee checklist
- Implement beyond the issue scope
- Merge without review (unless explicitly told to)

## Environment Setup

```bash
# Clone
git clone git@github.com:bucketshop69/steward.git
cd steward

# Install
npm install

# Configure (first time)
cp .env.example .env
# Fill in your keys

# Build
npm run build

# Dev mode (auto-reload)
npm run dev
```

### Required

- Node.js >= 18
- npm
- Git

### Optional (for specific issues)

- Telegram bot token (from @BotFather) — issues #005, #008+
- Anthropic API key — issues #005, #009+
- OWS CLI — issues #021, #022
