import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  createSession: vi.fn(),
  compare: vi.fn(),
  hash: vi.fn(),
  consumeRateLimits: vi.fn(),
  rateLimitResponse: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUnique,
      create: mocks.create,
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  createSession: mocks.createSession,
}))

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimits: mocks.consumeRateLimits,
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
  rateLimitResponse: mocks.rateLimitResponse,
}))

vi.mock("bcryptjs", () => ({
  default: {
    compare: mocks.compare,
    hash: mocks.hash,
  },
}))

import { POST as login } from "@/app/api/auth/login/route"
import { POST as register } from "@/app/api/auth/register/route"

function jsonRequest(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("authentication routes", () => {
  beforeEach(() => {
    mocks.createSession.mockResolvedValue(undefined)
    mocks.hash.mockResolvedValue("hashed-password")
    mocks.consumeRateLimits.mockResolvedValue({
      allowed: true,
      limit: 10,
      remaining: 9,
      retryAfterSeconds: 0,
    })
  })

  it("normalizes email before login lookup", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "user_1",
      fullName: "Creator",
      email: "creator@example.com",
      creatorSlug: "creator",
      password: "stored-hash",
    })
    mocks.compare.mockResolvedValue(true)

    const response = await login(
      jsonRequest("/api/auth/login", {
        email: " Creator@Example.COM ",
        password: "password123",
      })
    )

    expect(response.status).toBe(200)
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { email: "creator@example.com" },
    })
    expect(mocks.createSession).toHaveBeenCalledWith("user_1")
  })

  it("returns the same error for an unknown user", async () => {
    mocks.findUnique.mockResolvedValue(null)

    const response = await login(
      jsonRequest("/api/auth/login", {
        email: "missing@example.com",
        password: "password123",
      })
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Invalid credentials" })
  })

  it("stops login when the distributed limit is exceeded", async () => {
    const limitedResponse = Response.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 }
    )
    mocks.consumeRateLimits.mockResolvedValue({
      allowed: false,
      limit: 5,
      remaining: 0,
      retryAfterSeconds: 60,
    })
    mocks.rateLimitResponse.mockReturnValue(limitedResponse)

    const response = await login(
      jsonRequest("/api/auth/login", {
        email: "creator@example.com",
        password: "password123",
      })
    )

    expect(response.status).toBe(429)
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it("normalizes registration data and hashes the password", async () => {
    mocks.findUnique.mockImplementation(({ where }) =>
      Promise.resolve("email" in where ? null : null)
    )
    mocks.create.mockResolvedValue({
      id: "user_2",
      fullName: "Test Creator",
      email: "creator@example.com",
      creatorSlug: "test-creator",
    })

    const response = await register(
      jsonRequest("/api/auth/register", {
        fullName: "  Test Creator  ",
        email: " Creator@Example.COM ",
        password: "password123",
      })
    )

    expect(response.status).toBe(201)
    expect(mocks.hash).toHaveBeenCalledWith("password123", 12)
    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        fullName: "Test Creator",
        email: "creator@example.com",
        password: "hashed-password",
        creatorSlug: "test-creator",
      },
    })
  })
})
