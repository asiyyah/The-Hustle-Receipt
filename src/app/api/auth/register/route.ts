import { NextRequest } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { createSession } from "@/lib/auth"
import { generateSlug } from "@/lib/slug"
import { normalizeEmail, normalizeText, readJsonObject } from "@/lib/validation"
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

    const fullName = normalizeText(body.fullName, {
      maxLength: 100,
      required: true,
    })
    const email = normalizeEmail(body.email)
    const password = typeof body.password === "string" ? body.password : ""

    if (!fullName || !email || !password) {
      return Response.json(
        { error: "All fields are required" },
        { status: 400 }
      )
    }

    const rateLimit = await consumeRateLimits([
      {
        namespace: "auth:register:ip",
        identifier: getClientIp(request),
        limit: 5,
        windowMs: 60 * 60 * 1000,
      },
      {
        namespace: "auth:register:email",
        identifier: email,
        limit: 3,
        windowMs: 60 * 60 * 1000,
      },
    ])
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

    if (password.length < 8 || password.length > 128) {
      return Response.json(
        { error: "Password must be between 8 and 128 characters" },
        { status: 400 }
      )
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return Response.json(
        { error: "Email already registered" },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const baseSlug = generateSlug(fullName)

    let creatorSlug = baseSlug
    let slugExists = true
    let counter = 0
    while (slugExists) {
      const existingSlug = await prisma.user.findUnique({
        where: { creatorSlug },
      })
      if (!existingSlug) {
        slugExists = false
      } else {
        counter++
        creatorSlug = `${baseSlug}-${counter}`
      }
    }

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
        creatorSlug,
      },
    })

    await createSession(user.id)

    return Response.json(
      {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          creatorSlug: user.creatorSlug,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Register error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
