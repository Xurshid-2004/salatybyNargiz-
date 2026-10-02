-- Karta orqali oldindan to'lov (P2P o'tkazma): mijoz chek yuklaydi, admin tasdiqlaydi
-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'CARD';

-- AlterTable
ALTER TABLE "PaymentIntent" ADD COLUMN     "receiptAt" TIMESTAMP(3),
ADD COLUMN     "receiptData" TEXT,
ADD COLUMN     "receiptMime" TEXT;

-- CreateIndex
CREATE INDEX "PaymentIntent_provider_status_idx" ON "PaymentIntent"("provider", "status");
