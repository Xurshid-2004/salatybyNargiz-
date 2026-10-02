import { z } from 'zod';
import { prisma } from '../prisma.js';
import { config } from '../config.js';
import { HttpError } from './format.js';
import { broadcast } from './events.js';
import { notifyAdmins, notifyCustomer } from '../bot.js';

const INTENT_TTL_MS = 30 * 60 * 1000;

export const orderInput = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.number().int().positive(),
          qty: z.number().int().min(1).max(50),
        }),
      )
      .min(1)
      .max(60),
    deliveryType: z.enum(['DELIVERY', 'PICKUP']),
    address: z.string().trim().max(300).default(''),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    branchId: z.string().max(40).optional(),
    phone: z.string().trim().regex(/^\+?[0-9\s\-()]{7,20}$/, "Telefon raqami noto'g'ri"),
    paymentMethod: z.enum(['CASH', 'CLICK', 'PAYME']),
  })
  .refine((d) => d.deliveryType !== 'DELIVERY' || d.address.length >= 5, {
    message: 'Yetkazib berish manzilini kiriting',
    path: ['address'],
  });

/**
 * Mijozdan kelgan ma'lumotni tekshiradi va narxlarni BAZADAN hisoblaydi.
 * Mijoz yuborgan narx/summaga hech qachon ishonilmaydi.
 */
export async function buildOrderPayload(input) {
  const qtyById = new Map();
  for (const it of input.items) {
    qtyById.set(it.productId, (qtyById.get(it.productId) || 0) + it.qty);
  }
  const ids = [...qtyById.keys()];

  const products = await prisma.product.findMany({ where: { id: { in: ids }, isActive: true } });
  if (products.length !== ids.length) {
    throw new HttpError(400, "Savatdagi ba'zi mahsulotlar endi mavjud emas. Savatni yangilang.");
  }
  const byId = new Map(products.map((p) => [p.id, p]));

  const items = ids.map((id) => {
    const p = byId.get(id);
    const qty = qtyById.get(id);
    if (qty > 99) throw new HttpError(400, 'Bitta mahsulotdan juda ko‘p buyurtma qilindi');
    return { productId: p.id, name: p.name, price: p.price, qty };
  });
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  let branch = null;
  let address = input.address;
  if (input.deliveryType === 'PICKUP') {
    const b = config.branches.find((x) => x.id === input.branchId) || config.branches[0];
    branch = b.name;
    address = b.address;
  }

  return {
    items,
    total,
    deliveryType: input.deliveryType,
    address,
    latitude: input.deliveryType === 'DELIVERY' ? (input.latitude ?? null) : null,
    longitude: input.deliveryType === 'DELIVERY' ? (input.longitude ?? null) : null,
    branch,
    phone: input.phone,
    paymentMethod: input.paymentMethod,
  };
}

function orderData(userId, p, paymentStatus) {
  return {
    userId,
    items: p.items,
    total: p.total,
    deliveryType: p.deliveryType,
    address: p.address || '',
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    branch: p.branch ?? null,
    phone: p.phone,
    paymentMethod: p.paymentMethod,
    paymentStatus,
  };
}

// Buyurtma bazaga tushgandan keyin: admin panelga signal, mijoz va adminlarga xabar
export function afterOrderCreated(order) {
  broadcast('order:new', { id: order.id });
  notifyCustomer(order.user).catch(() => {});
  notifyAdmins(order).catch(() => {});
}

/** Naqd to'lovli buyurtma: darhol bazaga yoziladi */
export async function createCashOrder(user, payload) {
  const order = await prisma.order.create({
    data: orderData(user.id, payload, 'UNPAID'),
    include: { user: true },
  });
  await prisma.user.update({ where: { id: user.id }, data: { phone: payload.phone } });
  afterOrderCreated(order);
  return order;
}

/** Onlayn to'lov: buyurtma to'lov tasdiqlanguncha "kutish" jadvalida turadi */
export async function createPaymentIntent(user, payload) {
  return prisma.paymentIntent.create({
    data: {
      userId: user.id,
      payload,
      amount: payload.total,
      provider: payload.paymentMethod,
    },
  });
}

/** To'lov muddati o'tganmi (shundan keyin yangi to'lov boshlab bo'lmaydi) */
export function isIntentExpired(intent) {
  return Date.now() - intent.createdAt.getTime() > INTENT_TTL_MS;
}

/**
 * To'lov tasdiqlanganda chaqiriladi: buyurtma endi bazaga yoziladi.
 * Tashqi tranzaksiya (tx) ichida ishlaydi, shunda to'lov holati va buyurtma birga saqlanadi.
 * Intent allaqachon to'langan yoki bekor qilingan bo'lsa null qaytaradi - ikkinchi buyurtma yaratilmaydi.
 */
export async function fulfillIntent(tx, intentId) {
  const claimed = await tx.paymentIntent.updateMany({
    where: { id: intentId, status: 'PENDING' },
    data: { status: 'PAID' },
  });
  if (claimed.count === 0) return null;

  const intent = await tx.paymentIntent.findUnique({ where: { id: intentId } });
  const created = await tx.order.create({
    data: orderData(intent.userId, intent.payload, 'PAID'),
    include: { user: true },
  });
  await tx.paymentIntent.update({ where: { id: intentId }, data: { orderId: created.id } });
  await tx.user.update({ where: { id: intent.userId }, data: { phone: intent.payload.phone } });
  return created;
}

/**
 * Sinov rejimidagi "To'lovni tasdiqlash" tugmasi. Pul yechilmaydi.
 * Ikki marta chaqirilsa ham bitta buyurtma yaratiladi.
 */
export async function confirmPayment(intentId, userId) {
  const intent = await prisma.paymentIntent.findFirst({ where: { id: intentId, userId } });
  if (!intent) throw new HttpError(404, "To'lov topilmadi");
  if (intent.status === 'PAID') return { orderId: intent.orderId };
  if (intent.status === 'CANCELLED' || isIntentExpired(intent)) {
    throw new HttpError(410, "To'lov muddati tugadi. Buyurtmani qaytadan rasmiylashtiring.");
  }

  const order = await prisma.$transaction((tx) => fulfillIntent(tx, intentId));

  if (!order) {
    const fresh = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
    return { orderId: fresh?.orderId ?? null };
  }
  afterOrderCreated(order);
  return { orderId: order.id };
}
