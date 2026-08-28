import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }))

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: mocks.queryRaw },
}))

import {
  consumeRateLimits,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit"

describe("distributed rate limiting", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "a-secure-test-secret-that-is-long-enough"
    delete process.env.RATE_LIMIT_SECRET
  })

  it("allows requests within the database-backed window", async () => {
    mocks.queryRaw.mockResolvedValue([
      { count: 2, resetAt: new Date(Date.now() + 60_000) },
    ])

    await expect(
      consumeRateLimits([
        {
          namespace: "auth:login:ip",
          identifier: "127.0.0.1",
          limit: 5,
          windowMs: 60_000,
        },
      ])
    ).resolves.toMatchObject({ allowed: true, limit: 5, remaining: 3 })
  })

  it("returns a retry period after the limit is exceeded", async () => {
    mocks.queryRaw.mockResolvedValue([
      { count: 6, resetAt: new Date(Date.now() + 60_000) },
    ])

    const result = await consumeRateLimits([
      {
        namespace: "auth:login:email",
        identifier: "creator@example.com",
        limit: 5,
        windowMs: 60_000,
      },
    ])
    const response = rateLimitResponse(result)

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBeTruthy()
  })

  it("uses the first forwarded client address", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.4, 10.0.0.1" },
    })

    expect(getClientIp(request)).toBe("203.0.113.4")
  })
})
