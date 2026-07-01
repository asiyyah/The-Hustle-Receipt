/*
  Warnings:

  - Added the required column `paymentMethod` to the `Tip` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Tip" ADD COLUMN     "flwChargeId" TEXT,
ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'card';

-- Backfill: remove default after applying
ALTER TABLE "Tip" ALTER COLUMN "paymentMethod" DROP DEFAULT;
