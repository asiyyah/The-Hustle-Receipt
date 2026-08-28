# The Hustle Receipt

A Next.js creator tipping application using Paystack hosted checkout, PostgreSQL, and Prisma.

## Core flow

1. A creator registers and receives a public `/tip/[slug]` page.
2. A supporter submits a tip and is redirected to Paystack Checkout.
3. Paystack redirects back to the application and also sends a signed webhook.
4. The server verifies the reference, amount, and currency with Paystack before marking the tip as verified.
5. Verified tips appear in the creator dashboard.

Payments currently settle to the Paystack account configured by `PAYSTACK_SECRET_KEY`. Creator subaccounts, split payments, and payouts are intentionally out of scope because this is an individual test project rather than a marketplace onboarding real creator bank accounts.

## Local setup

Copy `.env.example` to `.env` and provide valid values. `NEXTAUTH_SECRET` must contain at least 32 characters; generate a cryptographically random secret for every environment.

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

```bash
npm run dev       # development server
npm run lint      # ESLint
npx tsc --noEmit  # TypeScript validation
npm run build     # production build
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled PostgreSQL application connection |
| `DIRECT_URL` | Direct PostgreSQL migration connection |
| `PAYSTACK_SECRET_KEY` | Paystack test or live secret key |
| `APP_URL` | Public application origin used for payment callbacks |
| `NEXTAUTH_SECRET` | At least 32 characters; signs session JWTs |
| `RATE_LIMIT_SECRET` | Optional separate key for hashing rate-limit identities; falls back to the session or Paystack secret |

Configure the Paystack webhook URL as `https://your-domain.example/api/webhooks/paystack`.

## Documentation

- `docs/paystack-integration.md` describes the active payment integration.
- `docs/audit.md` contains the initial codebase audit.
- Flutterwave documents are obsolete historical research retained for reference only.
- `docs/testing-and-rate-limits.md` documents automated coverage and abuse limits.
