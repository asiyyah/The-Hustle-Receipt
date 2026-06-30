import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyCharge } from "@/lib/server/flutterwave"

export async function POST(request: NextRequest) {
  try {
    const { chargeId, transactionReference } = await request.json()

    if (!chargeId && !transactionReference) {
      return Response.json(
        { error: "Charge ID or transaction reference is required" },
        { status: 400 }
      )
    }

    const tip = await prisma.tip.findFirst({
      where: transactionReference
        ? { transactionReference }
        : { flutterwaveTransactionId: chargeId },
      orderBy: { createdAt: "desc" },
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

    const result = await verifyCharge(chargeId, tip.amount, tip.currency)

    if (!result.verified) {
      return Response.json(
        { error: result.reason ?? "Verification failed" },
        { status: 400 }
      )
    }

    const updated = await prisma.tip.update({
      where: { id: tip.id },
      data: {
        paymentStatus: "verified",
        flutterwaveTransactionId: chargeId,
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
