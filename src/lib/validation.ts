export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export async function readJsonObject(
  request: Request
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json()
    return isRecord(body) ? body : null
  } catch {
    return null
  }
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null

  const email = value.trim().toLowerCase()
  if (
    email.length === 0 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return null
  }

  return email
}

export function normalizeText(
  value: unknown,
  { maxLength, required = false }: { maxLength: number; required?: boolean }
): string | null {
  if (typeof value !== "string") return required ? null : ""

  const text = value.trim()
  if ((required && text.length === 0) || text.length > maxLength) return null
  return text
}
