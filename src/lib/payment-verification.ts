import "server-only"
import { prisma } from "./prisma"
import { verifyTransaction } from "./paystack"

export class PaymentVerificationError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
  }
}

export async function verifyAndRecordTip(reference: string) {
  const tip = await prisma.tip.findUnique({
    where: { transactionReference: reference },
  })

  if (!tip) {
    throw new PaymentVerificationError("Transaction record not found", 404)
  }

  if (tip.paymentStatus === "verified") {
    return { status: "already_verified" as const, reference }
  }

  const verification = await verifyTransaction(reference)
  const payment = verification.data

  if (payment.status !== "success") {
    throw new PaymentVerificationError(
      `Payment status is "${payment.status}", expected "success"`,
      400
    )
  }

  if (payment.amount !== tip.amount * 100) {
    throw new PaymentVerificationError("Payment amount does not match", 400)
  }

  if (payment.currency !== tip.currency) {
    throw new PaymentVerificationError("Payment currency does not match", 400)
  }

  await prisma.tip.update({
    where: { id: tip.id },
    data: {
      paymentStatus: "verified",
      paystackTransactionId: String(payment.id),
      paystackReference: payment.reference,
    },
  })

  return { status: "verified" as const, reference }
}
