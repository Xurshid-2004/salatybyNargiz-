import { prisma } from '../prisma.js';
import { config } from '../config.js';
import { safeEqual } from './format.js';
import { broadcast } from './events.js';
import { afterOrderCreated, fulfillIntent, isIntentExpired } from './orders.js';
import { notifyAdminsRefund } from '../bot.js';

/*
 * Payme Merchant API (JSON-RPC 2.0): Payme serveri POST /api/payments/payme ga so'rov yuboradi.
 * Hujjat: https://developer.help.paycom.uz/metody-merchant-api/
 * Payme'da summa tiyinda (1 so'm = 100 tiyin), vaqt millisekundda. Javob har doim HTTP 200.
 */

const TIMEOUT_MS = 12 * 60 * 60 * 1000; // yaratilgan tranzaksiya 12 soatda bajarilmasa bekor qilinadi
const STATE = { CREATED: 1, PERFORMED: 2, CANCELLED: -1, CANCELLED_AFTER_PERFORM: -2 };
const REASON_TIMEOUT = 4;

const text = (uz, ru, en) => ({ uz, ru, en });
const MSG = {
  auth: text('Avtorizatsiya xatosi', 'Ошибка авторизации', 'Authorization failed'),
  parse: text("JSON noto'g'ri", 'Ошибка разбора JSON', 'Parse error'),
  invalid: text("So'rov noto'g'ri", 'Неверный запрос', 'Invalid request'),
  method: text('Metod topilmadi', 'Метод не найден', 'Method not found'),
  system: text('Tizim xatosi', 'Системная ошибка', 'System error'),
  amount: text("Summa noto'g'ri", 'Неверная сумма', 'Incorrect amount'),
  notFound: text('Buyurtma topilmadi', 'Заказ не найден', 'Order not found'),
  notPayable: text(
    "Buyurtmani to'lab bo'lmaydi: u to'langan, bekor qilingan yoki muddati o'tgan",
    'Заказ нельзя оплатить: он оплачен, отменён или просрочен',
    'Order cannot be paid: it is paid, cancelled or expired',
  ),
  busy: text(
    "Bu buyurtma uchun boshqa to'lov jarayonda",
    'Заказ ожидает оплаты другой транзакцией',
    'Another transaction is in progress for this order',
  ),
  txNotFound: text('Tranzaksiya topilmadi', 'Транзакция не найдена', 'Transaction not found'),
  cannotPerform: text("Amalni bajarib bo'lmaydi", 'Невозможно выполнить операцию', 'Unable to perform operation'),
  cannotCancel: text(
    "Buyurtma yetkazib berilgan, to'lovni bekor qilib bo'lmaydi",
    'Заказ доставлен, отмена невозможна',
    'Order is delivered and cannot be cancelled',
  ),
};

class PaymeError extends Error {
  constructor(code, message, data) {
    super(message.en);
    this.code = code;
    this.localized = message;
    this.data = data;
  }
}

const accountError = (code, message) => new PaymeError(code, message, config.payme.accountField);
const cannotPerform = () => new PaymeError(-31008, MSG.cannotPerform);
const ms = (date) => (date ? date.getTime() : 0);

// Payme so'rovni "Basic base64(Paycom:KALIT)" sarlavhasi bilan yuboradi
function checkAuth(header) {
  const match = /^Basic\s+(.+)$/i.exec(header || '');
  if (!match || !config.payme.key) return false;
  const decoded = Buffer.from(match[1], 'base64').toString('utf8');
  const sep = decoded.indexOf(':');
  return sep > 0 && decoded.slice(0, sep) === 'Paycom' && safeEqual(decoded.slice(sep + 1), config.payme.key);
}

async function findIntent(params) {
  const intentId = params.account?.[config.payme.accountField];
  if (typeof intentId !== 'string' || !intentId || intentId.length > 64) throw accountError(-31050, MSG.notFound);
  const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
  if (!intent || intent.provider !== 'PAYME') throw accountError(-31050, MSG.notFound);
  return intent;
}

function assertPayable(intent, amount) {
  if (amount !== intent.amount * 100) throw new PaymeError(-31001, MSG.amount);
  if (intent.status !== 'PENDING' || isIntentExpired(intent)) throw accountError(-31051, MSG.notPayable);
}

