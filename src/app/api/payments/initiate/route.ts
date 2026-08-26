import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateTxRef } from "@/lib/slug"
import { initializeTransaction } from "@/lib/paystack"

export async function POST(request: NextRequest) {
  try {
    const {
      creatorSlug,
      supporterName,
      supporterEmail,
      amount,
      message,
      paymentMethod,
    } = await request.json()

    if (!creatorSlug || !supporterEmail || !amount || !paymentMethod) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    if (amount < 100) {
      return Response.json(
        { error: "Minimum tip is ₦100" },
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

    const callbackUrl = `${process.env.APP_URL || request.nextUrl.origin}/tip/${creatorSlug}/success`

    const result = await initializeTransaction({
      amount,
      email: supporterEmail,
      reference: txRef,
      callback_url: callbackUrl,
      metadata: {
        creatorSlug,
        creatorId: creator.id,
        supporterName: supporterName || "Anonymous",
        message: message || "",
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
        paymentMethod,
        paymentStatus: "pending",
        creatorId: creator.id,
      },
    })

    return Response.json({
      authorizationUrl: result.data.authorization_url,
      reference: txRef,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Initiate payment error:", message)
    return Response.json(
      { error: "Payment initiation failed", detail: message },
      { status: 500 }
    )
  }
}
