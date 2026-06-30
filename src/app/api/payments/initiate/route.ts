import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateTxRef } from "@/lib/slug"
import { initiatePayment } from "@/lib/flutterwave"

export async function POST(request: NextRequest) {
  try {
    const { creatorSlug, supporterName, supporterEmail, amount, message } =
      await request.json()

    if (!creatorSlug || !supporterEmail || !amount) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const creator = await prisma.user.findUnique({
      where: { creatorSlug },
    })

    if (!creator) {
      return Response.json({ error: "Creator not found" }, { status: 404 })
    }

    const txRef = generateTxRef("TIP")

    const session = await initiatePayment({
      tx_ref: txRef,
      amount,
      currency: "NGN",
      redirect_url: `${request.nextUrl.origin}/tip/${creatorSlug}/success`,
      customer: {
        email: supporterEmail,
        name: supporterName || undefined,
      },
      customizations: {
        title: `Tip for ${creator.fullName}`,
      },
      meta: {
        creatorSlug,
        supporterName: supporterName || null,
        message: message || null,
      },
    })

    await prisma.tip.create({
      data: {
        amount,
        currency: "NGN",
        supporterName: supporterName || null,
        supporterEmail,
        message: message || null,
        transactionReference: txRef,
        paymentStatus: "pending",
        creatorId: creator.id,
      },
    })

    return Response.json({
      checkoutUrl: session.link,
      reference: txRef,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Initiate payment error:", message)
    return Response.json({ error: "Internal server error", detail: message }, { status: 500 })
  }
}
