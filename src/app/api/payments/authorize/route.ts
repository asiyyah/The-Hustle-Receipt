import { NextRequest } from "next/server"
import { updateCharge, generateNonce, encryptAES } from "@/lib/flutterwave"

export async function POST(request: NextRequest) {
  try {
    const { chargeId, type, value } = await request.json()

    if (!chargeId || !type || !value) {
      return Response.json(
        { error: "Missing required fields: chargeId, type, value" },
        { status: 400 }
      )
    }

    let authorization

    switch (type) {
      case "pin": {
        const nonce = generateNonce()
        const encryptedPin = encryptAES(value, nonce)
        authorization = {
          type: "pin" as const,
          pin: { nonce, encrypted_pin: encryptedPin },
        }
        break
      }
      case "otp": {
        authorization = {
          type: "otp" as const,
          otp: { code: value },
        }
        break
      }
      default:
        return Response.json(
          { error: `Unsupported authorization type: ${type}` },
          { status: 400 }
        )
    }

    const result = await updateCharge(chargeId, { authorization })

    return Response.json({
      nextAction: result.data.next_action,
      chargeId: result.data.id,
      status: result.data.status,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Authorize payment error:", message)
    return Response.json(
      { error: "Authorization failed", detail: message },
      { status: 500 }
    )
  }
}
