import "server-only"
import crypto from "node:crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "./prisma"

export type RateLimitPolicy = {
  namespace: string
  identifier: string
  limit: number
  windowMs: number
}

export type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  retryAfterSeconds: number
}

type BucketResult = {
  count: number
  resetAt: Date
}

function bucketKey(namespace: string, identifier: string) {
  const secret =
    process.env.RATE_LIMIT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.PAYSTACK_SECRET_KEY
  if (!secret || secret.length < 32) {
    throw new Error("A strong RATE_LIMIT_SECRET must be configured")
  }

  const digest = crypto
    .createHmac("sha256", secret)
    .update(identifier)
    .digest("hex")
  return `${namespace}:${digest}`
}

async function consumePolicy(policy: RateLimitPolicy): Promise<RateLimitResult> {
  const now = new Date()
  const nextReset = new Date(now.getTime() + policy.windowMs)
  const staleBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const key = bucketKey(policy.namespace, policy.identifier)

  const buckets = await prisma.$queryRaw<BucketResult[]>(Prisma.sql`
    WITH "cleanup" AS (
      DELETE FROM "RateLimitBucket"
      WHERE "resetAt" < ${staleBefore}
    )
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, ${nextReset}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${nextReset}
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count", "resetAt"
  `)

  const bucket = buckets[0]
  if (!bucket) throw new Error("Rate limit bucket update returned no result")

  const allowed = bucket.count <= policy.limit
  return {
    allowed,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - bucket.count),
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000)),
  }
}

export async function consumeRateLimits(
  policies: RateLimitPolicy[]
): Promise<RateLimitResult> {
  const results = await Promise.all(policies.map(consumePolicy))
  const rejected = results.filter((result) => !result.allowed)

  if (rejected.length === 0) {
    return results.reduce((mostRestrictive, result) =>
      result.remaining < mostRestrictive.remaining ? result : mostRestrictive
    )
  }

  return rejected.reduce((longest, result) =>
    result.retryAfterSeconds > longest.retryAfterSeconds ? result : longest
  )
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")
  return forwarded?.split(",")[0]?.trim() || "unknown"
}

export function rateLimitResponse(result: RateLimitResult) {
  return Response.json(
    { error: "Too many attempts. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    }
  )
}
