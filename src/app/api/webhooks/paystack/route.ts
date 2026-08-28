import { NextRequest } from "next/server"
import { verifyWebhookSignature } from "@/lib/paystack"
import { verifyAndRecordTip } from "@/lib/payment-verification"
import { isRecord } from "@/lib/validation"

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get("x-paystack-signature") ?? ""

  if (!verifyWebhookSignature(body, signature)) {
    console.warn("[Webhook] Rejected request — missing signature")
    return new Response("Unauthorized", { status: 401 })
  }

  let event: unknown
  try {
    event = JSON.parse(body)
  } catch {
    return new Response("Bad Request — invalid JSON", { status: 400 })
  }

  if (!isRecord(event) || typeof event.event !== "string") {
    return new Response("Bad Request — invalid event", { status: 400 })
  }

  if (event.event !== "charge.success") {
    return Response.json({ received: true }, { status: 200 })
  }

  if (
    !isRecord(event.data) ||
    typeof event.data.reference !== "string" ||
    !event.data.reference.trim()
  ) {
    return new Response("Bad Request — missing reference", { status: 400 })
  }

  const reference = event.data.reference.trim()

  try {
    await verifyAndRecordTip(reference)
    return Response.json({ received: true }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[Webhook] Error processing ${reference}:`, message)
    return Response.json({ received: true }, { status: 200 })
  }
}
