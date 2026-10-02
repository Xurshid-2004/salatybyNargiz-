-- CreateEnum
CREATE TYPE "ClickStatus" AS ENUM ('PREPARED', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';

-- AlterEnum
ALTER TYPE "IntentStatus" ADD VALUE 'CANCELLED';

-- CreateTable
CREATE TABLE "PaymeTransaction" (
    "id" SERIAL NOT NULL,
    "paymeId" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "state" INTEGER NOT NULL,
    "reason" INTEGER,
    "paymeTime" TIMESTAMP(3) NOT NULL,
    "createTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performTime" TIMESTAMP(3),
    "cancelTime" TIMESTAMP(3),

    CONSTRAINT "PaymeTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickTransaction" (
    "id" SERIAL NOT NULL,
    "clickTransId" TEXT NOT NULL,
    "clickPaydocId" TEXT NOT NULL DEFAULT '',
    "intentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "ClickStatus" NOT NULL DEFAULT 'PREPARED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClickTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymeTransaction_paymeId_key" ON "PaymeTransaction"("paymeId");

-- CreateIndex
CREATE INDEX "PaymeTransaction_intentId_idx" ON "PaymeTransaction"("intentId");

-- CreateIndex
CREATE INDEX "PaymeTransaction_paymeTime_idx" ON "PaymeTransaction"("paymeTime");

-- CreateIndex
CREATE UNIQUE INDEX "ClickTransaction_clickTransId_key" ON "ClickTransaction"("clickTransId");

-- CreateIndex
CREATE INDEX "ClickTransaction_intentId_idx" ON "ClickTransaction"("intentId");

-- AddForeignKey
ALTER TABLE "PaymeTransaction" ADD CONSTRAINT "PaymeTransaction_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "PaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickTransaction" ADD CONSTRAINT "ClickTransaction_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "PaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

