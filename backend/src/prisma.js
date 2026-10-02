import './config.js'; // .env avval yuklansin
import { PrismaClient } from '@prisma/client';

// Telegram ID kabi BigInt qiymatlarni JSON ga o'girish uchun
BigInt.prototype.toJSON = function () {
  return this.toString();
};

export const prisma = new PrismaClient({ log: ['warn', 'error'] });
