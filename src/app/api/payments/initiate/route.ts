import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateTxRef } from "@/lib/slug"
import { initializeTransaction } from "@/lib/paystack"
import { normalizeEmail, normalizeText, readJsonObject } from "@/lib/validation"
import {
  consumeRateLimits,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit"

const MAX_TIP_AMOUNT = 10_000_000

export async function POST(request: NextRequest) {
  let txRef: string | null = null

  try {
    const body = await readJsonObject(request)
    if (!body) {
      return Response.json({ error: "Invalid request body" }, { status: 400 })
    }

    const creatorSlug =
      typeof body.creatorSlug === "string" ? body.creatorSlug.trim() : ""
    const supporterEmail = normalizeEmail(body.supporterEmail)
    const supporterName = normalizeText(body.supporterName, { maxLength: 100 })
    const message = normalizeText(body.message, { maxLength: 500 })
    const amount = typeof body.amount === "number" ? body.amount : Number.NaN
    const paymentMethod = body.paymentMethod

    if (
      !creatorSlug ||
      creatorSlug.length > 60 ||
      !supporterEmail ||
      supporterName === null ||
      message === null ||
      !Number.isSafeInteger(amount) ||
      paymentMethod !== "card"
    ) {
      return Response.json(
        { error: "Invalid payment details" },
        { status: 400 }
      )
    }

    if (amount < 100 || amount > MAX_TIP_AMOUNT) {
      return Response.json(
        { error: `Tip must be between ₦100 and ₦${MAX_TIP_AMOUNT.toLocaleString()}` },
        { status: 400 }
      )
    }

    const rateLimit = await consumeRateLimits([
      {
        namespace: "payments:initiate:ip",
        identifier: getClientIp(request),
        limit: 20,
        windowMs: 10 * 60 * 1000,
      },
      {
        namespace: "payments:initiate:email",
        identifier: supporterEmail,
        limit: 10,
        windowMs: 10 * 60 * 1000,
      },
    ])
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

    const creator = await prisma.user.findUnique({
      where: { creatorSlug },
    })

    if (!creator) {
      return Response.json({ error: "Creator not found" }, { status: 404 })
    }

    txRef = generateTxRef("TIP")

    const callbackUrl = `${process.env.APP_URL || request.nextUrl.origin}/tip/${creatorSlug}/success`

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

    return Response.json({
      authorizationUrl: result.data.authorization_url,
      reference: txRef,
    })
  } catch (error) {
    if (txRef) {
      await prisma.tip
        .updateMany({
          where: { transactionReference: txRef, paymentStatus: "pending" },
          data: { paymentStatus: "failed" },
        })
        .catch((updateError) =>
          console.error("Failed to mark payment initiation as failed:", updateError)
        )
    }

    console.error("Initiate payment error:", error)
    return Response.json(
      { error: "Payment initiation failed" },
      { status: 500 }
    )
  }
}
