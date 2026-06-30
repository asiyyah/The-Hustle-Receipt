# Flutterwave API Compatibility Findings

## 1. OAuth 2.0 Authentication — ✅ Confirmed

Flutterwave v4 uses OAuth 2.0 client credentials flow.

- **Token endpoint**: `POST https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token`
- **Body**: `client_id`, `client_secret`, `grant_type=client_credentials`
- **Token expiry**: 10 minutes (`expires_in: 600`)
- **Usage**: `Authorization: Bearer {{ACCESS_TOKEN}}`

Source: [developer.flutterwave.com/docs/authentication](https://developer.flutterwave.com/docs/authentication)

## 2. Legacy v3 `/payments` Endpoint — ✅ Still Exists

`POST https://api.flutterwave.com/v3/payments` remains documented and supported. It returns a hosted checkout link:

```json
{
  "status": "success",
  "message": "Hosted Link",
  "data": {
    "link": "https://checkout.flutterwave.com/v3/hosted/pay/flwlnk-01hynrt7cd1fpm6gtef6khn93g"
  }
}
```

Flutterwave has stated **no immediate plans to deprecate v3** and will provide advance notice.

## 3. OAuth Tokens on v3 Endpoint — ❌ NOT Compatible

The v3 endpoint requires the old **Secret Key** as bearer token:

```
Authorization: Bearer FLWSECK_TEST-{{SECRET_KEY}}
```

Flutterwave's FAQ explicitly states: *"Can I use both v4 and v3 APIs at the same time? No. You can only use one version."*

Since v3 uses static Secret Keys and v4 uses OAuth tokens, they are separate auth systems for separate API versions. No documentation suggests OAuth tokens work on v3 endpoints.

## 4. Hosted Checkout Flow — ✅ v3 only, ❌ Not in v4 yet

| Version | Hosted Checkout | Authentication |
|---------|----------------|----------------|
| **v3 (Standard)** | ✅ Fully functional via `POST /v3/payments` | Secret Key |
| **v4** | ❌ Not yet available | OAuth 2.0 |

**v3**: The **Flutterwave Standard** flow redirects users to a Flutterwave-hosted payment page. Supports `payment_options` parameter (e.g., `"card, ussd, mobilemoneyghana"`) — Flutterwave handles all payment method selection.

**v4**: As of April 2026, a Flutterwave engineer confirmed on Dev.to: *"v4 Checkout that supports payment link and hosted collection is still in work. Coming out very soon."* v4 currently only offers **General Flow** (multi-step direct charge) and **Orchestrator Flow** (single direct charge) — both require collecting payment details server-side, not a redirect-to-hosted-page model.

## Conclusion for Product Requirements

The desired flow (user enters amount → Send Tip → redirect to Flutterwave hosted checkout → Flutterwave handles payment method selection → backend verifies) is **only available via v3 Standard** (`POST /v3/payments`), authenticated with the **legacy Secret Key**, not OAuth.

To use OAuth 2.0 (v4), you would need to wait for the v4 hosted checkout feature or implement the direct charge APIs (General Flow or Orchestrator Flow).
