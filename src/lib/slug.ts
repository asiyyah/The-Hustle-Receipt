export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
}

export function generateTxRef(prefix = "HR"): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${prefix}-${random}-${timestamp}`
}
