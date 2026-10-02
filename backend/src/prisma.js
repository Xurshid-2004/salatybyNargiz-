import './config.js'; // .env avval yuklansin
import { PrismaClient } from '@prisma/client';

// Telegram ID kabi BigInt qiymatlarni JSON ga o'girish uchun
/** @type {any} */ (BigInt.prototype).toJSON = function () {
  return this.toString();
};

export const prisma = new PrismaClient({
  log: ['warn', 'error'],
  // Rasmlar (base64) og'ir: hech qaysi so'rovga o'zi qo'shilmaydi, faqat rasm berish manzillari ularni o'qiydi
  omit: { product: { imageData: true }, paymentIntent: { receiptData: true } },
});
