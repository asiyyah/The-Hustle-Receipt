import "server-only"

interface TokenCache {
  accessToken: string
  expiresAt: number
}

let cache: TokenCache | null = null

const TOKEN_URL =
  "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token"

async function requestNewToken(): Promise<TokenCache> {
  const clientId = process.env.FLW_CLIENT_ID ?? ""
  const clientSecret = process.env.FLW_CLIENT_SECRET ?? ""

  if (!clientId || !clientSecret) {
    throw new Error(
      "[Flutterwave/Auth] FLW_CLIENT_ID and FLW_CLIENT_SECRET must be set in .env"
    )
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(
      `[Flutterwave/Auth] Token request failed (HTTP ${res.status}): ${body}`
    )
  }

  const json = (await res.json()) as {
    access_token: string
    expires_in: number
  }

  return {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  }
}

export async function getAccessToken(): Promise<string> {
  if (cache && Date.now() < cache.expiresAt - 60_000) {
    return cache.accessToken
  }

  cache = await requestNewToken()
  return cache.accessToken
}
