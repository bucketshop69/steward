# Issue #021: OWS Wallet Wrapper — Create, Balance, Pay

## Summary

Implement the wallet service layer wrapping OWS. Handles wallet creation, balance checks, and payments. In mock mode, simulates all wallet operations without touching the chain.

## What needs to happen

### `src/wallet.ts`

Implement the `WalletService` interface:

#### `getBalance(): Promise<number>`

- Real: call `ows fund balance --wallet <name>` or use OWS SDK
- Mock: return a simulated balance (e.g., 1000 USDC)

#### `payX402(params): Promise<{ tx: string }>`

- Real: use OWS to sign and send a Solana USDC transfer
- Mock: generate a mock tx signature and deduct from simulated balance
- Always log the transaction via store

#### `createWallet(name: string): Promise<void>`

- Real: `ows wallet create --name <name>`
- Mock: no-op, log creation

### Mock mode

When `--mock` is set:
- All wallet operations succeed
- Balance starts at 1000 USDC
- Payments deduct from in-memory balance
- Tx signatures are `mock_pay_<timestamp>_<random>`

### Real mode (post-hackathon priority)

- Use `@open-wallet-standard/core` for wallet operations
- OWS policy engine enforces spending limits as a second layer
- Solana USDC transfers via OWS signing

## Acceptance criteria

- [ ] Mock mode: all operations work without any chain/wallet dependency
- [ ] `payX402` returns a tx signature (mock or real)
- [ ] Balance tracking works in mock mode
- [ ] WalletService interface is fully implemented
- [ ] Can switch between mock and real via flag

---

## Discovered during build

_No entries yet._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/021-wallet-wrapper`

### Prerequisites

1. **Issue #003 merged** — WalletService type
2. **OWS docs** — https://docs.openwallet.sh/doc.html?slug=quickstart
3. **For real mode testing**: OWS CLI installed, wallet created, funded on devnet

### Assignee checklist

- [ ] I have read the "OWS + x402 Integration" section of `docs/steward.md`
- [ ] Issue #003 (types) is merged
- [ ] I understand mock vs real mode distinction
- [ ] (Optional) I have OWS CLI installed for real mode testing
