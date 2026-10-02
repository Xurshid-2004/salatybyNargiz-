import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { config } from '../config.js';
import { HttpError } from '../lib/format.js';
import { addClient, broadcast } from '../lib/events.js';
import { adminAuth, checkAdminPassword, signAdminToken } from '../middleware/adminAuth.js';
import { notifyCustomerStatus } from '../bot.js';

const router = Router();

export const uploadsDir = config.uploadsDir
  ? path.resolve(config.uploadsDir)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

// --- Kirish (parol bilan) ---
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: "Urinishlar ko'p. 15 daqiqadan keyin qaytadan urining." },
});

router.post('/login', loginLimiter, (req, res) => {
  const { password } = z.object({ password: z.string().min(1).max(200) }).parse(req.body);
  if (!checkAdminPassword(password)) throw new HttpError(401, "Parol noto'g'ri");
  res.json({ token: signAdminToken() });
});

// --- Real vaqt oqimi (yangi buyurtma kelganda admin panel yangilanadi) ---
router.get('/stream', adminAuth({ allowQuery: true }), (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(': connected\n\n');
  addClient(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  res.on('close', () => clearInterval(ping));
});

router.use(adminAuth());

// --- Buyurtmalar ---
router.get('/orders', async (req, res) => {
  const status = z.enum(['PENDING', 'DELIVERED', 'CANCELLED']).optional().parse(req.query.status || undefined);
  const orders = await prisma.order.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    take: 300,
    include: {
      user: { select: { firstName: true, lastName: true, username: true, telegramId: true } },
    },
  });
  res.json(orders);
});

const orderPatch = z.object({
  status: z.enum(['PENDING', 'DELIVERED', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['UNPAID', 'PAID']).optional(),
});

router.patch('/orders/:id', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const body = orderPatch.parse(req.body);

  let previousStatus;
  const updated = await prisma.$transaction(async (tx) => {
    // Shu payt Payme to'lovni qaytarayotgan bo'lsa, navbat bilan ishlash uchun qatorni qulflaymiz
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
    const current = await tx.order.findUnique({ where: { id } });
    if (!current) throw new HttpError(404, 'Buyurtma topilmadi');
    if (current.paymentStatus === 'REFUNDED') {
      throw new HttpError(400, "Bu buyurtma uchun to'lov mijozga qaytarilgan, uni o'zgartirib bo'lmaydi");
    }
    previousStatus = current.status;

    const data = { ...body };
    const bonus = Math.floor((current.total * config.bonusPercent) / 100);

    if (body.status === 'DELIVERED' && current.status !== 'DELIVERED') {
      if (current.paymentMethod === 'CASH') data.paymentStatus = 'PAID';
      await tx.user.update({ where: { id: current.userId }, data: { bonus: { increment: bonus } } });
    }
    if (body.status && body.status !== 'DELIVERED' && current.status === 'DELIVERED') {
      await tx.user.update({ where: { id: current.userId }, data: { bonus: { decrement: bonus } } });
    }

    return tx.order.update({
      where: { id },
      data,
      include: {
        user: { select: { firstName: true, lastName: true, username: true, telegramId: true, language: true } },
      },
    });
  });

  broadcast('order:update', { id });
  if (updated.status !== previousStatus) notifyCustomerStatus(updated.user, updated).catch(() => {});
  res.json(updated);
});

// --- Mahsulotlar (CRUD) ---
const productInput = z.object({
  name: z.string().trim().min(1, 'Mahsulot nomini kiriting').max(80),
  description: z.string().trim().max(300).default(''),
  price: z.number().int().min(0).max(100_000_000),
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === '' || v.startsWith('/uploads/') || /^https?:\/\//i.test(v), "Rasm manzili noto'g'ri")
    .default(''),
  category: z.enum(['SALADS', 'SAMSA', 'DRINKS', 'COMPOT', 'SAUCES']),
  isActive: z.boolean().default(true),
});

const idParam = (req) => z.coerce.number().int().positive().parse(req.params.id);

router.get('/products', async (req, res) => {
  res.json(await prisma.product.findMany({ orderBy: [{ category: 'asc' }, { id: 'asc' }] }));
});

router.post('/products', async (req, res) => {
  const data = productInput.parse(req.body);
  res.status(201).json(await prisma.product.create({ data }));
});

router.put('/products/:id', async (req, res) => {
  const id = idParam(req);
  const data = productInput.parse(req.body);
  const exists = await prisma.product.findUnique({ where: { id } });
  if (!exists) throw new HttpError(404, 'Mahsulot topilmadi');
  res.json(await prisma.product.update({ where: { id }, data }));
});

router.delete('/products/:id', async (req, res) => {
  const id = idParam(req);
  const exists = await prisma.product.findUnique({ where: { id } });
  if (!exists) throw new HttpError(404, 'Mahsulot topilmadi');
  await prisma.product.delete({ where: { id } });
  res.json({ ok: true });
});

// --- Rasm yuklash ---
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    EXT[file.mimetype] ? cb(null, true) : cb(new HttpError(400, 'Faqat JPG, PNG yoki WEBP rasm yuklang')),
});

router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) throw new HttpError(400, 'Rasm tanlanmadi');
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

export default router;
