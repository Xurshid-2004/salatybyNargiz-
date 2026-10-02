import { prisma } from '../prisma.js';
import { HttpError } from './format.js';
import { broadcast } from './events.js';
import { afterOrderCreated, fulfillIntent, isIntentExpired } from './orders.js';
import { notifyAdminsCardPayment, notifyCustomerCardRejected } from '../bot.js';

/**
 * Karta orqali oldindan to'lov (P2P o'tkazma).
 * 1. Mijoz buyurtma beradi - PaymentIntent (provider CARD) yaratiladi, buyurtma hali yo'q.
 * 2. Mijoz kartaga o'tkazadi va chekni yuklaydi - adminlarga Telegram va Admin Panel orqali boradi.
 * 3. Admin bank ilovasida pul tushganini ko'rib tasdiqlaydi - shundagina buyurtma "To'langan" bo'lib yaratiladi.
 * Mijoz o'zi to'lovni "to'landi" qila olmaydi.
 */

// Cheklar 30 kundan keyin bazadan o'chiriladi (bepul baza hajmi kichik). Telegram'dagi nusxasi qoladi.
const RECEIPT_KEEP_MS = 30 * 24 * 60 * 60 * 1000;

/** Mijoz to'lov chekini yukladi (qayta yuklasa - almashtiriladi) */
export async function saveReceipt(intentId, user, image) {
  const intent = await prisma.paymentIntent.findFirst({ where: { id: intentId, userId: user.id } });
  if (!intent || intent.provider !== 'CARD') throw new HttpError(404, "To'lov topilmadi");
  if (intent.status === 'PAID') throw new HttpError(409, "To'lov allaqachon tasdiqlangan");
  if (intent.status === 'CANCELLED') {
    throw new HttpError(409, "Bu to'lov bekor qilingan. Buyurtmani qaytadan rasmiylashtiring.");
  }
  if (!intent.receiptAt && isIntentExpired(intent)) {
    throw new HttpError(410, "To'lov muddati tugadi. Buyurtmani qaytadan rasmiylashtiring.");
  }

  const saved = await prisma.paymentIntent.updateMany({
    where: { id: intentId, status: 'PENDING' },
    data: { receiptData: image.data, receiptMime: image.mime, receiptAt: new Date() },
  });
  if (saved.count === 0) throw new HttpError(409, "To'lov holati o'zgardi. Sahifani yangilang.");

  broadcast('payment:new', { id: intentId });
  notifyAdminsCardPayment({ ...intent, user }, image.buffer, Boolean(intent.receiptAt)).catch(() => {});
}

/** Admin tekshirishi kerak bo'lgan to'lovlar (chek yuklanmagan va muddati o'tganlar ko'rsatilmaydi) */
export async function listPendingCardPayments() {
  const intents = await prisma.paymentIntent.findMany({
    where: { provider: 'CARD', status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { firstName: true, lastName: true, username: true } } },
  });
  return intents
    .filter((i) => i.receiptAt || !isIntentExpired(i))
    .map((i) => {
      const payload = /** @type {any} */ (i.payload);
      return {
        id: i.id,
        amount: i.amount,
        createdAt: i.createdAt,
        receiptAt: i.receiptAt,
        items: payload.items,
        deliveryType: payload.deliveryType,
        address: payload.address,
        branch: payload.branch,
        phone: payload.phone,
        user: i.user,
      };
    });
}

async function decisionState(intentId) {
  const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
  if (!intent || intent.provider !== 'CARD') return { status: 'not_found' };
  if (intent.status === 'PAID') return { status: 'already_paid', orderId: intent.orderId };
  if (intent.status === 'CANCELLED') return { status: 'already_cancelled' };
  return { status: 'pending', intent };
}

function purgeOldReceipts() {
  prisma.paymentIntent
    .updateMany({
      where: {
        provider: 'CARD',
        status: { not: 'PENDING' },
        receiptAt: { lt: new Date(Date.now() - RECEIPT_KEEP_MS) },
        receiptData: { not: null },
      },
      data: { receiptData: null },
    })
    .catch((err) => console.error("Eski cheklarni o'chirib bo'lmadi:", err.message));
}

/**
 * Admin: "Pul tushdi". Buyurtma "To'langan" bo'lib yaratiladi, mijoz va adminlarga xabar boradi.
 * Ikki admin bir vaqtda bossa ham bitta buyurtma yaratiladi.
 * status: confirmed | already_paid | already_cancelled | not_found
 */
export async function confirmCardPayment(intentId) {
  const state = await decisionState(intentId);
  if (state.status !== 'pending') return state;

  const order = await prisma.$transaction((tx) => fulfillIntent(tx, intentId));
  if (!order) return decisionState(intentId);

  afterOrderCreated(order);
  broadcast('payment:update', { id: intentId });
  purgeOldReceipts();
  return { status: 'confirmed', orderId: order.id };
}

/**
 * Admin: "Pul tushmadi". To'lov bekor qilinadi, mijozga bot orqali xabar boradi.
 * status: rejected | already_paid | already_cancelled | not_found
 */
export async function rejectCardPayment(intentId) {
  const state = await decisionState(intentId);
  if (state.status !== 'pending') return state;

  const cancelled = await prisma.paymentIntent.updateMany({
    where: { id: intentId, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });
  if (cancelled.count === 0) return decisionState(intentId);

  const user = await prisma.user.findUnique({ where: { id: state.intent.userId } });
  if (user) notifyCustomerCardRejected(user, state.intent).catch(() => {});
  broadcast('payment:update', { id: intentId });
  purgeOldReceipts();
  return { status: 'rejected' };
}
