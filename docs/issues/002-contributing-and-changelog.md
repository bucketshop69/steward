# Issue #002: CONTRIBUTING.md + CHANGELOG.md

## Summary

Set up the project's process documentation — how we contribute, how we track changes, and the conventions we follow. This ensures every contributor (human or agent) works the same way.

## What needs to happen

### CONTRIBUTING.md

Document the following:

1. **Branch convention** — `feat/<issue-number>-<short-description>` (e.g., `feat/003-types-data-model`)
2. **Issue workflow** — each issue has a local `docs/issues/XXX-*.md` file AND a GitHub issue. Work is tracked in both.
3. **Commit messages** — concise, prefixed with issue number: `#001: scaffold project structure`
4. **PR process** — one PR per issue, linked to the GitHub issue, reviewed before merge
5. **Agent workflow** — agents work on one issue at a time, follow the same branch/commit conventions
6. **"Discovered during build"** — every issue has this section. Assignee fills it with decisions, surprises, blockers found during implementation.
7. **Assignee checklist** — before starting an issue, fill in the prerequisites checklist in the issue doc
8. **Code style** — TypeScript strict mode, ESM, no `any` types, descriptive names

### CHANGELOG.md

- Start with `## [Unreleased]` section
- Format: [Keep a Changelog](https://keepachangelog.com/) style
- Categories: Added, Changed, Fixed, Removed
- Each entry references the issue number

## Acceptance criteria

- [ ] `CONTRIBUTING.md` exists at repo root with all sections above
- [ ] `CHANGELOG.md` exists at repo root with `[Unreleased]` section
- [ ] Both files are clear enough that a new contributor (or agent) can start working immediately

---

## Discovered during build

> This section is maintained by the assignee during implementation. Document decisions, surprises, blockers, and anything the next person needs to know.

_No entries yet — assignee updates this as work progresses._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/002-contributing-and-changelog`

**Branch convention:** `feat/<issue-number>-<short-description>`

### Prerequisites for working on this issue

1. **Read `docs/steward.md`** — understand the project scope
2. **Read the reference issue format** — [lpcli#1](https://github.com/bucketshop69/lpcli/issues/1) for style reference
3. **Familiar with Keep a Changelog format** — https://keepachangelog.com/

### Assignee checklist (fill before starting)

- [ ] I have read `docs/steward.md`
- [ ] I have read the lpcli reference issue for style conventions
- [ ] I understand the branch naming convention
