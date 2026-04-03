# Changelog

All notable changes to Steward are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- #001: Project scaffolding — folder structure, TypeScript config, CLI entry point, all module stubs
- #002: CONTRIBUTING.md and CHANGELOG.md — process documentation
- #021: OWS wallet wrapper — real wallet creation, USDC balance via RPC, mock mode with balance tracking
- #022: x402 payment client — full 402 → pay → receipt → retry flow, mock mode, local server e2e tests
- #023: Host takeover — host detection, @steward commands, pause/resume (implemented in #008)
- #024: Guest onboarding — welcome messages, identity confirmation via agent (implemented in #008/#009)
- #025: Booking lifecycle — check-in day welcome with property details, check-out day summary with spending breakdown, auto status transitions
- #026: Memory management — per-booking conversation persistence, memory snapshots, context window optimization
- #027: Steward start — wallet info in startup, lifecycle events on boot
