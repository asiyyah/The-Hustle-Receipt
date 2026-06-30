import "server-only"
import { getAccessToken } from "./auth"

const BASE_URLS = {
  sandbox: "https://developersandbox-api.flutterwave.com",
  production: "https://f4bexperience.flutterwave.com",
}

function baseUrl(): string {
  return process.env.NODE_ENV === "production"
    ? BASE_URLS.production
    : BASE_URLS.sandbox
}

function generateTraceId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 10)
  return `hr-${timestamp}-${random}`
}

export async function flwFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken()

  const res = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Trace-Id": generateTraceId(),
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(
      `[Flutterwave/Client] HTTP ${res.status} on ${path}: ${body}`
    )
  }

  return res.json() as Promise<T>
}
