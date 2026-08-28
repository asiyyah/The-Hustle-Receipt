import { NextRequest } from "next/server"
import {
  PaymentVerificationError,
  verifyAndRecordTip,
} from "@/lib/payment-verification"
import { readJsonObject } from "@/lib/validation"
import {
  consumeRateLimits,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request)
    const reference =
      body && typeof body.reference === "string"
        ? body.reference.trim()
        : ""

    if (!reference) {
      return Response.json(
        { error: "reference is required" },
        { status: 400 }
      )
    }

    const rateLimit = await consumeRateLimits([
      {
        namespace: "payments:verify:ip",
        identifier: getClientIp(request),
        limit: 30,
        windowMs: 10 * 60 * 1000,
      },
      {
        namespace: "payments:verify:reference",
        identifier: reference,
        limit: 10,
        windowMs: 10 * 60 * 1000,
      },
    ])
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

    const result = await verifyAndRecordTip(reference)
    return Response.json({
      message:
        result.status === "verified"
          ? "Payment verified successfully"
          : "Payment already verified",
      status: result.status,
      reference: result.reference,
    })
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      return Response.json({ error: error.message }, { status: error.status })
    }

    console.error("Verify payment error:", error)
    return Response.json(
      { error: "Verification failed" },
      { status: 500 }
    )
  }
}
