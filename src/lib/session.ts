import "server-only"
import { SignJWT, jwtVerify } from "jose"

const secretKey = process.env.NEXTAUTH_SECRET || "fallback-secret-change-me"
const encodedKey = new TextEncoder().encode(secretKey)

export type SessionPayload = {
  userId: string
  expiresAt: Date
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey)
}

export async function decrypt(session: string | undefined = "") {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}
