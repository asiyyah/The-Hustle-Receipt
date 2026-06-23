import { NextRequest } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { createSession } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return Response.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

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
