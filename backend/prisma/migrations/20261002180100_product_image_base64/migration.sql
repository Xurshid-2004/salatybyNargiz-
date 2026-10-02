-- Mahsulot rasmi bazada base64 ko'rinishida saqlanadi
-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "imageData" TEXT,
ADD COLUMN     "imageMime" TEXT;
