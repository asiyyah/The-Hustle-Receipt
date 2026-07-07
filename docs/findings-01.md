# Flutterwave Credential Availability

## 1. Current Dashboard Credentials — ✅ Matches v4

Your sandbox dashboard showing **Client ID**, **Client Secret**, **Encryption Key** is the standard v4 (OAuth 2.0) credential set. Confirmed by the v4 Environments documentation (screenshot shows these three fields) and the v4 SDK initialization parameters.

## 2. Legacy v3 Credentials for New Accounts — ❌ Not by default

The v3 Authentication page states *"When you create a Flutterwave account, you receive three types of API keys: Secret key, Public key, Encryption key"* — but this was written when v3 was the default. The v4 Environments page shows that **new developer accounts onboard via a dedicated sandbox** (`developersandbox.flutterwave.com`) that issues **only v4 credentials** (Client ID/Secret).

The allbusiness.africa guide (Aug 2025) confirms v3 was still the default for new accounts at that time, but by mid-2026, v4 appears to be the default onboarding path for new signups.

## 3. Legacy v3 Credentials Hidden Elsewhere — ⚠️ One-way migration only

The v4 Environments page states:

> *"If you are on v3, i.e. the visible fields are Public Key, Private Key and Encryption Key, click the Switch to v4 live API keys to see v4 API credentials."*

This is a **one-way migration button** (v3 → v4). There is **no documented reverse toggle** (v4 → v3). The FAQ confirms *"You can only use one version."*

- **v3 accounts**: See Public Key, Secret Key, Encryption Key — can optionally click "Switch to v4 live API keys"
- **v4 accounts**: See Client ID, Client Secret, Encryption Key — no documented way to reveal v3 keys

## 4. New Accounts Restricted to OAuth v4 — ✅ Effectively yes

New developer accounts onboard through the dedicated v4 sandbox (`developersandbox.flutterwave.com`) and only receive **Client ID + Client Secret + Encryption Key**. The v4 announcement article states:

> *"When you're ready to launch, click the 'Switch to v4 Live API Keys' button"*

This button is for existing v3 merchants migrating. There is no documented process for a new v4 account to obtain `FLWPUBK_TEST`/`FLWSECK_TEST` keys.

## 5. New Developers Accessing v3 Hosted Checkout — ❌ Not possible

Since:
- v3 hosted checkout (`POST /v3/payments`) requires a **Secret Key** (`FLWSECK_TEST-...` or `FLWSECK-...`) for authorization
- New accounts only get v4 OAuth credentials (Client ID/Secret)
- There is no documented way to obtain v3 keys from a v4 account

...a newly created account cannot use the v3 Standard/hosted checkout flow. They would need an existing v3 account that has not yet migrated to v4.

## Summary

| Question | Answer |
|----------|--------|
| Your dashboard (Client ID/Secret/Encryption Key) = v4? | ✅ Yes |
| New accounts still get `FLWPUBK_TEST`/`FLWSECK_TEST`? | ❌ Not by default |
| v3 keys hidden/available for v4 accounts? | ⚠️ No documented reverse toggle (v3→v4 is one-way) |
| New accounts restricted to OAuth v4? | ✅ Effectively yes |
| New developers can use v3 hosted checkout? | ❌ No (requires v3 Secret Key) |
