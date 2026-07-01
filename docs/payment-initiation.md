# Payment Initiation Failure — Investigation Report

## Symptom

`POST /api/payments/initiate` returns HTTP 500 with the message "Payment initiation failed" when called from the tip form.

## Root Causes

### Cause 1: Wrong Base URL

**Before (broken):**

```ts
const BASE_URL = "https://api.flutterwave.com"
```

**Why it fails:**

`https://api.flutterwave.com` was the v3 API base URL. The Flutterwave v4 Environments documentation defines two valid base URLs:

| Environment | Base URL |
|-------------|----------|
| Sandbox (test) | `https://developersandbox-api.flutterwave.com` |
| Production (live) | `https://f4bexperience.flutterwave.com` |

Since our `.env` contains sandbox credentials (Client ID/Secret from `developersandbox.flutterwave.com`), requests must go through the sandbox URL. Pointing at the old v3 URL caused all v4 orchestrator requests to fail.

**Fix:**

```ts
const BASE_URL = process.env.FLW_BASE_URL ?? "https://developersandbox-api.flutterwave.com"
```

Added `FLW_BASE_URL=https://developersandbox-api.flutterwave.com` to `.env`.

**Reference:** https://developer.flutterwave.com/docs/environments

---

### Cause 2: Wrong Customer Name Format

**Before (broken):**

```ts
customer: {
  email: supporterEmail,
  name: supporterName || undefined,   // flat string — WRONG
}
```

**Why it fails:**

The Flutterwave v4 orchestrator API expects `customer.name` to be a **nested object** with `first` and `last` fields, not a flat string. Every curl example in the official docs uses this structure:

```json
"customer": {
  "name": {
    "first": "King",
    "last": "James"
  },
  "email": "user@example.com"
}
```

Sending `name: "Supporter Name"` causes a validation/parsing error on Flutterwave's side.

**Fix:**

```ts
const nameParts = (supporterName || "Anonymous").trim().split(/\s+/)
const customerName = {
  first: nameParts[0] || "Anonymous",
  last: nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined,
}

customer: {
  email: supporterEmail,
  name: customerName,
}
```

**Reference:** https://developer.flutterwave.com/docs/payment-orchestrator-flow

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/flutterwave.ts:6-9` | `BASE_URL` now reads `FLW_BASE_URL` env var, defaults to sandbox URL |
| `src/lib/flutterwave.ts:97-101` | `InitiateOrchestratorParams.customer.name` type changed from `string` to `{ first: string; last?: string }` |
| `src/app/api/payments/initiate/route.ts` | Customer name split into `{ first, last }` object before sending |
| `.env` | Added `FLW_BASE_URL` variable |

## Verification

- Build passes: `npx next build` — compiled successfully, no TypeScript errors
- All routes compile (including the new `/api/payments/authorize`)

---

### Cause 3: Card Object Required When `payment_method.type` is `"card"`

**Error:**

```
"validation_errors":[{"field_name":"payment_method.card","message":"must not be null"}]
```

**Why it fails:**

The Flutterwave v4 orchestrator API requires the `payment_method.card` sub-object to be present when `type` is `"card"`. Sending just `{ type: "card" }` without a `card` object causes a validation error.

The card object must contain encrypted card details:

```json
"payment_method": {
  "type": "card",
  "card": {
    "nonce": "12charNonce",
    "encrypted_card_number": "...",
    "encrypted_expiry_month": "...",
    "encrypted_expiry_year": "...",
    "encrypted_cvv": "..."
  }
}
```

Each field is AES-256-GCM encrypted using Flutterwave's encryption key.

**Fix:**

1. **Frontend** (`src/app/tip/[slug]/client.tsx`): When user selects "Card" in the payment modal, a card details form is shown instead of immediately initiating. Collects card number, expiry month/year, CVV.

2. **Backend** (`src/app/api/payments/initiate/route.ts`): Accepts optional `cardDetails` in the request body. When method is `card`, encrypts each field using `encryptCardDetails()` and includes the encrypted card object in the payment_method payload.

3. **Library** (`src/lib/flutterwave.ts`):
   - Added `CardDetails` type for raw card input
   - Added `encryptCardDetails()` helper that generates a nonce and encrypts all card fields
   - Updated `InitiateOrchestratorParams.payment_method` to include optional `card` sub-object

**Flow for card payments:**
```
Select "Card" in modal → Card details form → POST /api/payments/initiate with encrypted card data → Handle next_action
```

**Flow for non-card payments (unchanged):**
```
Select method in modal → POST /api/payments/initiate (no card data) → Handle next_action
```

**Reference:** https://developer.flutterwave.com/docs/encryption

---

## Updated Files Changed (all three fixes)

| File | Change |
|------|--------|
| `src/lib/flutterwave.ts:6-9` | `BASE_URL` now reads `FLW_BASE_URL` env var, defaults to sandbox URL |
| `src/lib/flutterwave.ts:95-129` | `InitiateOrchestratorParams` updated with nested customer name + optional card object; `encryptCardDetails()` helper added |
| `src/app/api/payments/initiate/route.ts` | Customer name split into `{ first, last }`; accepts `cardDetails` and encrypts for card payments |
| `src/app/tip/[slug]/client.tsx` | Card details form added between method selection and initiation for card payments |
| `.env` | Added `FLW_BASE_URL` variable |

## Verification

- Build passes: `npx next build` — compiled successfully, no TypeScript errors
- All routes compile: `/api/payments/initiate`, `/api/payments/authorize`, `/api/payments/verify`, `/api/webhooks/flutterwave`

## Prevention

1. When integrating with a new API version, always verify the base URL from the Environments docs — never assume the old URL carries over.
2. Compare request body shapes against official curl examples line-by-line before writing application code.
3. Check that all nested required objects in the API schema are present — not just the parent type discriminator.
