-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "creatorSlug" TEXT NOT NULL,
    "avatar" TEXT,
    "bio" TEXT,
    "twitter" TEXT,
    "instagram" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Tip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "supporterName" TEXT,
    "supporterEmail" TEXT NOT NULL,
    "message" TEXT,
    "transactionReference" TEXT NOT NULL,
    "flutterwaveTransactionId" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "creatorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tip_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_creatorSlug_key" ON "User"("creatorSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Tip_transactionReference_key" ON "Tip"("transactionReference");
