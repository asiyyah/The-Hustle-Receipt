import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyCharge } from "@/lib/flutterwave"

export async function POST(request: NextRequest) {
  try {
    const { chargeId, transactionReference } = await request.json()

    if (!chargeId && !transactionReference) {
      return Response.json(
        { error: "chargeId or transactionReference is required" },
        { status: 400 }
      )
    }

    let flwChargeId = chargeId

    if (!flwChargeId && transactionReference) {
      const tip = await prisma.tip.findUnique({
        where: { transactionReference },
      })
      if (!tip) {
        return Response.json(
          { error: "Transaction record not found" },
          { status: 404 }
        )
      }
      if (!tip.flwChargeId) {
        return Response.json(
          { error: "No charge ID found for this transaction" },
          { status: 400 }
        )
      }
      flwChargeId = tip.flwChargeId
    }

    const verification = await verifyCharge(flwChargeId)

    if (verification.data.status !== "succeeded") {
      return Response.json(
        {
          error: `Payment status is "${verification.data.status}", expected "succeeded"`,
        },
        { status: 400 }
      )
    }

    const ref = verification.data.reference || transactionReference
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

    if (Math.floor(verification.data.amount) !== Math.floor(tip.amount)) {
      return Response.json(
        {
          error: `Amount mismatch: expected ${tip.amount}, got ${verification.data.amount}`,
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
        flutterwaveTransactionId: verification.data.id,
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
