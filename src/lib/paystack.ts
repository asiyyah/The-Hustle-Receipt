import "server-only"
import crypto from "crypto"

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY ?? ""

const BASE_URL = "https://api.paystack.co"

function headers() {
  return {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  }
}

export interface InitializeTransactionParams {
  amount: number
  email: string
  reference: string
  callback_url: string
  metadata?: Record<string, unknown>
}

export interface PaystackResponse<T = unknown> {
  status: boolean
  message: string
  data: T
}

export interface InitializeTransactionData {
  authorization_url: string
  access_code: string
  reference: string
}

export interface VerifyTransactionData {
  id: number
  domain: string
  status: string
  reference: string
  amount: number
  message: string | null
  gateway_response: string
  paid_at: string
  created_at: string
  channel: string
  currency: string
  ip: string
  metadata: Record<string, unknown>
  customer: {
    id: number
    first_name: string
    last_name: string
    email: string
  }
}

export async function initializeTransaction(
  params: InitializeTransactionParams
): Promise<PaystackResponse<InitializeTransactionData>> {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error("PAYSTACK_SECRET_KEY must be set in .env")
  }

  const res = await fetch(`${BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      amount: params.amount * 100,
      email: params.email,
      reference: params.reference,
      callback_url: params.callback_url,
      metadata: params.metadata,
    }),
  })

  const json = (await res.json()) as PaystackResponse<InitializeTransactionData>

  if (!res.ok || !json.status) {
    throw new Error(
      `[Paystack] Initialize failed: ${json.message || JSON.stringify(json)}`
    )
  }

  return json
}

export async function verifyTransaction(
  reference: string
): Promise<PaystackResponse<VerifyTransactionData>> {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error("PAYSTACK_SECRET_KEY must be set in .env")
  }

  const res = await fetch(`${BASE_URL}/transaction/verify/${reference}`, {
    headers: headers(),
  })

  const json = (await res.json()) as PaystackResponse<VerifyTransactionData>

  if (!res.ok || !json.status) {
    throw new Error(
      `[Paystack] Verify failed: ${json.message || JSON.stringify(json)}`
    )
  }

  return json
}

export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY ?? ""
  if (!secret) return false

  const hash = crypto
    .createHmac("sha512", secret)
    .update(body)
    .digest("hex")

  return hash === signature
}
