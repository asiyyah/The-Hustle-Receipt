import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTransaction } from "@/lib/paystack"

export async function POST(request: NextRequest) {
  try {
    const { reference } = await request.json()

    if (!reference) {
      return Response.json(
        { error: "reference is required" },
        { status: 400 }
      )
    }

    const verification = await verifyTransaction(reference)

    if (verification.data.status !== "success") {
      return Response.json(
        {
          error: `Payment status is "${verification.data.status}", expected "success"`,
        },
        { status: 400 }
      )
    }

    const tip = await prisma.tip.findUnique({
      where: { transactionReference: reference },
    })

    if (!tip) {
      return Response.json(
        { error: "Transaction record not found" },
        { status: 404 }
      )
    }

    if (tip.paymentStatus === "verified") {
      return Response.json({ message: "Already verified", tip })
    }

    if (Math.floor(verification.data.amount / 100) !== tip.amount) {
      return Response.json(
        {
          error: `Amount mismatch: expected ${tip.amount}, got ${verification.data.amount / 100}`,
        },
        { status: 400 }
      )
    }

    if (verification.data.currency !== tip.currency) {
      return Response.json(
        {
          error: `Currency mismatch: expected ${tip.currency}, got ${verification.data.currency}`,
        },
        { status: 400 }
      )
    }

    const updated = await prisma.tip.update({
      where: { id: tip.id },
      data: {
        paymentStatus: "verified",
        paystackTransactionId: verification.data.id,
        paystackReference: verification.data.reference,
      },
    })

    return Response.json({
      message: "Payment verified successfully",
      tip: updated,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Verify payment error:", message)
    return Response.json(
      { error: "Verification failed", detail: message },
      { status: 500 }
    )
  }
}
