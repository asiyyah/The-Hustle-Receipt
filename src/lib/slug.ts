import crypto from "crypto"

export function generateSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)

  return slug || `creator-${crypto.randomBytes(4).toString("hex")}`
}

export function generateTxRef(prefix = "HR"): string {
  const timestamp = Date.now()
  const random = crypto.randomBytes(5).toString("hex").toUpperCase()
  return `${prefix}-${random}-${timestamp}`
}
