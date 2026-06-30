import "server-only"

const BASE_URL = "https://api.flutterwave.com/v3"

function getSecretKey(): string {
  const key = process.env.FLWSECK_TEST
  if (!key) {
    throw new Error("[Flutterwave] FLWSECK_TEST must be set in .env")
  }
  return key
}

export async function initiatePayment(params: {
  tx_ref: string
  amount: number
  currency: string
  redirect_url: string
  customer: {
    email: string
    name?: string
  }
  customizations?: {
    title?: string
    description?: string
    logo?: string
  }
  meta?: Record<string, unknown>
}): Promise<{ link: string }> {
  const res = await fetch(`${BASE_URL}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  })

  const json = await res.json()

  if (!res.ok || json.status !== "success") {
    throw new Error(
      `[Flutterwave] Payment initiation failed: ${json.message || JSON.stringify(json)}`
    )
  }

  return { link: json.data.link }
}

export async function verifyTransaction(
  transactionId: string
): Promise<{
  status: string
  amount: number
  currency: string
  reference: string
}> {
  const res = await fetch(`${BASE_URL}/transactions/${transactionId}/verify`, {
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
    },
  })

  const json = await res.json()

  if (!res.ok || json.status !== "success") {
    throw new Error(
      `[Flutterwave] Transaction verification failed: ${json.message || JSON.stringify(json)}`
    )
  }

  return {
    status: json.data.status,
    amount: json.data.amount,
    currency: json.data.currency,
    reference: json.data.tx_ref,
  }
}
