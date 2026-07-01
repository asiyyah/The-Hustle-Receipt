import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateTxRef } from "@/lib/slug"
import {
  initiateOrchestratorCharge,
  encryptCardDetails,
} from "@/lib/flutterwave"
import type { PaymentMethodType, CardDetails } from "@/lib/flutterwave"

export async function POST(request: NextRequest) {
  try {
    const {
      creatorSlug,
      supporterName,
      supporterEmail,
      amount,
      message,
      paymentMethod,
      cardDetails,
    } = await request.json()

    if (!creatorSlug || !supporterEmail || !amount || !paymentMethod) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const allowedMethods: PaymentMethodType[] = [
      "card",
      "ussd",
      "bank_transfer",
      "opay",
    ]
    if (!allowedMethods.includes(paymentMethod)) {
      return Response.json(
        { error: "Invalid payment method" },
        { status: 400 }
      )
    }

    if (paymentMethod === "card" && !cardDetails) {
      return Response.json(
        { error: "Card details are required for card payments", requiresCardForm: true },
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

    const nameParts = (supporterName || "Anonymous").trim().split(/\s+/)
    const customerName = {
      first: nameParts[0] || "Anonymous",
      last: nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined,
    }

    const paymentMethodPayload: {
      type: PaymentMethodType
      card?: {
        nonce: string
        encrypted_card_number: string
        encrypted_expiry_month: string
        encrypted_expiry_year: string
        encrypted_cvv: string
      }
    } = { type: paymentMethod }

    if (paymentMethod === "card" && cardDetails) {
      paymentMethodPayload.card = encryptCardDetails(cardDetails as CardDetails)
    }

    const charge = await initiateOrchestratorCharge({
      amount,
      currency: "NGN",
      reference: txRef,
      redirect_url: `${process.env.APP_URL || request.nextUrl.origin}/tip/${creatorSlug}/success`,
      customer: {
        email: supporterEmail,
        name: customerName,
      },
      payment_method: paymentMethodPayload,
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
        flwChargeId: charge.data.id,
        paymentStatus: "pending",
        creatorId: creator.id,
      },
    })

    return Response.json({
      nextAction: charge.data.next_action,
      chargeId: charge.data.id,
      flwRef: charge.data.flw_ref,
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
