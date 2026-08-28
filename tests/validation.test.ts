import { describe, expect, it } from "vitest"
import {
  normalizeEmail,
  normalizeText,
  readJsonObject,
} from "@/lib/validation"

describe("request validation", () => {
  it("normalizes valid email addresses", () => {
    expect(normalizeEmail("  Creator@Example.COM ")).toBe(
      "creator@example.com"
    )
  })

  it("rejects malformed email addresses", () => {
    expect(normalizeEmail("not-an-email")).toBeNull()
    expect(normalizeEmail(42)).toBeNull()
  })

  it("enforces required and maximum text lengths", () => {
    expect(normalizeText("  hello  ", { maxLength: 10 })).toBe("hello")
    expect(normalizeText("", { maxLength: 10, required: true })).toBeNull()
    expect(normalizeText("too long", { maxLength: 3 })).toBeNull()
  })

  it("returns null for malformed JSON", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: "{broken",
    })

    await expect(readJsonObject(request)).resolves.toBeNull()
  })
})
