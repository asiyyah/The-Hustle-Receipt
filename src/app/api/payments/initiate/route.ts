import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { initiatePayment } from "@/lib/flutterwave"
import { v4 as uuidv4 } from "uuid"

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

    const txRef = `HR-${uuidv4().slice(0, 8)}-${Date.now()}`
    const redirectUrl = `${request.nextUrl.origin}/tip/${creatorSlug}/success`

    const payment = await initiatePayment({
      amount,
      currency: "NGN",
      customerEmail: supporterEmail,
      customerName: supporterName || undefined,
      redirectUrl,
      txRef,
    })

    if (payment.status !== "success") {
      return Response.json(
        { error: "Payment initiation failed" },
        { status: 400 }
      )
    }

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
      link: payment.data.link,
      txRef,
    })
  } catch (error) {
    console.error("Initiate payment error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
