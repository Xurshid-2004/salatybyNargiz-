import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { config } from '../config.js';
import { HttpError } from '../lib/format.js';
import { validateContact } from '../lib/telegram.js';
import { normalizePhone, isRegistered } from '../lib/phone.js';
import { orderLimiter, phoneLimiter } from '../middleware/telegramAuth.js';
import { requestPhoneInChat } from '../bot.js';
import {
  orderInput,
  buildOrderPayload,
  createCashOrder,
  createPaymentIntent,
  confirmPayment,
  isIntentExpired,
} from '../lib/orders.js';
import { availableMethods, paymentMode, paymentUrl, transferCard } from '../lib/payments.js';
import { imageUpload, readUploadedImage } from '../lib/images.js';
import { saveReceipt } from '../lib/cardPayments.js';

const router = Router();

const publicUser = (u) => ({
  id: u.id,
  telegramId: u.telegramId.toString(),
  firstName: u.firstName,
  lastName: u.lastName,
  username: u.username,
  phone: u.phone,
  phoneVerified: isRegistered(u),
  language: u.language,
  bonus: u.bonus,
  addresses: u.addresses,
});

const addressSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().trim().max(60).default(''),
  address: z.string().trim().min(1).max(300),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

// Telefon raqam bu yerda o'zgartirilmaydi: u faqat Telegram orqali tasdiqlanadi (/auth/contact)
const profileInput = z.object({
  language: z.enum(['ru', 'uz', 'en']).optional(),
  addresses: z.array(addressSchema).max(10).optional(),
});

router.get('/me', (req, res) => res.json(publicUser(req.user)));

router.patch('/me', async (req, res) => {
  const data = profileInput.parse(req.body);
  const user = await prisma.user.update({ where: { id: req.user.id }, data });
  res.json(publicUser(user));
});

// --- Ro'yxatdan o'tish: telefon raqam Telegram orqali tasdiqlanadi ---

// Mini App Telegram.WebApp.requestContact() javobini yuboradi. Uni Telegram imzolagan,
// shuning uchun mijoz boshqa raqamni yozib yubora olmaydi.
router.post('/auth/contact', phoneLimiter, async (req, res) => {
  const { response } = z.object({ response: z.string().min(1).max(4096) }).parse(req.body);
  const contact = validateContact(response, config.botToken);
  if (!contact) throw new HttpError(400, "Raqamni tasdiqlab bo'lmadi. Qaytadan urinib ko'ring.");
  if (BigInt(contact.user_id) !== req.user.telegramId) {
    throw new HttpError(403, "Faqat o'zingizning raqamingizni yuborishingiz mumkin");
  }
  const phone = normalizePhone(contact.phone_number);
  if (!phone) throw new HttpError(400, "Telefon raqami noto'g'ri");

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { phone, phoneVerifiedAt: new Date() },
  });
  res.json(publicUser(user));
});

// Zaxira yo'l (eski Telegram ilovalari uchun): bot chatga "Raqamni yuborish" tugmasini yuboradi.
// Mijoz tugmani bossa, raqamni bot qabul qiladi va tasdiqlaydi (bot.js).
router.post('/auth/contact-request', phoneLimiter, async (req, res) => {
  if (isRegistered(req.user)) return res.json({ ok: true });
  try {
    await requestPhoneInChat(req.user);
  } catch {
    throw new HttpError(409, "Bot chatiga xabar yuborib bo'lmadi. Botni oching, /start bosing va qaytadan urinib ko'ring.");
  }
  res.json({ ok: true });
});

router.get('/config', (req, res) => {
  res.json({
    branches: config.branches,
    workHours: config.workHours,
    paymentMethods: availableMethods(),
  });
});

router.get('/products', async (req, res) => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, description: true, price: true, imageUrl: true, category: true },
  });
  res.json(products);
});

router.get('/orders', async (req, res) => {
  const activeOnly = req.query.active === '1';
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id, ...(activeOnly ? { status: 'PENDING' } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      items: true,
      total: true,
      deliveryType: true,
      address: true,
      paymentMethod: true,
      paymentStatus: true,
      status: true,
      createdAt: true,
    },
  });
  res.json(orders);
});

router.post('/orders', orderLimiter, async (req, res) => {
  const input = orderInput.parse(req.body);
  if (!isRegistered(req.user)) {
    throw new HttpError(403, 'Buyurtma berish uchun avval telefon raqamingizni tasdiqlang', 'PHONE_REQUIRED');
  }
  const mode = paymentMode(input.paymentMethod);
  if (!mode) throw new HttpError(400, "Bu to'lov usuli hozircha mavjud emas. Boshqasini tanlang.");
  const payload = await buildOrderPayload(input, req.user.phone);

  if (payload.paymentMethod === 'CASH') {
    const order = await createCashOrder(req.user, payload);
    return res.status(201).json({ order: { id: order.id, total: order.total } });
  }

  const intent = await createPaymentIntent(req.user, payload);
  res.status(201).json({
    payment: {
      id: intent.id,
      provider: intent.provider,
      amount: intent.amount,
      testMode: mode === 'test',
      payUrl: paymentUrl(intent, req.user),
      // Karta orqali to'lov: mijoz shu kartaga o'tkazadi va chek yuklaydi
      card: intent.provider === 'CARD' ? transferCard() : null,
    },
  });
});

router.get('/payments/:id', async (req, res) => {
  const intent = await prisma.paymentIntent.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!intent) throw new HttpError(404, "To'lov topilmadi");
  res.json({
    id: intent.id,
    status: intent.status,
    orderId: intent.orderId,
    amount: intent.amount,
    receiptUploaded: Boolean(intent.receiptAt),
    // Chek yuklangan bo'lsa, admin qarorini kutadi - muddati o'tmaydi
    expired: intent.status === 'PENDING' && !intent.receiptAt && isIntentExpired(intent),
  });
});

// Karta orqali to'lov: mijoz to'lov chekini (skrinshot) yuklaydi. Buyurtmani admin tasdiqlagandan keyin yaratiladi.
router.post('/payments/:id/receipt', orderLimiter, imageUpload, async (req, res) => {
  const image = readUploadedImage(req.file);
  await saveReceipt(req.params.id, req.user, image);
  res.json({ ok: true, receiptUploaded: true });
});

// Sinov rejimi: "To'lovni tasdiqlash" tugmasi. Kalitlari yozilgan to'lov tizimi uchun ishlamaydi.
router.post('/payments/:id/confirm-test', orderLimiter, async (req, res) => {
  const intent = await prisma.paymentIntent.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!intent) throw new HttpError(404, "To'lov topilmadi");
  if (paymentMode(intent.provider) !== 'test') {
    throw new HttpError(403, "Sinov to'lovi o'chirilgan");
  }
  const result = await confirmPayment(intent.id, req.user.id);
  res.json(result);
});

export default router;
