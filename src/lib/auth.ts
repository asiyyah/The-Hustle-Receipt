import "server-only"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"
import { encrypt, decrypt, type SessionPayload } from "./session"
import { prisma } from "./prisma"

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const session = await encrypt({ userId, expiresAt })
  const cookieStore = await cookies()

  cookieStore.set("session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  })
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete("session")
}

export const verifySession = cache(async () => {
  const cookieStore = await cookies()
  const cookie = cookieStore.get("session")?.value
  const session = await decrypt(cookie)

  if (!session?.userId) {
    redirect("/login")
  }

  return { isAuth: true, userId: session.userId }
})

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get("session")?.value
  return decrypt(cookie)
}

export async function getCurrentUser() {
  const session = await getSession()
  if (!session?.userId) return null

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      creatorSlug: true,
      avatar: true,
      bio: true,
      twitter: true,
      instagram: true,
    },
  })

  return user
}
