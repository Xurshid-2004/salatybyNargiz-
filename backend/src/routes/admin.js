import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { config } from '../config.js';
import { HttpError } from '../lib/format.js';
import { addClient, broadcast } from '../lib/events.js';
import { imageUpload, readUploadedImage } from '../lib/images.js';
import { confirmCardPayment, listPendingCardPayments, rejectCardPayment } from '../lib/cardPayments.js';
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
    .refine(
      (v) => v === '' || v.startsWith('/api/images/') || v.startsWith('/uploads/') || /^https?:\/\//i.test(v),
      "Rasm manzili noto'g'ri",
    )
    .default(''),
  category: z.enum(['SALADS', 'SAMSA', 'DRINKS', 'COMPOT', 'SAUCES']),
  isActive: z.boolean().default(true),
});

const idParam = (req) => z.coerce.number().int().positive().parse(req.params.id);

router.get('/products', async (req, res) => {
  res.json(await prisma.product.findMany({ orderBy: [{ category: 'asc' }, { id: 'asc' }] }));
});

router.post('/products', async (req, res) => {
  const data = /** @type {import('@prisma/client').Prisma.ProductCreateInput} */ (productInput.parse(req.body));
  res.status(201).json(await prisma.product.create({ data }));
});

router.put('/products/:id', async (req, res) => {
  const id = idParam(req);
  const data = productInput.parse(req.body);
  const exists = await prisma.product.findUnique({ where: { id } });
  if (!exists) throw new HttpError(404, 'Mahsulot topilmadi');
  // Rasm o'chirildi yoki havola bilan almashtirildi - bazadagi eski rasm ham o'chadi
  if (data.imageUrl !== exists.imageUrl) Object.assign(data, { imageData: null, imageMime: null });
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
// Rasm diskka emas, bazaga base64 ko'rinishida yoziladi: server qayta ishga tushsa ham o'chmaydi.
router.post('/products/:id/image', imageUpload, async (req, res) => {
  const id = idParam(req);
  const image = readUploadedImage(req.file);

  const exists = await prisma.product.findUnique({ where: { id } });
  if (!exists) throw new HttpError(404, 'Mahsulot topilmadi');

  const version = crypto.createHash('sha256').update(image.buffer).digest('hex').slice(0, 12);
  const product = await prisma.product.update({
    where: { id },
    data: { imageData: image.data, imageMime: image.mime, imageUrl: `/api/images/products/${id}?v=${version}` },
  });
  res.json(product);
});

// --- Karta orqali to'lovlar: admin kartaga pul tushganini tekshirib tasdiqlaydi ---
const intentParam = (req) => z.string().uuid().parse(req.params.id);

router.get('/card-payments', async (req, res) => {
  res.json(await listPendingCardPayments());
});

// Chek rasmi. Admin Panel uni Authorization sarlavhasi bilan so'raydi (manzilda token yo'q).
router.get('/card-payments/:id/receipt', async (req, res) => {
  const intent = await prisma.paymentIntent.findFirst({
    where: { id: intentParam(req), provider: 'CARD' },
    omit: { receiptData: false },
  });
  if (!intent?.receiptData || !intent.receiptMime) throw new HttpError(404, 'Chek topilmadi');
  res.set({ 'Content-Type': intent.receiptMime, 'Cache-Control': 'private, max-age=3600' });
  res.send(Buffer.from(intent.receiptData, 'base64'));
});

const DECISION_ERRORS = {
  not_found: [404, "To'lov topilmadi"],
  already_cancelled: [409, "Bu to'lov allaqachon rad etilgan"],
  already_paid: [409, "Bu to'lov allaqachon tasdiqlangan"],
};

router.post('/card-payments/:id/confirm', async (req, res) => {
  const result = await confirmCardPayment(intentParam(req));
  if (result.status !== 'confirmed' && result.status !== 'already_paid') throw new HttpError(...DECISION_ERRORS[result.status]);
  res.json(result);
});

router.post('/card-payments/:id/reject', async (req, res) => {
  const result = await rejectCardPayment(intentParam(req));
  if (result.status !== 'rejected' && result.status !== 'already_cancelled') throw new HttpError(...DECISION_ERRORS[result.status]);
  res.json(result);
});

export default router;
