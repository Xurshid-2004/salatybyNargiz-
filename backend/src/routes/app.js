import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { config } from '../config.js';
import { HttpError } from '../lib/format.js';
import { orderLimiter } from '../middleware/telegramAuth.js';
import {
  orderInput,
  buildOrderPayload,
  createCashOrder,
  createPaymentIntent,
  confirmPayment,
  isIntentExpired,
} from '../lib/orders.js';
import { availableMethods, paymentMode, paymentUrl } from '../lib/payments.js';

const router = Router();

const publicUser = (u) => ({
  id: u.id,
  telegramId: u.telegramId.toString(),
  firstName: u.firstName,
  lastName: u.lastName,
  username: u.username,
  phone: u.phone,
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

const profileInput = z.object({
  phone: z.string().trim().regex(/^\+?[0-9\s\-()]{7,20}$/, "Telefon raqami noto'g'ri").optional(),
  language: z.enum(['ru', 'uz', 'en']).optional(),
  addresses: z.array(addressSchema).max(10).optional(),
});

router.get('/me', (req, res) => res.json(publicUser(req.user)));

router.patch('/me', async (req, res) => {
  const data = profileInput.parse(req.body);
  const user = await prisma.user.update({ where: { id: req.user.id }, data });
  res.json(publicUser(user));
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
  const mode = paymentMode(input.paymentMethod);
  if (!mode) throw new HttpError(400, "Bu to'lov usuli hozircha mavjud emas. Boshqasini tanlang.");
  const payload = await buildOrderPayload(input);

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
    expired: intent.status === 'PENDING' && isIntentExpired(intent),
  });
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
