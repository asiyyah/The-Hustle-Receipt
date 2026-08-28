import crypto from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({ verifyAndRecordTip: vi.fn() }))

vi.mock("@/lib/payment-verification", () => ({
  verifyAndRecordTip: mocks.verifyAndRecordTip,
}))

import { POST } from "@/app/api/webhooks/paystack/route"

describe("Paystack webhook", () => {
  beforeEach(() => {
    process.env.PAYSTACK_SECRET_KEY = "test-paystack-secret"
    mocks.verifyAndRecordTip.mockResolvedValue({ status: "verified" })
  })

  it("rejects an invalid signature", async () => {
    const body = JSON.stringify({
      event: "charge.success",
      data: { reference: "TIP-TEST-1" },
    })
    const request = new NextRequest("http://localhost/api/webhooks/paystack", {
      method: "POST",
      headers: { "x-paystack-signature": "invalid" },
      body,
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
    expect(mocks.verifyAndRecordTip).not.toHaveBeenCalled()
  })

  it("processes a correctly signed charge.success event", async () => {
    const body = JSON.stringify({
      event: "charge.success",
      data: { reference: "TIP-TEST-1" },
    })
    const signature = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
      .update(body)
      .digest("hex")
    const request = new NextRequest("http://localhost/api/webhooks/paystack", {
      method: "POST",
      headers: { "x-paystack-signature": signature },
      body,
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mocks.verifyAndRecordTip).toHaveBeenCalledWith("TIP-TEST-1")
  })
})
