import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTransaction } from "@/lib/flutterwave"

export async function POST(request: NextRequest) {
  try {
    const { transactionId, txRef } = await request.json()

    if (!transactionId && !txRef) {
      return Response.json(
        { error: "Transaction ID or reference required" },
        { status: 400 }
      )
    }

    let verificationResponse
    if (transactionId) {
      verificationResponse = await verifyTransaction(transactionId)
    }

    if (!verificationResponse || verificationResponse.status !== "success") {
      return Response.json(
        { error: "Transaction verification failed" },
        { status: 400 }
      )
    }

    const txData = verificationResponse.data

    if (txData.status !== "successful") {
      return Response.json(
        { error: "Payment was not successful" },
        { status: 400 }
      )
    }

    if (txData.currency !== "NGN") {
      return Response.json(
        { error: "Invalid currency" },
        { status: 400 }
      )
    }

    const tip = await prisma.tip.findUnique({
      where: { transactionReference: txRef || txData.tx_ref },
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

    if (tip.amount !== Math.floor(txData.amount)) {
      return Response.json(
        { error: "Amount mismatch" },
        { status: 400 }
      )
    }

    const updated = await prisma.tip.update({
      where: { id: tip.id },
      data: {
        paymentStatus: "verified",
        flutterwaveTransactionId: String(txData.id),
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
