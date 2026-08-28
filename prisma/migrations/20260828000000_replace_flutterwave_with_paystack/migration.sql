-- Remove fields from the obsolete Flutterwave integration.
ALTER TABLE "Tip"
DROP COLUMN "flwChargeId",
DROP COLUMN "flutterwaveTransactionId";

-- Add fields used by the active Paystack integration.
ALTER TABLE "Tip"
ADD COLUMN "paystackReference" TEXT,
ADD COLUMN "paystackTransactionId" TEXT;
