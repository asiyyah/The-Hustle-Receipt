import { NextRequest } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { createSession } from "@/lib/auth"
import { normalizeEmail, readJsonObject } from "@/lib/validation"
import {
  consumeRateLimits,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request)
    if (!body) {
      return Response.json({ error: "Invalid request body" }, { status: 400 })
    }

    const email = normalizeEmail(body.email)
    const password = typeof body.password === "string" ? body.password : ""

    if (!email || !password) {
      return Response.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    const rateLimit = await consumeRateLimits([
      {
        namespace: "auth:login:ip",
        identifier: getClientIp(request),
        limit: 20,
        windowMs: 15 * 60 * 1000,
      },
      {
        namespace: "auth:login:email",
        identifier: email,
        limit: 5,
        windowMs: 15 * 60 * 1000,
      },
    ])
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 })
    }

    await createSession(user.id)

    return Response.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        creatorSlug: user.creatorSlug,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
