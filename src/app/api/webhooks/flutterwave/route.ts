import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { retrieveCharge } from "@/lib/server/flutterwave"
import type { FlwWebhookPayload } from "@/lib/server/flutterwave"

export async function POST(request: NextRequest) {
  const incomingHash = request.headers.get("verif-hash") ?? ""
  const expectedHash = process.env.FLW_WEBHOOK_HASH ?? ""

  if (!expectedHash || incomingHash !== expectedHash) {
    console.warn("[Webhook] Rejected request — invalid verif-hash")
    return new Response("Unauthorized", { status: 401 })
  }

  let payload: FlwWebhookPayload
  try {
    payload = (await request.json()) as FlwWebhookPayload
  } catch {
    return new Response("Bad Request — invalid JSON", { status: 400 })
  }

  switch (payload.type) {
    case "charge.completed":
      return handleChargeCompleted(payload)
    default:
      console.log(`[Webhook] Unhandled event type: ${payload.type}`)
      return Response.json({ received: true }, { status: 200 })
  }
}

async function handleChargeCompleted(payload: FlwWebhookPayload) {
  const { data } = payload

  const charge = await retrieveCharge(data.id).catch(() => null)
  if (!charge || charge.status !== "succeeded") {
    console.error(
      `[Webhook] Verification failed for charge ${data.id}`
    )
    return Response.json({ received: true }, { status: 200 })
  }

  const tip = await prisma.tip.findUnique({
    where: { transactionReference: charge.reference },
  })

  if (!tip) {
    console.warn(`[Webhook] No tip found for reference: ${charge.reference}`)
    return Response.json({ received: true }, { status: 200 })
  }

  if (tip.paymentStatus === "verified") {
    return Response.json({ received: true, message: "Already processed." }, { status: 200 })
  }

  if (tip.amount !== Math.floor(charge.amount)) {
    console.error(
      `[Webhook] Amount mismatch for ${charge.reference}: expected ${tip.amount}, got ${charge.amount}`
    )
    return Response.json({ received: true, message: "Amount mismatch" }, { status: 200 })
  }

  if (charge.currency !== tip.currency) {
    console.error(
      `[Webhook] Currency mismatch for ${charge.reference}: expected ${tip.currency}, got ${charge.currency}`
    )
    return Response.json({ received: true, message: "Currency mismatch" }, { status: 200 })
  }

  await prisma.tip.update({
    where: { id: tip.id },
    data: {
      paymentStatus: "verified",
      flutterwaveTransactionId: data.id,
    },
  })

  console.log(`[Webhook] Tip ${tip.id} verified via webhook (charge: ${data.id})`)
  return Response.json({ received: true }, { status: 200 })
}
