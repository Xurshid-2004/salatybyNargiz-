import rateLimit from 'express-rate-limit';
import { prisma } from '../prisma.js';
import { config } from '../config.js';
import { validateInitData } from '../lib/telegram.js';
import { pickLang } from '../bot.js';

/**
 * Mini App dan keladigan HAR BIR so'rov Telegram imzosi (initData) bilan tekshiriladi.
 * Imzo noto'g'ri bo'lsa - 401. Soxta foydalanuvchilar o'ta olmaydi.
 */
export async function telegramAuth(req, res, next) {
  const initData = req.get('x-telegram-init-data');
  if (!initData || initData.length > 8192) {
    return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi. Ilovani Telegram ichidan oching.' });
  }
  const tg = validateInitData(initData, config.botToken);
  if (!tg) {
    return res.status(401).json({ error: "Telegram imzosi noto'g'ri yoki eskirgan. Ilovani qaytadan oching." });
  }

  req.user = await prisma.user.upsert({
    where: { telegramId: BigInt(tg.id) },
    update: {
      firstName: String(tg.first_name || 'Mijoz').slice(0, 100),
      lastName: tg.last_name ? String(tg.last_name).slice(0, 100) : null,
      username: tg.username ? String(tg.username).slice(0, 100) : null,
    },
    create: {
      telegramId: BigInt(tg.id),
      firstName: String(tg.first_name || 'Mijoz').slice(0, 100),
      lastName: tg.last_name ? String(tg.last_name).slice(0, 100) : null,
      username: tg.username ? String(tg.username).slice(0, 100) : null,
      language: pickLang(tg.language_code),
    },
  });
  next();
}

const tooMany = { error: "So'rovlar juda ko'p. Bir oz kutib, qaytadan urinib ko'ring." };

// Foydalanuvchi bo'yicha: daqiqasiga 120 ta so'rov
export const userLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user.id}`,
  message: tooMany,
});

// Buyurtma berish: daqiqasiga 10 ta
export const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `order:${req.user.id}`,
  message: tooMany,
});
