import "server-only"
import { flwFetch } from "./client"
import type { FlwApiResponse, FlwChargeData } from "./types"

export async function retrieveCharge(
  chargeId: string
): Promise<FlwChargeData> {
  const res = await flwFetch<FlwApiResponse<FlwChargeData>>(
    `/charges/${chargeId}`
  )

  if (res.status !== "success") {
    throw new Error(
      `[Flutterwave/Verify] Charge retrieval failed: ${res.message}`
    )
  }

  return res.data
}

export interface VerificationResult {
  verified: boolean
  charge: FlwChargeData
  reason?: string
}

export async function verifyCharge(
  chargeId: string,
  expectedAmount: number,
  expectedCurrency: string = "NGN"
): Promise<VerificationResult> {
  const charge = await retrieveCharge(chargeId)

  if (charge.status !== "succeeded") {
    return {
      verified: false,
      charge,
      reason: `Charge status is "${charge.status}", expected "succeeded"`,
    }
  }

  if (charge.currency !== expectedCurrency) {
    return {
      verified: false,
      charge,
      reason: `Currency mismatch: got "${charge.currency}", expected "${expectedCurrency}"`,
    }
  }

  if (Math.floor(charge.amount) !== Math.floor(expectedAmount)) {
    return {
      verified: false,
      charge,
      reason: `Amount mismatch: got ${charge.amount}, expected ${expectedAmount}`,
    }
  }

  return { verified: true, charge }
}
