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

type PaymentMethod = "card" | "ussd" | "bank_transfer" | "opay"

type FormDataState = {
  supporterName: string
  supporterEmail: string
  amount: number
  message: string
}

type PaymentInstruction = {
  note?: string
  bank_name?: string
  account_number?: string
  account_name?: string
  ussd_code?: string
  [key: string]: unknown
}

type NextAction =
  | { type: "redirect_url"; redirect_url: { url: string } }
  | { type: "requires_pin" }
  | { type: "requires_otp" }
  | { type: "requires_additional_fields" }
  | {
      type: "payment_instruction"
      payment_instruction?: PaymentInstruction
    }

type CardFormState = {
  pan: string
  expiryMonth: string
  expiryYear: string
  cvv: string
}

type PaymentState =
  | { phase: "form" }
  | { phase: "selecting_method"; formData: FormDataState }
  | { phase: "card_form"; formData: FormDataState }
  | { phase: "initiating" }
  | { phase: "pin"; chargeId: string; reference: string; slug: string }
  | { phase: "otp"; chargeId: string; reference: string; slug: string }
  | { phase: "authorizing" }
  | {
      phase: "instructions"
      instruction: PaymentInstruction
      reference: string
      slug: string
    }
  | { phase: "verifying" }
  | { phase: "success" }
  | { phase: "error"; message: string }

const AMOUNTS = [500, 1000, 2000, 5000]

