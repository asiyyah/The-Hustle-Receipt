# Codebase Audit

> [!NOTE]
> This report captures the repository at the time of the initial audit. A remediation pass subsequently addressed the fallback session secret, unsigned webhook handling, public supporter-email exposure, Paystack ID overflow, migration drift, truncated dashboard totals, weak request validation, provider timeouts, obsolete dependencies/assets, and several accessibility issues. Findings remain below as an historical audit record; creator payout architecture, durable distributed rate limiting, automated integration tests, and some frontend refactoring still require separate product or infrastructure work.

## Executive summary

The codebase is a compact Next.js 16 tipping platform. Its core structure is understandable and TypeScript-clean, but it is not production-ready yet. The largest risks are:

1. A known, constant fallback JWT secret makes sessions forgeable when `NEXTAUTH_SECRET` is absent.
2. The Paystack webhook does not validate its signature.
3. Public endpoints expose supporter email addresses.
4. Prisma migrations do not match the current schema.
5. Dashboard totals only cover the most recent 100 payments.
6. The product receives money into one Paystack account; it does not currently pay creators directly.

This audit was performed as a read-only review. No application files were changed during the audit.

## Architecture and flow

The application consists of:

- Next.js 16.2.9 App Router with React 19 and Tailwind 4.
- Prisma 5/PostgreSQL for `User` and `Tip` records.
- Custom bcrypt registration/login.
- Seven-day JWT sessions stored in an HTTP-only cookie.
- Public creator pages under `/tip/[slug]`.
- Paystack hosted-checkout initiation.
- Browser-driven callback verification plus a webhook verification path.
- A React Query-based creator dashboard.

The payment flow is:

```text
Tip page
  -> POST /api/payments/initiate
  -> Paystack hosted checkout
  -> callback /tip/[slug]/success
  -> POST /api/payments/verify
  -> Tip marked "verified"

Paystack webhook
  -> POST /api/webhooks/paystack
  -> Paystack verify API
  -> Tip marked "verified"
```

The Next.js 16-specific implementation is generally correct: asynchronous `params` and `cookies()` are awaited correctly, and Route Handlers use supported conventions.

## Critical and high-priority findings

### 1. Sessions use a public fallback secret

`src/lib/session.ts:4` falls back to:

```ts
"fallback-secret-change-me"
```

The current `.env` has no `NEXTAUTH_SECRET`. Anyone who knows the fallback can create a valid HS256 token containing an arbitrary user ID and impersonate that user.

This should fail at startup when the secret is absent rather than silently use a default.

### 2. Webhook signatures are not verified

The webhook merely checks that `x-paystack-signature` is non-empty at `src/app/api/webhooks/paystack/route.ts:7`. The correct HMAC verifier already exists at `src/lib/paystack.ts:109` but is never called.

A forged webhook cannot directly manufacture a successful Paystack transaction because the handler re-verifies with Paystack. However, it can:

- Trigger unrestricted Paystack verification requests.
- Cause database lookups and log noise.
- Abuse API quota/resources.
- Reach code intended only for trusted Paystack events.

Use constant-time signature comparison as well; the current helper uses ordinary string equality at `src/lib/paystack.ts:121`.

### 3. Public supporter email disclosure

The unauthenticated recent-tips endpoint returns `supporterEmail` at `src/app/api/tips/recent/route.ts:20`. Anyone can supply a creator slug and retrieve up to 50 supporters' email addresses.

The unauthenticated verification route also returns the complete `Tip` object, including email, at `src/app/api/payments/verify/route.ts:43` and `src/app/api/payments/verify/route.ts:75`.

These responses should use explicit safe projections. The recent-tips route appears unused and could simply be removed.

### 4. Database migrations and Prisma schema disagree

The current schema expects `paystackReference` and `paystackTransactionId` at `prisma/schema.prisma:34`.

The checked-in migrations instead create obsolete Flutterwave columns:

- `flutterwaveTransactionId` at `prisma/migrations/20260630123450_init_supabase/migration.sql:26`.
- `flwChargeId` at `prisma/migrations/20260701105401_add_orchestrator_fields/migration.sql:8`.

There is no migration creating the Paystack columns. A database built solely from these migrations will fail when verification attempts to update those fields.

### 5. Dashboard totals are incorrect after 100 tips

The dashboard fetches only 100 verified tips at `src/app/api/dashboard/stats/route.ts:19`, then calculates total revenue and averages from that truncated list at `src/app/api/dashboard/stats/route.ts:25`.

