# Flutterwave v4 Integration Journey

## 1. The Problem

The Flutterwave developer dashboard for new accounts only provides **v4 OAuth 2.0 credentials** (Client ID, Client Secret, Encryption Key). Legacy v3 credentials (Public Key, Secret Key) are **not available** for newly created accounts — the v3→v4 migration is one-way with no documented reverse toggle.

This meant the standard v3 hosted checkout flow (`POST /v3/payments` with `FLWSECK_TEST` Bearer auth) was impossible, and we had to find a v4-compatible path.

---

## 2. Attempted Approaches (History of Blockers)

### Phase 1 — Initial v3 attempt (commit `ef78387`)

Wrote a simple v3 library using `https://api.flutterwave.com/v3` with a `FLWSECK_TEST` secret key. Two functions: `initiatePayment()` → `POST /v3/payments` for hosted checkout, and `verifyTransaction()` → `GET /v3/transactions/{id}/verify`.

**Result:** ❌ Failed — the account had no v3 keys, only v4 Client ID/Secret.

### Phase 2 — First v4 attempt: Customer → PaymentMethod → Charge (commit `fcd4aa2`)

Built a modular v4 library under `src/lib/server/flutterwave/`:
- OAuth 2.0 token acquisition via `https://idp.flutterwave.com/.../token`
- Correct v4 sandbox base URL: `https://developersandbox-api.flutterwave.com`
- Multi-step flow modeled after Stripe:
  1. `POST /customers` — create a customer
  2. `POST /payment-methods` — create a payment method (hardcoded to OPay)
  3. `POST /charges` — initiate a charge referencing both
  4. Extract redirect URL from `next_action.redirect_url`

**Result:** ❌ Problematic — the multi-step customer→payment-method→charge flow was brittle, and the payment method was locked to OPay only. No card/USSD/bank_transfer support.

### Phase 3 — Rollback to v3 (commit `3aaa7b1`)

Deleted the entire `src/lib/server/flutterwave/` directory and recreated a v3-style `src/lib/flutterwave.ts`. Same v3 endpoints (`https://api.flutterwave.com/v3`), same `FLWSECK_TEST` auth.

**Result:** ❌ Still no v3 keys available. This was a dead end.

### Phase 4 — Final v4 orchestrator integration (commit `be6d524`)

Discovered the **Orchestrator Direct Charges** API — a single-step v4 endpoint that accepts the full payment payload in one request:

```
POST /orchestration/direct-charges
```

This was the missing piece. Instead of creating customers and payment methods separately, the orchestrator accepts everything inline:
- Customer info (email + nested name object)
- Payment method (type: card/ussd/bank_transfer/opay + optional encrypted card details)
- Amount, currency, reference, redirect_url

**Result:** ✅ Success — single request, supports all payment methods, proper encryption for cards.

---

## 3. What Is the Orchestrator Flow?

The Flutterwave v4 Payment Orchestrator is a unified payment API that replaces the older multi-step charge flow. Key characteristics:

**Single request, multiple outcomes:**
```
POST /orchestration/direct-charges
  → Response contains:
    - charge.id (the charge identifier)
    - charge.status ("pending", "succeeded", "failed")
    - charge.next_action (tells the client what to do next)
      - redirect_url → browser redirect to 3DS/bank page
      - requires_pin → collect 4-digit PIN, POST /api/payments/authorize
      - requires_otp → collect 6-digit OTP, POST /api/payments/authorize
      - payment_instruction → show user the bank/USSD/OPay instructions
      - requires_additional_fields → additional data needed (not implemented)
```

**Authorization continuation:**
```
PUT /charges/{chargeId}
  Send { authorization: { type: "pin", pin: { nonce, encrypted_pin } } }
  or { authorization: { type: "otp", otp: { code } } }
  → Returns updated charge with next_action or final status
```

**Verification:**
```
GET /charges/{chargeId}
  → Returns full charge data including final status
```

The orchestrator eliminated the need for pre-creating customers or payment methods. Everything is handled in one request, with the `next_action` field driving the client-side state machine.

---

## 4. Final Build Process

### Architecture Overview

```
[Browser]
    |-- POST /api/payments/initiate   → Flutterwave /orchestration/direct-charges
    |-- POST /api/payments/authorize  → Flutterwave PUT /charges/{id}
    |-- POST /api/payments/verify     → Flutterwave GET /charges/{id}
    |-- POST /api/webhooks/flutterwave ← Flutterwave callback
```

### OAuth 2.0 Authentication

Flutterwave v4 uses OAuth 2.0 Client Credentials flow instead of v3 static API keys:

```
POST https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token
  body: client_id + client_secret + grant_type=client_credentials
  → returns short-lived access_token (Bearer auth for all v4 API calls)
```

Token is cached in-memory (`tokenCache`) with a 60s safety margin before expiry.

### API Endpoints

