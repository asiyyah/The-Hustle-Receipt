"use client"

import { useState, FormEvent } from "react"

type Creator = {
  id: string
  fullName: string
  avatar: string | null
  bio: string | null
  twitter: string | null
  instagram: string | null
  creatorSlug: string
}

type Tip = {
  amount: number
  supporterName: string | null
  message: string | null
  createdAt: Date
}

type FormDataState = {
  supporterName: string
  supporterEmail: string
  amount: number
  message: string
}

type PaymentState =
  | { phase: "form" }
  | { phase: "submitting" }
  | { phase: "error"; message: string }

const AMOUNTS = [500, 1000, 2000, 5000]

export function TipPageClient({
  creator,
  tips,
}: {
  creator: Creator
  tips: Tip[]
}) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState("")
  const [state, setState] = useState<PaymentState>({ phase: "form" })

  const amount = selectedAmount || (customAmount ? parseInt(customAmount) : 0)

  async function handleFormSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (amount < 100) {
      setState({ phase: "error", message: "Minimum tip is ₦100" })
      return
    }

    const form = new FormData(e.currentTarget)
    const formData: FormDataState = {
      supporterName: (form.get("supporterName") as string) || "",
      supporterEmail: form.get("supporterEmail") as string,
      amount,
      message: (form.get("message") as string) || "",
    }

    setState({ phase: "submitting" })

    try {
      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorSlug: creator.creatorSlug,
          supporterName: formData.supporterName || null,
          supporterEmail: formData.supporterEmail,
          amount: formData.amount,
          message: formData.message || null,
          paymentMethod: "card",
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setState({
          phase: "error",
          message: json.error || "Failed to initiate payment",
        })
        return
      }

      window.location.href = json.authorizationUrl
    } catch {
      setState({ phase: "error", message: "Something went wrong" })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-lg mx-auto px-4 py-12 space-y-8">
        <div className="text-center space-y-4">
          {creator.avatar && (
            <img
              src={creator.avatar}
              alt={creator.fullName}
              className="w-20 h-20 rounded-full mx-auto object-cover border-2 border-gray-200"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold">{creator.fullName}</h1>
            {creator.bio && (
              <p className="text-gray-500 mt-1">{creator.bio}</p>
            )}
          </div>
          <p className="text-lg text-gray-600">Support my creative work ☕</p>
          {(creator.twitter || creator.instagram) && (
            <div className="flex items-center justify-center gap-3 text-sm">
              {creator.twitter && (
                <a
                  href={`https://twitter.com/${creator.twitter}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-black transition-colors"
                >
                  Twitter
                </a>
              )}
              {creator.instagram && (
                <a
                  href={`https://instagram.com/${creator.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-black transition-colors"
                >
                  Instagram
                </a>
              )}
            </div>
          )}
        </div>

        <form
          onSubmit={handleFormSubmit}
          className="bg-white border rounded-2xl p-6 space-y-5"
        >
          <div>
            <label className="block text-sm font-medium mb-2">
              Your name{" "}
              <span className="text-gray-400">(optional)</span>
            </label>
            <input
              name="supporterName"
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Email address <span className="text-red-500">*</span>
            </label>
            <input
              name="supporterEmail"
              type="email"
              required
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              placeholder="supporter@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Amount (NGN) <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {AMOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => {
                    setSelectedAmount(a)
                    setCustomAmount("")
                  }}
                  className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    selectedAmount === a
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  ₦{a.toLocaleString()}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={100}
              placeholder="Or enter custom amount"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value)
                setSelectedAmount(null)
              }}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Message <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              name="message"
              rows={3}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 resize-none"
              placeholder="Love your work. Keep creating."
            />
          </div>

          {state.phase === "error" && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {state.message}
            </p>
          )}

          <button
            type="submit"
            disabled={amount < 100 || state.phase === "submitting"}
            className="w-full bg-black text-white rounded-xl px-4 py-3 text-base font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {state.phase === "submitting"
              ? "Redirecting to Paystack..."
              : amount >= 100
                ? `Send ₦${amount.toLocaleString()}`
                : "Send Tip"}
          </button>
        </form>

        {tips.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider">
              Recent support
            </h3>
            <div className="space-y-2">
              {tips.slice(0, 10).map((tip, i) => (
                <div
                  key={i}
                  className="bg-white border rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">❤️</span>
                    <p className="text-sm font-medium">
                      {tip.supporterName || "Anonymous"}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">
                    ₦{tip.amount.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
