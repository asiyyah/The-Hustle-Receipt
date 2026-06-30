import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTransaction } from "@/lib/flutterwave"

export async function POST(request: NextRequest) {
  const incomingHash = request.headers.get("verif-hash") ?? ""
  const expectedHash = process.env.FLW_WEBHOOK_HASH ?? ""

  if (!expectedHash || incomingHash !== expectedHash) {
    console.warn("[Webhook] Rejected request — invalid verif-hash")
    return new Response("Unauthorized", { status: 401 })
  }

  let payload: { type: string; data: { id: string; tx_ref: string; status: string; amount: number; currency: string } }
  try {
    payload = (await request.json()) as typeof payload
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

async function handleChargeCompleted(payload: {
  data: { id: string; tx_ref: string; status: string; amount: number; currency: string }
}) {
  const { data } = payload

  const verification = await verifyTransaction(data.id).catch(() => null)
  if (!verification || verification.status !== "successful") {
    console.error(`[Webhook] Verification failed for transaction ${data.id}`)
    return Response.json({ received: true }, { status: 200 })
  }

  const tip = await prisma.tip.findUnique({
    where: { transactionReference: verification.reference },
  })

  if (!tip) {
    console.warn(`[Webhook] No tip found for reference: ${verification.reference}`)
    return Response.json({ received: true }, { status: 200 })
  }

  if (tip.paymentStatus === "verified") {
    return Response.json({ received: true, message: "Already processed." }, { status: 200 })
  }

  if (tip.amount !== Math.floor(verification.amount)) {
    console.error(
      `[Webhook] Amount mismatch for ${verification.reference}: expected ${tip.amount}, got ${verification.amount}`
    )
    return Response.json({ received: true, message: "Amount mismatch" }, { status: 200 })
  }

  if (tip.currency !== verification.currency) {
    console.error(
      `[Webhook] Currency mismatch for ${verification.reference}: expected ${tip.currency}, got ${verification.currency}`
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

  console.log(`[Webhook] Tip ${tip.id} verified via webhook (transaction: ${data.id})`)
  return Response.json({ received: true }, { status: 200 })
}
