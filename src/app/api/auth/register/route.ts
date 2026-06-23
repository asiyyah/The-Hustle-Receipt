import { NextRequest } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { createSession } from "@/lib/auth"
import { generateSlug } from "@/lib/slug"

export async function POST(request: NextRequest) {
  try {
    const { fullName, email, password } = await request.json()

    if (!fullName || !email || !password) {
      return Response.json(
        { error: "All fields are required" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return Response.json(
        { error: "Password must be at least 6 characters" },
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
