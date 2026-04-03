# Issue #022: x402 Payment Client

## Summary

Implement the x402 protocol client. This handles the HTTP 402 payment flow: server returns payment requirements, client pays via OWS wallet, then re-sends the request with the receipt. Used by plugins when calling real (non-mocked) service APIs.

## What needs to happen

### `src/x402.ts`

#### `payAndRequest(url: string, options: RequestOptions, wallet: WalletService): Promise<Response>`

1. Make initial HTTP request to service URL
2. If response is 402:
   - Parse `x-402-payment` header (base64 JSON)
   - Extract: chain, currency, amount, recipient, description
   - Call `wallet.payX402({ amount, currency, recipient, description })`
   - Get tx receipt
3. Re-send original request with `x-402-receipt: <base64 receipt>` header
4. Return the fulfilled response

#### Known gotcha (from lpcli work)

Node's HTTP rejects raw JSON in headers — must base64-encode the receipt.

### Mock mode

In mock mode, skip the actual x402 flow:
- Don't make the initial HTTP request
- Generate a mock receipt
- Return a mocked successful response

### Integration

Plugins call `payAndRequest()` instead of `fetch()` when hitting x402-gated endpoints. The wallet handles the actual payment.

## Acceptance criteria

- [ ] x402 flow works: request → 402 → pay → retry with receipt → success
- [ ] Base64 encoding of headers is handled correctly
- [ ] Mock mode skips real HTTP and wallet calls
- [ ] Error handling for: payment failure, invalid 402 response, service unavailable

---

## Discovered during build

_No entries yet._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/022-x402-client`

### Prerequisites

1. **Issue #021 merged** — wallet wrapper
2. **Read "x402 Protocol" section** of `docs/steward.md`
3. **Reference**: lpcli x402 implementation at https://github.com/bucketshop69/lpcli

### Assignee checklist

- [ ] I have read the "x402 Protocol" and "x402 Payment Flow" sections of `docs/steward.md`
- [ ] Issue #021 (wallet wrapper) is merged
- [ ] I understand the 402 → pay → receipt → retry flow
- [ ] I know about the base64 header encoding gotcha