Consequences:

- "Total earned" stops being lifetime revenue.
- "Supporters" is capped at 100.
- "Average tip" only covers recent records.

Use Prisma aggregation for totals and a separate limited query for recent tips. Also, `totalSupporters` currently means "number of tips," not unique supporters.

### 6. There is no creator payout architecture

All transactions are initialized against one server-side `PAYSTACK_SECRET_KEY` at `src/lib/paystack.ts:4`. Users have no Paystack subaccount, recipient code, bank details, split configuration, transfer records, or balance ledger.

Therefore, funds settle into the platform's Paystack account. Claims such as "support creators directly" and "no middlemen" in `src/app/page.tsx:34` do not match the implementation.

## Medium-priority correctness and security issues

### Input validation is insufficient

The APIs destructure untrusted JSON without schema validation:

- `src/app/api/auth/register/route.ts:9`
- `src/app/api/auth/login/route.ts:8`
- `src/app/api/payments/initiate/route.ts:8`
- `src/app/api/payments/verify/route.ts:7`

Notably:

- Amount is not required to be a finite integer.
- No maximum tip is enforced.
- Email is not server-validated.
- Names/messages have no length limits.
- `paymentMethod` accepts arbitrary content even though the UI always sends `"card"`.
- A malformed JSON body becomes a generic 500 rather than a 400.
- Very large values may exceed Prisma/Postgres `Int` limits.

### Email normalization is absent

Registration and login use the supplied email exactly at `src/app/api/auth/register/route.ts:25` and `src/app/api/auth/login/route.ts:17`.

Leading spaces or case differences can create duplicate logical identities or prevent login. Normalize with `trim().toLowerCase()` before lookup/storage and enforce the same invariant at the database/application boundary.

### Registration has race conditions and slug edge cases

Slug availability is checked repeatedly before insertion at `src/app/api/auth/register/route.ts:36`. Concurrent registrations can choose the same slug, after which one returns a generic 500.

Names containing no ASCII alphanumeric characters produce an empty slug at `src/lib/slug.ts:1`. Names such as emoji-only or non-Latin-only names can therefore become `""`, `"-1"`, etc.

The endpoint also performs one database round trip for every collision.

### Authentication lacks abuse protection

There is no rate limiting, account lockout, password reset, email verification, or audit trail. Login and registration are vulnerable to brute-force and automated account creation.

The six-character minimum at `src/app/api/auth/register/route.ts:18` is weak for a financial dashboard.

### Session invalidation is only client-side

Logout deletes the local cookie, but JWTs remain valid until expiration. There is no session store, token version, or revocation mechanism. This is acceptable for a prototype but limits incident response if a token is stolen.

### Webhook parsing is brittle

`event.data.reference` is accessed before the processing `try` block at `src/app/api/webhooks/paystack/route.ts:26`. Valid JSON with a missing or malformed `data` object can cause an uncontrolled 500.

The webhook also lacks the amount and currency checks present in browser verification. Both paths should call one shared idempotent verification service.

### Payment record creation happens after Paystack initialization

Paystack is called at `src/app/api/payments/initiate/route.ts:43`, while the local `Tip` is inserted later at `src/app/api/payments/initiate/route.ts:56`.

If database insertion fails after successful initialization, the user can pay a transaction the application cannot reconcile. A safer design creates the pending record first, then initializes Paystack and updates it with provider details/status.

### Sensitive operational details reach clients

Payment errors return the underlying provider exception in `detail` at `src/app/api/payments/initiate/route.ts:78` and `src/app/api/payments/verify/route.ts:83`.

Provider response details should remain in structured server logs, with a stable public error code returned to clients.

### Provider API calls have no timeout

Both Paystack `fetch` calls at `src/lib/paystack.ts:64` and `src/lib/paystack.ts:94` can wait indefinitely until the runtime terminates them. Add an abort timeout and distinguish provider timeout, malformed response, and rejected transaction errors.

## Frontend and accessibility findings

