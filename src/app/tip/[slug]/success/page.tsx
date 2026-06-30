"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"

type PageStatus = "verifying" | "success" | "error"

export default function SuccessPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string

  const [state, setState] = useState<{
    status: PageStatus
    errorMsg: string
  }>({ status: "verifying", errorMsg: "" })

  useEffect(() => {
    const chargeId =
      searchParams.get("charge_id") ||
      searchParams.get("id") ||
      searchParams.get("transaction_id")
    const flwStatus = searchParams.get("status")

    async function checkPayment() {
      if (!chargeId) {
        setState({ status: "error", errorMsg: "No transaction reference found" })
        return
      }

      if (flwStatus === "cancelled" || flwStatus === "failed") {
        setState({ status: "error", errorMsg: "Payment was cancelled or failed" })
        return
      }

      try {
        const res = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chargeId }),
        })

        const json = await res.json()

        if (res.ok) {
          setState({ status: "success", errorMsg: "" })
        } else {
          setState({ status: "error", errorMsg: json.error || "Verification failed" })
        }
      } catch {
        setState({ status: "error", errorMsg: "Failed to verify payment" })
      }
    }

    checkPayment()
  }, [searchParams, slug])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        {state.status === "verifying" && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <span className="text-2xl">⏳</span>
            </div>
            <h1 className="text-xl font-bold">Verifying your payment</h1>
            <p className="text-sm text-gray-500">
              Please wait while we confirm your transaction...
            </p>
          </div>
        )}

        {state.status === "success" && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">✅</span>
            </div>
            <h1 className="text-xl font-bold">Payment successful!</h1>
            <p className="text-sm text-gray-500">
              Thank you for your support. The creator has been notified.
            </p>
            <Link
              href={`/tip/${slug}`}
              className="inline-block bg-black text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Go back
            </Link>
          </div>
        )}

        {state.status === "error" && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">❌</span>
            </div>
            <h1 className="text-xl font-bold">Payment verification failed</h1>
            <p className="text-sm text-gray-500">{state.errorMsg}</p>
            <Link
              href={`/tip/${slug}`}
              className="inline-block bg-black text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Try again
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
