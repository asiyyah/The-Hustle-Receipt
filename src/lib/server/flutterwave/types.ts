export interface FlwCustomerName {
  first: string
  middle?: string
  last?: string
}

export interface FlwCustomerAddress {
  city?: string
  country?: string
  line1?: string
  line2?: string
  postal_code?: string
  state?: string
}

export interface FlwCustomerPhone {
  country_code?: string
  number?: string
}

export interface FlwCreateCustomerParams {
  email: string
  name?: FlwCustomerName
  phone?: FlwCustomerPhone
  address?: FlwCustomerAddress
  meta?: Record<string, unknown>
}

export interface FlwCustomerData {
  id: string
  email: string
  name?: FlwCustomerName
  phone?: FlwCustomerPhone
  address?: FlwCustomerAddress
  meta?: Record<string, unknown>
  created_datetime?: string
}

export interface FlwApiResponse<T> {
  status: "success" | "error"
  message: string
  data: T
}

export interface FlwPaymentMethodData {
  id: string
  type: string
  opay?: Record<string, unknown>
  meta?: Record<string, unknown>
  created_datetime?: string
}

export interface FlwInitiateChargeParams {
  amount: number
  currency: string
  reference: string
  customer_id: string
  payment_method_id: string
  redirect_url?: string
  meta?: Record<string, unknown>
}

export interface FlwChargeNextAction {
  type: "pin" | "otp" | "redirect_url" | "avs" | "payment_instruction"
  redirect_url?: { url: string }
  pin?: unknown
  otp?: unknown
  avs?: unknown
  payment_instruction?: { note: string }
}

export interface FlwChargeData {
  id: string
  amount: number
  currency: string
  customer?: string | { id: string; email?: string; name?: FlwCustomerName }
  meta?: Record<string, unknown>
  next_action?: FlwChargeNextAction
  payment_method?: { type: string; id?: string }
  redirect_url?: string
  reference: string
  status: "pending" | "succeeded" | "failed"
  processor_response?: { type: string; code: string }
  created_datetime?: string
}

export interface FlwWebhookPayload {
  webhook_id: string
  timestamp: number
  type: "charge.completed" | "transfer.completed" | string
  data: FlwChargeData
}