- The avatar uses raw `<img>` at `src/app/tip/[slug]/client.tsx:101`, producing the only ESLint warning. Remote avatar URLs would also need an image allowlist if migrated to `next/image`.
- Form labels on the tip page lack `htmlFor` and matching input IDs, for example `src/app/tip/[slug]/client.tsx:145`.
- Error messages are not announced using `aria-live`.
- Password visibility buttons are removed from keyboard order with `tabIndex={-1}` at `src/app/register/page.tsx:159` and the equivalent login control.
- The dashboard performs two authentication-related requests on load instead of delivering authenticated server-rendered data.
- Dashboard protection happens client-side after requests fail at `src/app/dashboard/page.tsx:76`. Server-side authorization would avoid the loading/redirect cycle.
- The copy-to-clipboard operation at `src/app/dashboard/page.tsx:87` ignores rejection.
- The success page's effect depends on `searchParams` and unused `slug` at `src/app/tip/[slug]/success/page.tsx:60`, making the dependency broader than necessary.
- Tip list items use array indexes as keys at `src/app/tip/[slug]/client.tsx:242`; the query does not supply tip IDs.
- The homepage still says tips are received through Flutterwave at `src/app/page.tsx:65`, while the implementation uses Paystack.

## Bloat and maintainability

### Large amount of obsolete Flutterwave documentation

Approximately 729 lines in `docs/` describe removed Flutterwave implementations, nonexistent endpoints, and obsolete environment variables. For example, `docs/integration-02.md:95` documents routes that do not exist in the current application.

This material may be valuable as history, but it should be archived or clearly labelled obsolete. Currently it gives a misleading account of the active system.

### Unused dependencies and assets

These package entries have no active imports:

- `uuid`
- `@types/uuid`
- `ts-node`
- Probably `@types/bcryptjs`, because modern `bcryptjs` ships its own declarations

Unused default assets remain in `public/`: `next.svg`, `vercel.svg`, `globe.svg`, `window.svg`, and `file.svg`.

### Global React Query provider is wider than necessary

`src/app/layout.tsx:32` wraps the entire application in a client-side React Query provider, although only the dashboard uses React Query. This adds a client boundary and JavaScript to otherwise server-renderable pages.

For a small dashboard, server rendering may remove the need for React Query entirely.

### Duplicated code

- Login and registration duplicate password icons, validation structure, fetch/error handling, and form styling.
- Payment verification logic is duplicated between the callback route and webhook route, and the two copies already differ in validation.
- Creator/tip types manually duplicate Prisma projections across server and client code.

### Placeholder configuration and README

- `next.config.ts` contains no settings beyond the scaffold.
- The README is still the default Create Next App text and does not document architecture, environment requirements, migrations, Paystack setup, or deployment.
- `allowJs: true` and `skipLibCheck: true` in `tsconfig.json` weaken checking without an obvious current need for JavaScript source files.

## Data-model concerns

Free-form strings are used for `paymentStatus`, `paymentMethod`, and `currency`. This allows inconsistent values and makes state transitions implicit. Enums or application-level validated unions would be safer.

Useful indexes are missing for common queries:

- `(creatorId, paymentStatus, createdAt)`
- Potentially `paystackTransactionId`, ideally unique when present

Deleting a creator is currently restricted by the default foreign-key behavior. That may be intentional, but deletion/anonymization policy should be explicit because tip records contain supporter PII.

There is also no `updatedAt`, provider failure state, paid timestamp, reconciliation record, refund state, or payout state.

## Verification results

- `npx tsc --noEmit`: passed.
- `npx prisma validate`: passed.
- `npm run lint`: passed with one `<img>` warning.
- `npm run build`: compilation began but failed because the environment could not fetch Geist and Geist Mono from Google Fonts. This is an external font/network dependency rather than a demonstrated TypeScript failure.
- `npx prisma migrate status`: could not connect through the restricted review environment, so live migration state was not confirmed.
- No automated test framework or test script exists.
- `.env` is correctly ignored and not tracked.
- The worktree already contained user-added logging changes in `src/app/api/payments/verify/route.ts`; they were preserved.

## Recommended order of work

1. Require a strong `NEXTAUTH_SECRET` and remove the fallback.
2. Validate webhook signatures and centralize payment verification.
3. Remove supporter emails and full Tip objects from public responses.
4. Create and deploy a migration that reconciles Flutterwave and Paystack columns.
5. Add strict server-side request schemas, limits, email normalization, and rate limiting.
6. Replace truncated dashboard calculations with database aggregates.
7. Decide and document whether the product merely records platform tips or actually supports creator payouts/splits.
8. Add payment/auth integration tests before further feature work.
9. Remove obsolete documentation, dependencies, default assets, and duplicated frontend code.
10. Replace or self-host the Google fonts if builds must work in network-restricted environments.
