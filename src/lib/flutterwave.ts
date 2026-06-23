const FLW_BASE = "https://api.flutterwave.com/v3"
const FLW_SECRET = process.env.FLWSECK_TEST || ""

export async function initiatePayment(params: {
  amount: number
  currency: string
  customerEmail: string
  customerName?: string
  redirectUrl: string
  txRef: string
}) {
  const response = await fetch(`${FLW_BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FLW_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: params.txRef,
      amount: params.amount,
      currency: params.currency,
      redirect_url: params.redirectUrl,
      customer: {
        email: params.customerEmail,
        name: params.customerName || "Supporter",
      },
      customizations: {
        title: "The Hustle Receipt",
        description: "Support a creator",
      },
      payment_options: "card, ussd, banktransfer",
    }),
  })

  return response.json()
}

export async function verifyTransaction(transactionId: string) {
  const response = await fetch(
    `${FLW_BASE}/transactions/${transactionId}/verify`,
    {
      headers: {
        Authorization: `Bearer ${FLW_SECRET}`,
        "Content-Type": "application/json",
      },
    }
  )

  return response.json()
}
