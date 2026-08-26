import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTransaction } from "@/lib/paystack"

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get("x-paystack-signature") ?? ""

  if (!signature) {
    console.warn("[Webhook] Rejected request — missing signature")
    return new Response("Unauthorized", { status: 401 })
  }

  let event: { event: string; data: { reference: string } }
  try {
    event = JSON.parse(body)
  } catch {
    return new Response("Bad Request — invalid JSON", { status: 400 })
  }

  if (event.event !== "charge.success") {
    console.log(`[Webhook] Unhandled event type: ${event.event}`)
    return Response.json({ received: true }, { status: 200 })
  }

  const { reference } = event.data

  try {
    const verification = await verifyTransaction(reference)

    if (verification.data.status !== "success") {
      console.error(`[Webhook] Verification failed for ${reference}`)
      return Response.json({ received: true }, { status: 200 })
    }

    const tip = await prisma.tip.findUnique({
      where: { transactionReference: reference },
    })

    if (!tip) {
      console.warn(`[Webhook] No tip found for reference: ${reference}`)
      return Response.json({ received: true }, { status: 200 })
    }

    if (tip.paymentStatus === "verified") {
      return Response.json(
        { received: true, message: "Already processed." },
        { status: 200 }
      )
    }

    await prisma.tip.update({
      where: { id: tip.id },
      data: {
        paymentStatus: "verified",
        paystackTransactionId: verification.data.id,
        paystackReference: verification.data.reference,
      },
    })

    console.log(
      `[Webhook] Tip ${tip.id} verified via webhook (ref: ${reference})`
    )
    return Response.json({ received: true }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[Webhook] Error processing ${reference}:`, message)
    return Response.json({ received: true }, { status: 200 })
  }
}
