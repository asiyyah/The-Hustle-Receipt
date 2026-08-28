import "server-only"
import { SignJWT, jwtVerify } from "jose"

function getEncodedKey() {
  const secretKey = process.env.NEXTAUTH_SECRET
  if (!secretKey || secretKey.length < 32) {
    throw new Error("NEXTAUTH_SECRET must be set and contain at least 32 characters")
  }
  return new TextEncoder().encode(secretKey)
}

export type SessionPayload = {
  userId: string
  expiresAt: Date
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getEncodedKey())
}

export async function decrypt(session: string | undefined = "") {
  const encodedKey = getEncodedKey()
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}
