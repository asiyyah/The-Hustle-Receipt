import "server-only"
import { flwFetch } from "./client"
import type {
  FlwApiResponse,
  FlwCreateCustomerParams,
  FlwCustomerData,
  FlwPaymentMethodData,
  FlwInitiateChargeParams,
  FlwChargeData,
  FlwChargeNextAction,
} from "./types"

export async function createCustomer(
  params: FlwCreateCustomerParams
): Promise<FlwCustomerData> {
  const res = await flwFetch<FlwApiResponse<FlwCustomerData>>("/customers", {
    method: "POST",
    body: JSON.stringify(params),
  })

  if (res.status !== "success" || !res.data) {
    throw new Error(
      `[Flutterwave/Payments] Customer creation failed: ${res.message}`
    )
  }

  return res.data
}

export async function createPaymentMethod(
  type: "opay",
  idempotencyKey?: string
): Promise<FlwPaymentMethodData> {
  const headers: Record<string, string> = {}
  if (idempotencyKey) {
    headers["X-Idempotency-Key"] = idempotencyKey
  }

  const res = await flwFetch<FlwApiResponse<FlwPaymentMethodData>>(
    "/payment-methods",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ type }),
    }
  )

  if (res.status !== "success" || !res.data) {
    throw new Error(
      `[Flutterwave/Payments] Payment method creation failed: ${res.message}`
    )
  }

  return res.data
}

export async function initiateCharge(
  params: FlwInitiateChargeParams,
  idempotencyKey?: string
): Promise<FlwChargeData> {
  const headers: Record<string, string> = {}
  if (idempotencyKey) {
    headers["X-Idempotency-Key"] = idempotencyKey
  }

  const res = await flwFetch<FlwApiResponse<FlwChargeData>>("/charges", {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  })

  if (res.status !== "success") {
    throw new Error(
      `[Flutterwave/Payments] Charge initiation failed: ${res.message}`
    )
  }

  return res.data
}

function extractRedirectUrl(
  charge: FlwChargeData
): string | undefined {
  if (charge.next_action?.redirect_url?.url) {
    return charge.next_action.redirect_url.url
  }
  const meta = charge.meta as Record<string, unknown> | undefined
  const auth = meta?.authorization as Record<string, unknown> | undefined
  if (auth?.mode === "redirect" && typeof auth?.redirect === "string") {
    return auth.redirect
  }
  return undefined
}

export async function createCheckoutSession(params: {
  amount: number
  currency: string
  reference: string
  customer: { email: string; name?: string }
  redirectUrl: string
  meta?: Record<string, unknown>
}): Promise<{
  chargeId: string
  reference: string
  checkoutUrl: string
  status: string
}> {
  const nameParts = (params.customer.name || "Supporter").split(/\s+/)
  const firstName = nameParts[0]
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : ""

  const customer = await createCustomer({
    email: params.customer.email,
    name: { first: firstName, last: lastName },
  })

  const paymentMethod = await createPaymentMethod("opay", params.reference)

  const charge = await initiateCharge(
    {
      amount: params.amount,
      currency: params.currency,
      reference: params.reference,
      customer_id: customer.id,
      payment_method_id: paymentMethod.id,
      redirect_url: params.redirectUrl,
      meta: params.meta,
    },
    params.reference
  )

  const checkoutUrl = extractRedirectUrl(charge)
  if (!checkoutUrl) {
    throw new Error(
      `[Flutterwave/Payments] No redirect URL in charge response (status: ${charge.status}, next_action: ${JSON.stringify(charge.next_action)})`
    )
  }

  return {
    chargeId: charge.id,
    reference: charge.reference,
    checkoutUrl,
    status: charge.status,
  }
}
