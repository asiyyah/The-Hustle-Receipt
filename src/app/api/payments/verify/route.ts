import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTransaction } from "@/lib/flutterwave"

export async function POST(request: NextRequest) {
  try {
    const { transactionId, transactionReference } = await request.json()

    if (!transactionId && !transactionReference) {
      return Response.json(
        { error: "Transaction ID or reference is required" },
        { status: 400 }
      )
    }

    const verification = transactionId
      ? await verifyTransaction(transactionId)
      : null

    if (!verification) {
      return Response.json(
        { error: "Transaction ID is required for verification" },
        { status: 400 }
      )
    }

    const ref = verification.reference || transactionReference

    const tip = await prisma.tip.findUnique({
      where: { transactionReference: ref },
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

    if (verification.status !== "successful") {
      return Response.json(
        { error: `Payment status is "${verification.status}", expected "successful"` },
        { status: 400 }
      )
    }

    if (Math.floor(verification.amount) !== Math.floor(tip.amount)) {
      return Response.json(
        { error: `Amount mismatch: expected ${tip.amount}, got ${verification.amount}` },
        { status: 400 }
      )
    }

    if (verification.currency !== tip.currency) {
      return Response.json(
        { error: `Currency mismatch: expected ${tip.currency}, got ${verification.currency}` },
        { status: 400 }
      )
    }

    const updated = await prisma.tip.update({
      where: { id: tip.id },
      data: {
        paymentStatus: "verified",
        flutterwaveTransactionId: transactionId,
      },
    })

    return Response.json({
      message: "Payment verified successfully",
      tip: updated,
    })
  } catch (error) {
    console.error("Verify payment error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
