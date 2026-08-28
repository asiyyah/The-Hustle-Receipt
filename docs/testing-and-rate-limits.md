# Testing and Rate Limiting

## Automated tests

Run the deterministic test suite with:

```bash
npm test
```

Use `npm run test:watch` during development. The Vitest suite runs in Node, mocks Paystack and Prisma at external boundaries, and never contacts Paystack or the production database.

Current regression coverage includes:

- Email and request-body normalization and validation.
- Login success, unknown credentials, registration hashing, and rate-limit rejection.
- Successful Paystack verification with transaction IDs larger than a 32-bit integer.
- Idempotent verification and amount-mismatch rejection.
- Rejection of invalid Paystack webhook signatures.
- Processing of correctly signed `charge.success` events.
- Database-backed rate-limit allowance, rejection, retry headers, and forwarded-IP parsing.

These tests are integration-style service and Route Handler tests. Browser E2E checkout automation is intentionally omitted because the test project uses hosted Paystack checkout and should not depend on real provider availability in normal CI.

## Distributed rate limiting

The limiter uses the shared PostgreSQL database, so counters remain consistent across Vercel/serverless instances. An atomic PostgreSQL upsert increments each fixed-window bucket and returns its current count. Expired buckets older than one day are deleted during later limiter operations.

Raw email addresses, references, and IP addresses are not stored in keys. Identifiers are HMAC-hashed using `RATE_LIMIT_SECRET`, falling back to `NEXTAUTH_SECRET` and then `PAYSTACK_SECRET_KEY`. Configure a separate random `RATE_LIMIT_SECRET` in production when practical.

Current policies:

| Endpoint | Identity | Limit |
| --- | --- | --- |
| Login | IP | 20 per 15 minutes |
| Login | Email | 5 per 15 minutes |
| Registration | IP | 5 per hour |
| Registration | Email | 3 per hour |
| Payment initiation | IP | 20 per 10 minutes |
| Payment initiation | Supporter email | 10 per 10 minutes |
| Payment verification | IP | 30 per 10 minutes |
| Payment verification | Transaction reference | 10 per 10 minutes |

Rejected requests return HTTP `429`, `Retry-After`, and rate-limit metadata headers. Paystack webhooks are not rate-limited because their HMAC signature is the primary trust boundary and Paystack may legitimately retry deliveries.
