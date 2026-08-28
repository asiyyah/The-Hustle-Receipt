import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  verifyTransaction: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tip: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
  },
}))

vi.mock("@/lib/paystack", () => ({
  verifyTransaction: mocks.verifyTransaction,
}))

import { verifyAndRecordTip } from "@/lib/payment-verification"

const pendingTip = {
  id: "tip_1",
  amount: 500,
  currency: "NGN",
  paymentStatus: "pending",
}

describe("payment verification", () => {
  beforeEach(() => {
    mocks.findUnique.mockResolvedValue(pendingTip)
    mocks.update.mockResolvedValue({})
    mocks.verifyTransaction.mockResolvedValue({
      status: true,
      message: "Verification successful",
      data: {
        id: 6_495_464_664,
        status: "success",
        reference: "TIP-TEST-1",
        amount: 50_000,
        currency: "NGN",
      },
    })
  })

  it("stores large Paystack IDs as strings", async () => {
    await expect(verifyAndRecordTip("TIP-TEST-1")).resolves.toEqual({
      status: "verified",
      reference: "TIP-TEST-1",
    })

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "tip_1" },
      data: {
        paymentStatus: "verified",
        paystackTransactionId: "6495464664",
        paystackReference: "TIP-TEST-1",
      },
    })
  })

  it("does not call Paystack again for an already verified tip", async () => {
    mocks.findUnique.mockResolvedValue({
      ...pendingTip,
      paymentStatus: "verified",
    })

    await expect(verifyAndRecordTip("TIP-TEST-1")).resolves.toEqual({
      status: "already_verified",
      reference: "TIP-TEST-1",
    })
    expect(mocks.verifyTransaction).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("rejects an amount mismatch without updating the tip", async () => {
    mocks.verifyTransaction.mockResolvedValue({
      status: true,
      data: {
        id: 123,
        status: "success",
        reference: "TIP-TEST-1",
        amount: 40_000,
        currency: "NGN",
      },
    })

    await expect(verifyAndRecordTip("TIP-TEST-1")).rejects.toMatchObject({
      message: "Payment amount does not match",
      status: 400,
    })
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
