import "server-only"
import crypto from "crypto"

const TOKEN_URL =
  "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token"

const BASE_URL =
  process.env.FLW_BASE_URL ??
  "https://developersandbox-api.flutterwave.com"

let tokenCache: { accessToken: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken
  }

  const clientId = process.env.FLW_CLIENT_ID ?? ""
  const clientSecret = process.env.FLW_CLIENT_SECRET ?? ""

  if (!clientId || !clientSecret) {
    throw new Error(
      "[Flutterwave] FLW_CLIENT_ID and FLW_CLIENT_SECRET must be set in .env"
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
      `[Flutterwave] Token request failed (HTTP ${res.status}): ${body}`
    )
  }

  const json = (await res.json()) as {
    access_token: string
    expires_in: number
  }

  tokenCache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  }

  return tokenCache.accessToken
}

// ─── Encryption (AES-256-GCM) ────────────────────────────────────────────────

export function generateNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let nonce = ""
  const bytes = crypto.randomBytes(12)
  for (let i = 0; i < 12; i++) {
    nonce += chars[bytes[i] % chars.length]
  }
  return nonce
}

export function encryptAES(plainText: string, nonce: string): string {
  const encryptionKey = process.env.FLW_ENCRYPTION_KEY ?? ""
  if (!encryptionKey) {
    throw new Error(
      "[Flutterwave] FLW_ENCRYPTION_KEY must be set in .env for encryption"
    )
  }
  if (nonce.length !== 12) {
    throw new Error("[Flutterwave] Nonce must be exactly 12 characters")
  }

  const key = Buffer.from(encryptionKey, "base64")
  const iv = Buffer.from(nonce, "utf8")

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = cipher.update(plainText, "utf8")
  cipher.final()
  const tag = cipher.getAuthTag()

  return Buffer.concat([ciphertext, tag]).toString("base64")
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type PaymentMethodType = "card" | "ussd" | "bank_transfer" | "opay"

export interface CardDetails {
  pan: string
  expiryMonth: string
  expiryYear: string
  cvv: string
}

export interface InitiateOrchestratorParams {
  amount: number
  currency: string
  reference: string
  redirect_url: string
  customer: {
    email: string
    name: {
      first: string
      last?: string
    }
  }
  payment_method: {
    type: PaymentMethodType
    card?: {
      nonce: string
      encrypted_card_number: string
      encrypted_expiry_month: string
      encrypted_expiry_year: string
      encrypted_cvv: string
    }
  }
}

export function encryptCardDetails(
  card: CardDetails
): {
  nonce: string
  encrypted_card_number: string
  encrypted_expiry_month: string
  encrypted_expiry_year: string
  encrypted_cvv: string
} {
  const nonce = generateNonce()
  return {
    nonce,
    encrypted_card_number: encryptAES(card.pan.replace(/\s/g, ""), nonce),
    encrypted_expiry_month: encryptAES(card.expiryMonth, nonce),
    encrypted_expiry_year: encryptAES(card.expiryYear, nonce),
    encrypted_cvv: encryptAES(card.cvv, nonce),
  }
}

export interface NextAction {
  type:
    | "redirect_url"
    | "requires_pin"
    | "requires_otp"
    | "requires_additional_fields"
    | "payment_instruction"
  redirect_url?: {
    url: string
  }
  payment_instruction?: Record<string, unknown>
}

export interface ChargeData {
  id: string
  flw_ref: string
  reference: string
  amount: number
  currency: string
  customer: { id: string; email: string }
  next_action: NextAction
  status: string
  payment_method_details?: Record<string, unknown>
}

export interface ChargeResponse {
  status: string
  message: string
  data: ChargeData
}

// ─── Orchestrator: Initiate Charge ───────────────────────────────────────────

export async function initiateOrchestratorCharge(
  params: InitiateOrchestratorParams
): Promise<ChargeResponse> {
  const token = await getAccessToken()

  const res = await fetch(`${BASE_URL}/orchestration/direct-charges`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  })

  const json = (await res.json()) as ChargeResponse & {
    message?: string
  }

  if (!res.ok) {
    throw new Error(
      `[Flutterwave] Orchestrator charge failed: ${json.message || JSON.stringify(json)}`
    )
  }

  return json as ChargeResponse
}

// ─── Continue Authorization (PIN / OTP / AVS) ────────────────────────────────

export interface AuthorizationPayload {
  authorization:
    | {
        type: "pin"
        pin: {
          nonce: string
          encrypted_pin: string
        }
      }
    | {
        type: "otp"
        otp: {
          code: string
        }
      }
    | {
        type: "avs"
        avs: {
          address: Record<string, string>
        }
      }
}

export async function updateCharge(
  chargeId: string,
  authorization: AuthorizationPayload
): Promise<ChargeResponse> {
  const token = await getAccessToken()

  const res = await fetch(`${BASE_URL}/charges/${chargeId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(authorization),
  })

  const json = (await res.json()) as ChargeResponse & {
    message?: string
  }

  if (!res.ok) {
    throw new Error(
      `[Flutterwave] Charge update failed: ${json.message || JSON.stringify(json)}`
    )
  }

  return json as ChargeResponse
}

// ─── Verify Charge ───────────────────────────────────────────────────────────

export async function verifyCharge(
  chargeId: string
): Promise<ChargeResponse> {
  const token = await getAccessToken()

  const res = await fetch(`${BASE_URL}/charges/${chargeId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const json = (await res.json()) as ChargeResponse & {
    message?: string
  }

  if (!res.ok) {
    throw new Error(
      `[Flutterwave] Charge verification failed: ${json.message || JSON.stringify(json)}`
    )
  }

  return json as ChargeResponse
}