async function findTransaction(params) {
  const paymeId = typeof params.id === 'string' ? params.id : '';
  const trx = paymeId ? await prisma.paymeTransaction.findUnique({ where: { paymeId } }) : null;
  if (!trx) throw new PaymeError(-31003, MSG.txNotFound);
  return trx;
}

// To'lanmagan tranzaksiyani bekor qilish. Buyurtma ham bekor bo'ladi: mijoz uni qaytadan rasmiylashtiradi.
async function cancelCreated(trx, reason) {
  await prisma.$transaction([
    prisma.paymeTransaction.updateMany({
      where: { id: trx.id, state: STATE.CREATED },
      data: { state: STATE.CANCELLED, reason, cancelTime: new Date() },
    }),
    prisma.paymentIntent.updateMany({
      where: { id: trx.intentId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    }),
  ]);
}

async function cancelIfTimedOut(trx) {
  if (trx.state !== STATE.CREATED || Date.now() - trx.createTime.getTime() <= TIMEOUT_MS) return false;
  await cancelCreated(trx, REASON_TIMEOUT);
  return true;
}

const methods = {
  async CheckPerformTransaction(params) {
    const intent = await findIntent(params);
    assertPayable(intent, params.amount);
    const active = await prisma.paymeTransaction.findFirst({
      where: { intentId: intent.id, state: { in: [STATE.CREATED, STATE.PERFORMED] } },
    });
    if (active) throw accountError(-31052, MSG.busy);
    return { allow: true };
  },

  async CreateTransaction(params) {
    const paymeId = typeof params.id === 'string' ? params.id : '';
    if (!paymeId || !Number.isInteger(params.time)) throw new PaymeError(-32600, MSG.invalid);

    const existing = await prisma.paymeTransaction.findUnique({ where: { paymeId } });
    if (existing) {
      if (existing.state !== STATE.CREATED) throw cannotPerform();
      if (await cancelIfTimedOut(existing)) throw cannotPerform();
      return { create_time: ms(existing.createTime), transaction: String(existing.id), state: existing.state };
    }

    const intent = await findIntent(params);
    assertPayable(intent, params.amount);
    if (Date.now() - params.time > TIMEOUT_MS) throw cannotPerform();

    const created = await prisma.$transaction(async (tx) => {
      // Bir vaqtda kelgan ikki so'rov bitta buyurtmaga ikkita tranzaksiya ochmasligi uchun qulf
      await tx.$queryRaw`SELECT id FROM "PaymentIntent" WHERE id = ${intent.id} FOR UPDATE`;
      const active = await tx.paymeTransaction.findFirst({
        where: { intentId: intent.id, state: { in: [STATE.CREATED, STATE.PERFORMED] } },
      });
      if (active) throw accountError(-31052, MSG.busy);
      return tx.paymeTransaction.create({
        data: {
          paymeId,
          intentId: intent.id,
          amount: intent.amount,
          state: STATE.CREATED,
          paymeTime: new Date(params.time),
        },
      });
    });
    return { create_time: ms(created.createTime), transaction: String(created.id), state: created.state };
  },

  async PerformTransaction(params) {
    const trx = await findTransaction(params);

    if (trx.state === STATE.CREATED) {
      if (await cancelIfTimedOut(trx)) throw cannotPerform();
      // To'lov holati va buyurtma bitta tranzaksiyada saqlanadi: yo ikkalasi, yo hech biri
      const order = await prisma.$transaction(async (tx) => {
        const claimed = await tx.paymeTransaction.updateMany({
          where: { id: trx.id, state: STATE.CREATED },
          data: { state: STATE.PERFORMED, performTime: new Date() },
        });
        if (claimed.count === 0) return null; // parallel so'rov allaqachon bajardi
        const created = await fulfillIntent(tx, trx.intentId);
        if (!created) throw cannotPerform();
        return created;
      });
      if (order) afterOrderCreated(order);
    }

    const fresh = await prisma.paymeTransaction.findUnique({ where: { id: trx.id } });
    if (fresh.state !== STATE.PERFORMED) throw cannotPerform();
    return { transaction: String(fresh.id), perform_time: ms(fresh.performTime), state: fresh.state };
  },

  async CancelTransaction(params) {
    let trx = await findTransaction(params);
    const reason = Number.isInteger(params.reason) ? params.reason : null;

    if (trx.state === STATE.CREATED) {
      await cancelCreated(trx, reason);
      // Shu payt PerformTransaction ulgurgan bo'lishi mumkin - holatni qayta o'qiymiz
      trx = await prisma.paymeTransaction.findUnique({ where: { id: trx.id } });
    }

    if (trx.state === STATE.PERFORMED) {
      const refunded = await prisma.$transaction(async (tx) => {
        const intent = await tx.paymentIntent.findUnique({ where: { id: trx.intentId } });
        if (intent.orderId) {
          // Admin shu payt buyurtmani "Yetkazildi" qilib qo'ymasligi uchun qatorni qulflaymiz
          await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${intent.orderId} FOR UPDATE`;
          const order = await tx.order.findUnique({ where: { id: intent.orderId } });
          if (order.status === 'DELIVERED') throw new PaymeError(-31007, MSG.cannotCancel);
        }
        const claimed = await tx.paymeTransaction.updateMany({
          where: { id: trx.id, state: STATE.PERFORMED },
          data: { state: STATE.CANCELLED_AFTER_PERFORM, reason, cancelTime: new Date() },
        });
        if (claimed.count === 0 || !intent.orderId) return null;
        return tx.order.update({
          where: { id: intent.orderId },
          data: { status: 'CANCELLED', paymentStatus: 'REFUNDED' },
        });
      });
      if (refunded) {
        broadcast('order:update', { id: refunded.id });
        notifyAdminsRefund(refunded).catch(() => {});
      }
    }

    const fresh = await prisma.paymeTransaction.findUnique({ where: { id: trx.id } });
    return { transaction: String(fresh.id), cancel_time: ms(fresh.cancelTime), state: fresh.state };
  },

  async CheckTransaction(params) {
    const trx = await findTransaction(params);
    return {
      create_time: ms(trx.createTime),
      perform_time: ms(trx.performTime),
      cancel_time: ms(trx.cancelTime),
      transaction: String(trx.id),
      state: trx.state,
      reason: trx.reason,
    };
  },

  async GetStatement(params) {
    if (!Number.isInteger(params.from) || !Number.isInteger(params.to)) throw new PaymeError(-32600, MSG.invalid);
    const list = await prisma.paymeTransaction.findMany({
      where: { paymeTime: { gte: new Date(params.from), lte: new Date(params.to) } },
      orderBy: { paymeTime: 'asc' },
    });
    return {
      transactions: list.map((t) => ({
        id: t.paymeId,
        time: ms(t.paymeTime),
        amount: t.amount * 100,
        account: { [config.payme.accountField]: t.intentId },
        create_time: ms(t.createTime),
        perform_time: ms(t.performTime),
        cancel_time: ms(t.cancelTime),
        transaction: String(t.id),
        state: t.state,
        reason: t.reason,
      })),
    };
  },
};

const fail = (id, code, message, data) => ({
  jsonrpc: '2.0',
  id,
  error: { code, message, ...(data !== undefined ? { data } : {}) },
});

/** Payme serveridan kelgan JSON-RPC so'rovni bajaradi va javob obyektini qaytaradi */
export async function handlePayme(authHeader, rawBody) {
  let request;
  try {
    request = JSON.parse(rawBody);
  } catch {
    return fail(null, -32700, MSG.parse);
  }
  const id = request?.id ?? null;

  if (!checkAuth(authHeader)) return fail(id, -32504, MSG.auth);
  if (typeof request?.method !== 'string' || !request.params || typeof request.params !== 'object') {
    return fail(id, -32600, MSG.invalid);
  }
  const method = Object.hasOwn(methods, request.method) ? methods[request.method] : null;
  if (!method) return fail(id, -32601, MSG.method, request.method);

  try {
    return { jsonrpc: '2.0', id, result: await method(request.params) };
  } catch (err) {
    if (err instanceof PaymeError) return fail(id, err.code, err.localized, err.data);
    console.error('Payme so‘rovida xatolik:', err);
    return fail(id, -32400, MSG.system);
  }
}

/** Payme to'lov sahifasi manzili: mijoz shu sahifada karta bilan to'laydi */
export function paymeCheckoutUrl(intent, { lang, returnUrl }) {
  const params = [
    `m=${config.payme.merchantId}`,
    `ac.${config.payme.accountField}=${intent.id}`,
    `a=${intent.amount * 100}`,
    `l=${['uz', 'ru', 'en'].includes(lang) ? lang : 'ru'}`,
  ];
  if (returnUrl) params.push(`c=${returnUrl}`);
  return `${config.payme.checkoutUrl}/${Buffer.from(params.join(';')).toString('base64')}`;
}