| Endpoint | Method | Flutterwave Target | Purpose |
|----------|--------|-------------------|---------|
| `/api/payments/initiate` | POST | `POST /orchestration/direct-charges` | Start a payment |
| `/api/payments/authorize` | POST | `PUT /charges/{chargeId}` | Continue with PIN/OTP/AVS |
| `/api/payments/verify` | POST | `GET /charges/{chargeId}` | Confirm status server-side |
| `/api/webhooks/flutterwave` | POST | (inbound) | Async charge.completed events |

### Payment Methods Supported

- **card** — requires encrypted card details (AES-256-GCM), supports PIN/OTP continuation
- **ussd** — returns payment_instruction with USSD code
- **bank_transfer** — returns payment_instruction with bank details
- **opay** — returns payment_instruction with OPay details

### Encryption Scheme (Card Payments)

```text
generateNonce() → 12-char alphanumeric string
encryptAES(plainText, nonce):
  1. Decode FLW_ENCRYPTION_KEY from Base64 → 256-bit key
  2. Create AES-256-GCM cipher with UTF-8 nonce as IV
  3. Concatenate ciphertext + auth tag → Base64 output

Card fields encrypted: pan, expiryMonth, expiryYear, cvv
PIN authorization: encrypted_pin using same scheme
OTP authorization: plaintext (sent directly)
```

### Database Schema (Prisma)

```prisma
model User {
  id          String   @id @default(cuid())
  fullName    String
  email       String   @unique
  password    String
  creatorSlug String   @unique
  avatar      String?
  bio         String?
  twitter     String?
  instagram   String?
  createdAt   DateTime @default(now())
  tips        Tip[]
}

model Tip {
  id                       String   @id @default(cuid())
  amount                   Int
  currency                 String   @default("NGN")
  supporterName            String?
  supporterEmail           String
  message                  String?
  transactionReference     String   @unique
  paymentMethod            String
  flwChargeId              String?
  flutterwaveTransactionId String?
  paymentStatus            String   @default("pending")
  creatorId                String
  creator                  User     @relation(fields: [creatorId], references: [id])
  createdAt                DateTime @default(now())
}
```

**Status flow:** `pending` → `verified` (only after server-side verification succeeds)

### Libraries

| File | Purpose |
|------|---------|
| `src/lib/flutterwave.ts` | Core v4 integration: OAuth token, AES encryption, charge/verify/update APIs |
| `src/lib/auth.ts` | Session management: create/delete/verify/getCurrentUser via JWT cookies |
| `src/lib/session.ts` | JWT encrypt/decrypt using `jose` (HS256, 7-day expiry) |
| `src/lib/prisma.ts` | Prisma client singleton (global cached for dev hot-reload) |
| `src/lib/slug.ts` | `generateSlug()` and `generateTxRef()` utilities |

### Frontend Tip Flow (`src/app/tip/[slug]/client.tsx`)

State machine (`PaymentState`):

1. **form** — name, email, amount (presets ₦500/1000/2000/5000 + custom), message
2. **selecting_method** — modal: Card / USSD / Bank Transfer / OPay
3. **card_form** — card number (formatted), expiry (MM/YY), CVV
4. **initiating** — POST to `/api/payments/initiate`
5. **pin** — 4-digit PIN modal (card only)
6. **otp** — 6-digit OTP modal
7. **authorizing** — POST to `/api/payments/authorize`
8. **instructions** — displays bank/USSD/OPay instructions from next_action
9. **verifying** — auto-redirects to `/tip/{slug}/success?tx_ref={ref}`
10. **success** — handled by `success/page.tsx`
11. **error** — inline error display

### Environment Variables

```
FLW_BASE_URL           # v4 API base URL (sandbox: https://developersandbox-api.flutterwave.com)
FLW_CLIENT_ID          # OAuth 2.0 Client ID (from Flutterwave dashboard)
FLW_CLIENT_SECRET      # OAuth 2.0 Client Secret
FLW_ENCRYPTION_KEY     # Base64-encoded 256-bit AES key
FLW_WEBHOOK_HASH       # Secret for verif-hash webhook validation
APP_URL                # Application origin (used for redirect_url)
NEXTAUTH_SECRET        # JWT signing secret (HS256)
DATABASE_URL           # Supabase PostgreSQL connection string
DIRECT_URL             # Direct connection for migrations
```

### Build & Deploy

```bash
# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate

# Apply database migrations
npx prisma migrate deploy

# Production build
npm run build    # runs prebuild (prisma generate) + next build

# Start production server
npm run start
```

**Verification checklist:**
- `npm run build` compiles without TypeScript or ESLint errors
- Prisma Client types are up to date with the schema
- All env vars are set in production (especially `FLW_WEBHOOK_HASH` — currently a placeholder)
- Database migrations are applied before starting the app
- Flutterwave webhook endpoint is registered in dashboard with correct `verif-hash`
