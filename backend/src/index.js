import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { config } from './config.js';
import { prisma } from './prisma.js';
import { HttpError } from './lib/format.js';
import { startBot, stopBot } from './bot.js';
import { telegramAuth, userLimiter } from './middleware/telegramAuth.js';
import appRoutes from './routes/app.js';
import adminRoutes, { uploadsDir } from './routes/admin.js';
import paymentRoutes from './routes/payments.js';
import { paymentMode } from './lib/payments.js';

const app = express();

// Proksi (kompyuterda Vite, serverda Railway/nginx) ortida haqiqiy IP manzilni X-Forwarded-For dan olamiz
app.set('trust proxy', config.trustProxy);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'script-src': ["'self'", 'https://telegram.org'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        // Telegram Web Mini App'ni iframe ichida ochadi
        'frame-ancestors': ["'self'", 'https://*.telegram.org'],
      },
    },
    xFrameOptions: false, // o'rniga yuqoridagi frame-ancestors ishlaydi
  }),
);

// So'rov shu serverning o'z domenidan keldimi (serverda Mini App va Admin Panel shu yerdan beriladi)
const sameHost = (req, origin) => {
  try {
    return new URL(origin).host === req.get('host');
  } catch {
    return false;
  }
};

// CORS: faqat o'zimizning Mini App va Admin Panel manzillari
app.use(
  '/api',
  cors((req, callback) => {
    const origin = req.get('origin');
    if (!origin || config.corsOrigins.includes(origin) || sameHost(req, origin)) {
      return callback(null, { origin: true });
    }
    callback(new HttpError(403, 'Bu manzildan so‘rov yuborish taqiqlangan (CORS)'));
  }),
);

// Umumiy himoya: bitta IP dan daqiqasiga 600 ta so'rov
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 600,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: "So'rovlar juda ko'p. Bir oz kutib turing." },
  }),
);

// Payme va Click serverlari chaqiradigan manzillar. Body'ni o'zlari o'qiydi, shuning uchun express.json dan oldin.
app.use('/api/payments', paymentRoutes);

app.use(express.json({ limit: '100kb' }));

app.use('/uploads', express.static(uploadsDir, { maxAge: '7d', index: false }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Mini App API: har bir so'rov Telegram imzosi bilan tekshiriladi
app.use('/api/app', telegramAuth, userLimiter, appRoutes);
// Admin Panel API: parol + JWT
app.use('/api/admin', adminRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Topilmadi' }));

// Serverda (npm run build dan keyin) Mini App va Admin Panel shu serverning o'zidan beriladi:
// https://domen/ - Mini App, https://domen/admin/ - Admin Panel
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function serveSpa(urlPath, distDir) {
  if (!fs.existsSync(path.join(distDir, 'index.html'))) return false;
  // Fayl nomlarida hash bor, shuning uchun uzoq kesh xavfsiz; index.html esa har doim yangisi
  app.use(urlPath, express.static(distDir, { index: false, maxAge: '30d', immutable: true }));
  app.get(urlPath === '/' ? /^\/(?!admin(\/|$)|uploads\/).*/ : new RegExp(`^${urlPath}(/.*)?$`), (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(distDir, 'index.html'));
  });
  return true;
}
const servesAdmin = serveSpa('/admin', path.join(rootDir, 'admin/dist'));
const servesMiniapp = serveSpa('/', path.join(rootDir, 'miniapp/dist'));

// Xatoliklar
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.issues[0]?.message || "Ma'lumot noto'g'ri" });
  }
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: "Rasm hajmi 3 MB dan oshmasin" });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: "So'rov juda katta" });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: "Noto'g'ri so'rov" });
  console.error(err);
  res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
});

async function main() {
  try {
    await prisma.$connect();
  } catch (err) {
    console.error("❌ Bazaga ulanib bo'lmadi. DATABASE_URL to'g'rimi? Migratsiya qilinganmi?");
    console.error(err.message);
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`✅ Backend ishga tushdi: http://localhost:${config.port}`);
    if (servesMiniapp) console.log('🌐 Mini App (/) shu serverdan beriladi');
    if (servesAdmin) console.log('🌐 Admin Panel (/admin) shu serverdan beriladi');
  });

  if (config.jwtSecret.length < 32 || config.jwtSecret === 'uzun-tasodifiy-matn') {
    console.warn('⚠️  JWT_SECRET juda qisqa yoki namunadagi qiymat. Kamida 32 belgili tasodifiy matn yozing.');
  }
  if (config.adminPassword.length < 10) {
    console.warn('⚠️  ADMIN_PASSWORD juda qisqa. Kamida 10 belgili murakkab parol qo‘ying.');
  }

  if (!config.adminTelegramIds.length) {
    console.warn('⚠️  ADMIN_TELEGRAM_IDS bo‘sh: buyurtmalar haqida Telegram xabari adminga bormaydi (Admin Panel ishlayveradi).');
  }
  if (config.miniappUrl) {
    console.log(`📱 Mini App manzili: ${config.miniappUrl}`);
  } else {
    console.warn('⚠️  MINIAPP_URL bo‘sh: Mini App manzilini (server domeni yoki ngrok) .env ga yozing, shunda bot Mini App tugmasini ko‘rsatadi.');
  }

  const MODE = { live: 'haqiqiy', test: 'SINOV (pul yechilmaydi)', null: "o'chirilgan" };
  console.log(`💳 Onlayn to'lov: Payme - ${MODE[paymentMode('PAYME')]}, Click - ${MODE[paymentMode('CLICK')]}`);
  if (config.paymentsTestMode) {
    console.warn("⚠️  PAYMENTS_TEST_MODE=true: kalitlari yozilmagan to'lov tizimi pulsiz tasdiqlanadi. Serverda buni o'chiring!");
  }

  await startBot();

  const shutdown = async (signal) => {
    stopBot(signal);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main();