const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: string }[] = [
  { key: "card", label: "Card", icon: "💳" },
  { key: "ussd", label: "USSD", icon: "📱" },
  { key: "bank_transfer", label: "Bank Transfer", icon: "🏦" },
  { key: "opay", label: "OPay", icon: "📲" },
]

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
  const [pinValue, setPinValue] = useState("")
  const [otpValue, setOtpValue] = useState("")
  const [cardForm, setCardForm] = useState<CardFormState>({
    pan: "",
    expiryMonth: "",
    expiryYear: "",
    cvv: "",
  })

  const amount = selectedAmount || (customAmount ? parseInt(customAmount) : 0)

  function handleFormSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (amount < 100) {
      setState({ phase: "error", message: "Minimum tip is ₦100" })
      return
    }
    if (state.phase !== "form") return

    const form = new FormData(e.currentTarget)
    setState({
      phase: "selecting_method",
      formData: {
        supporterName: (form.get("supporterName") as string) || "",
        supporterEmail: form.get("supporterEmail") as string,
        amount,
        message: (form.get("message") as string) || "",
      },
    })
  }

  function handleMethodSelect(method: PaymentMethod) {
    if (state.phase !== "selecting_method") return

    if (method === "card") {
      setState({ phase: "card_form", formData: state.formData })
      return
    }

    initiatePayment(method, state.formData)
  }

  async function initiatePayment(
    method: PaymentMethod,
    formData: FormDataState,
    cardData?: CardFormState
  ) {
    setState({ phase: "initiating" })

    try {
      const body: Record<string, unknown> = {
        creatorSlug: creator.creatorSlug,
        supporterName: formData.supporterName || null,
        supporterEmail: formData.supporterEmail,
        amount: formData.amount,
        message: formData.message || null,
        paymentMethod: method,
      }

      if (cardData) {
        body.cardDetails = {
          pan: cardData.pan,
          expiryMonth: cardData.expiryMonth,
          expiryYear: cardData.expiryYear,
          cvv: cardData.cvv,
        }
      }

      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const json = await res.json()

      if (!res.ok) {
        if (json.requiresCardForm) {
          setState({ phase: "card_form", formData })
          return
        }
        setState({
          phase: "error",
          message: json.error || "Failed to initiate payment",
        })
        return
      }

      handleNextAction(
        json.nextAction as NextAction,
        json.chargeId as string,
        json.reference as string,
        creator.creatorSlug
      )
    } catch {
      setState({ phase: "error", message: "Something went wrong" })
    }
  }

  function handleCardSubmit() {
    if (state.phase !== "card_form") return
    const { pan, expiryMonth, expiryYear, cvv } = cardForm
    if (
      !pan.replace(/\s/g, "").match(/^\d{13,19}$/) ||
      !expiryMonth.match(/^\d{1,2}$/) ||
      !expiryYear.match(/^\d{2,4}$/) ||
      !cvv.match(/^\d{3,4}$/)
    ) {
      setState({ phase: "error", message: "Invalid card details" })
      return
    }
    initiatePayment("card", state.formData, cardForm)
  }

  function handleCardFormChange(field: keyof CardFormState, value: string) {
    setCardForm((prev) => ({ ...prev, [field]: value }))
  }

  function formatCardNumber(value: string): string {
    return value
      .replace(/\s/g, "")
      .replace(/(\d{4})/g, "$1 ")
      .trim()
      .slice(0, 19)
  }

  function handleNextAction(
    nextAction: NextAction,
    chargeId: string,
    reference: string,
    slug: string
  ) {
    switch (nextAction.type) {
      case "redirect_url": {
        const url = nextAction.redirect_url?.url
        if (url) {
          window.location.href = url
        } else {
          setState({
            phase: "error",
            message: "Redirect URL missing from payment gateway",
          })
        }
        break
      }
      case "requires_pin":
        setState({ phase: "pin", chargeId, reference, slug })
        break
      case "requires_otp":
        setState({ phase: "otp", chargeId, reference, slug })
        break
      case "payment_instruction":
        setState({
          phase: "instructions",
          instruction:
            (nextAction as { payment_instruction?: PaymentInstruction })
              .payment_instruction || {},
          reference,
          slug,
        })
        break
      case "requires_additional_fields":
        setState({
          phase: "error",
          message: "Additional fields required — not yet implemented",
        })
        break
      default:
        setState({ phase: "error", message: "Unknown payment state" })
    }
  }

  async function handlePinSubmit() {
    if (state.phase !== "pin" || !pinValue) return
    setState({ phase: "authorizing" })

    try {
      const res = await fetch("/api/payments/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chargeId: state.chargeId,
          type: "pin",
          value: pinValue,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setState({
          phase: "error",
          message: json.error || "PIN verification failed",
        })
        return
      }

      if (json.status === "succeeded") {
        setState({ phase: "verifying" })
        redirectToSuccess(state.slug, state.reference)
        return
      }

      handleNextAction(
        json.nextAction as NextAction,
        json.chargeId,
        state.reference,
        state.slug
      )
    } catch {
      setState({ phase: "error", message: "Failed to authorize PIN" })
    }
  }

  async function handleOtpSubmit() {
    if (state.phase !== "otp" || !otpValue) return
    setState({ phase: "authorizing" })

    try {
      const res = await fetch("/api/payments/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chargeId: state.chargeId,
          type: "otp",
          value: otpValue,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setState({
          phase: "error",
          message: json.error || "OTP verification failed",
        })
        return
      }

      if (json.status === "succeeded") {
        setState({ phase: "verifying" })
        redirectToSuccess(state.slug, state.reference)
        return
      }

      handleNextAction(
        json.nextAction as NextAction,
        json.chargeId,
        state.reference,
        state.slug
      )
    } catch {
      setState({ phase: "error", message: "Failed to authorize OTP" })
    }
  }

  function redirectToSuccess(slug: string, reference: string) {
    window.location.href = `/tip/${slug}/success?tx_ref=${reference}`
  }

  function resetToForm() {
    setState({ phase: "form" })
    setPinValue("")
    setOtpValue("")
    setCardForm({ pan: "", expiryMonth: "", expiryYear: "", cvv: "" })
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
            disabled={amount < 100}
            className="w-full bg-black text-white rounded-xl px-4 py-3 text-base font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {amount >= 100
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

      {/* Payment Method Selection Modal */}
      {state.phase === "selecting_method" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <h2 className="text-lg font-semibold text-center mb-5">
              Choose how you want to pay
            </h2>
            <div className="space-y-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.key}
                  type="button"
                  onClick={() => handleMethodSelect(method.key)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="text-xl">{method.icon}</span>
                  <span className="font-medium">{method.label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setState({ phase: "form" })}
              className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Card Details Form */}
      {state.phase === "card_form" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <h2 className="text-lg font-semibold text-center mb-5">
              Enter card details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Card number
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="4242 4242 4242 4242"
                  value={cardForm.pan}
                  onChange={(e) =>
                    handleCardFormChange("pan", formatCardNumber(e.target.value))
                  }
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Expiry
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="MM"
                      maxLength={2}
                      value={cardForm.expiryMonth}
                      onChange={(e) =>
                        handleCardFormChange(
                          "expiryMonth",
                          e.target.value.replace(/\D/g, "").slice(0, 2)
                        )
                      }
                      className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 text-center"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="YY"
                      maxLength={2}
                      value={cardForm.expiryYear}
                      onChange={(e) =>
                        handleCardFormChange(
                          "expiryYear",
                          e.target.value.replace(/\D/g, "").slice(0, 2)
                        )
                      }
                      className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 text-center"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    CVV
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="123"
                    maxLength={4}
                    value={cardForm.cvv}
                    onChange={(e) =>
                      handleCardFormChange(
                        "cvv",
                        e.target.value.replace(/\D/g, "").slice(0, 4)
                      )
                    }
                    className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 text-center"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setState({
                      phase: "selecting_method",
                      formData: state.formData,
                    })
                  }
                  className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCardSubmit}
                  className="flex-1 py-2.5 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {(state.phase === "initiating" || state.phase === "authorizing") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-8 w-full max-w-xs mx-4 shadow-xl text-center">
            <div className="w-10 h-10 border-2 border-gray-300 border-t-black rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-600">
              {state.phase === "initiating"
                ? "Initiating payment..."
                : "Authorizing payment..."}
            </p>
          </div>
        </div>
      )}

      {/* PIN Modal */}
      {state.phase === "pin" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <h2 className="text-lg font-semibold text-center mb-2">
              Enter your PIN
            </h2>
            <p className="text-sm text-gray-500 text-center mb-5">
              Enter the PIN for your card to continue
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoFocus
              placeholder="****"
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
              className="w-full text-center text-2xl tracking-[1em] border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-black/10"
            />
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={resetToForm}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePinSubmit}
                disabled={pinValue.length < 4}
                className="flex-1 py-2.5 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OTP Modal */}
      {state.phase === "otp" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <h2 className="text-lg font-semibold text-center mb-2">
              Enter OTP
            </h2>
            <p className="text-sm text-gray-500 text-center mb-5">
              Enter the one-time password sent to your phone
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              placeholder="123456"
              value={otpValue}
              onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ""))}
              className="w-full text-center text-2xl tracking-[0.5em] border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-black/10"
            />
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={resetToForm}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOtpSubmit}
                disabled={otpValue.length < 4}
                className="flex-1 py-2.5 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Instructions Modal */}
      {state.phase === "instructions" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <h2 className="text-lg font-semibold text-center mb-4">
              Payment Instructions
            </h2>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              {state.instruction.note && (
                <p className="text-gray-600">{state.instruction.note}</p>
              )}
              {state.instruction.bank_name && (
                <p>
                  <span className="font-medium">Bank:</span>{" "}
                  {state.instruction.bank_name}
                </p>
              )}
              {state.instruction.account_number && (
                <p>
                  <span className="font-medium">Account:</span>{" "}
                  {state.instruction.account_number}
                </p>
              )}
              {state.instruction.account_name && (
                <p>
                  <span className="font-medium">Name:</span>{" "}
                  {state.instruction.account_name}
                </p>
              )}
              {state.instruction.ussd_code && (
                <p>
                  <span className="font-medium">USSD Code:</span>{" "}
                  {state.instruction.ussd_code}
                </p>
              )}
              {Object.keys(state.instruction).length === 0 && (
                <p className="text-gray-600">
                  Please complete the payment using your bank or mobile app.
                </p>
              )}
            </div>
            <p className="text-xs text-gray-400 text-center mt-4">
              After completing the payment, click the button below
            </p>
            <button
              type="button"
              onClick={() => redirectToSuccess(state.slug, state.reference)}
              className="w-full mt-3 py-2.5 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800"
            >
              I&apos;ve completed the payment
            </button>
            <button
              type="button"
              onClick={resetToForm}
              className="w-full mt-2 text-sm text-gray-500 hover:text-gray-700 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
