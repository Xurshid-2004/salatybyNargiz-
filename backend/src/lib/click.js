import crypto from 'node:crypto';
import { prisma } from '../prisma.js';
import { config } from '../config.js';
import { safeEqual } from './format.js';
import { afterOrderCreated, fulfillIntent, isIntentExpired } from './orders.js';

/*
 * Click SHOP API: Click serveri avval Prepare (action=0), mijoz to'lagach Complete (action=1)
 * so'rovini yuboradi. Hujjat: https://docs.click.uz/click-api-request/
 * Summa so'mda. Complete'ga xato qaytarilsa, Click pulni mijozga qaytaradi.
 */

const NOTE = {
  0: 'Success',
  '-1': 'SIGN CHECK FAILED!',
  '-2': 'Incorrect parameter amount',
  '-3': 'Action not found',
  '-4': 'Already paid',
  '-5': 'User does not exist',
  '-6': 'Transaction does not exist',
  '-8': 'Error in request from click',
  '-9': 'Transaction cancelled',
};

class ClickReject extends Error {
  constructor(code) {
    super(NOTE[code]);
    this.code = code;
  }
}

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

// sign_string = md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id
//                   [+ merchant_prepare_id] + amount + action + sign_time)
function checkSign(p, action) {
  const parts = [p.click_trans_id, p.service_id, config.click.secretKey, p.merchant_trans_id];
  if (action === 1) parts.push(p.merchant_prepare_id);
  parts.push(p.amount, p.action, p.sign_time);
  return safeEqual(md5(parts.join('')), String(p.sign_string).toLowerCase());
}

const amountMatches = (raw, expected) => {
  const n = Number(raw);
  return Number.isFinite(n) && Math.abs(n - expected) < 0.01;
};

async function prepare(p) {
  const intent = await prisma.paymentIntent.findUnique({ where: { id: String(p.merchant_trans_id) } });
  if (!intent || intent.provider !== 'CLICK') throw new ClickReject(-5);
  if (!amountMatches(p.amount, intent.amount)) throw new ClickReject(-2);
  if (intent.status === 'PAID') throw new ClickReject(-4);
  if (intent.status === 'CANCELLED' || isIntentExpired(intent)) throw new ClickReject(-9);

  const clickTransId = String(p.click_trans_id);
  let trx = await prisma.clickTransaction.findUnique({ where: { clickTransId } });
  if (trx) {
    // Click so'rovni takrorlasa - o'sha javobni qaytaramiz
    if (trx.intentId !== intent.id) throw new ClickReject(-6);
    if (trx.status === 'COMPLETED') throw new ClickReject(-4);
    if (trx.status === 'CANCELLED') throw new ClickReject(-9);
  } else {
    trx = await prisma.clickTransaction.create({
      data: { clickTransId, clickPaydocId: String(p.click_paydoc_id), intentId: intent.id, amount: intent.amount },
    });
  }
  return { merchant_prepare_id: trx.id };
}

async function complete(p) {
  const prepareId = Number(p.merchant_prepare_id);
  const trx = Number.isInteger(prepareId)
    ? await prisma.clickTransaction.findUnique({ where: { id: prepareId } })
    : null;
  if (!trx || trx.clickTransId !== String(p.click_trans_id) || trx.intentId !== String(p.merchant_trans_id)) {
    throw new ClickReject(-6);
  }
  if (trx.status === 'COMPLETED') throw new ClickReject(-4);
  if (trx.status === 'CANCELLED') throw new ClickReject(-9);
  if (!amountMatches(p.amount, trx.amount)) throw new ClickReject(-2);

  // Click tomonida to'lov o'tmadi (masalan, kartada mablag' yetarli emas)
  if (Number(p.error) < 0) {
    await prisma.clickTransaction.updateMany({ where: { id: trx.id, status: 'PREPARED' }, data: { status: 'CANCELLED' } });
    throw new ClickReject(-9);
  }

  let order;
  try {
    // To'lov holati va buyurtma bitta tranzaksiyada saqlanadi: yo ikkalasi, yo hech biri
    order = await prisma.$transaction(async (tx) => {
      const claimed = await tx.clickTransaction.updateMany({
        where: { id: trx.id, status: 'PREPARED' },
        data: { status: 'COMPLETED' },
      });
      if (claimed.count === 0) throw new ClickReject(-4); // parallel so'rov allaqachon bajardi
      const created = await fulfillIntent(tx, trx.intentId);
      if (!created) throw new ClickReject(-4); // buyurtma boshqa to'lov bilan to'langan
      return created;
    });
  } catch (err) {
    if (err instanceof ClickReject && err.code === -4) {
      // Bu tranzaksiya buyurtma yaratmadi: Click pulni qaytaradi
      await prisma.clickTransaction.updateMany({ where: { id: trx.id, status: 'PREPARED' }, data: { status: 'CANCELLED' } });
    }
    throw err;
  }

  afterOrderCreated(order);
  return { merchant_confirm_id: trx.id };
}

const REQUIRED = ['click_trans_id', 'service_id', 'click_paydoc_id', 'merchant_trans_id', 'amount', 'action', 'sign_time', 'sign_string'];

/** Click serveridan kelgan Prepare (action=0) yoki Complete (action=1) so'rovini bajaradi */
export async function handleClick(body, action) {
  const p = body && typeof body === 'object' ? body : {};
  const reply = (error, extra = {}) => ({
    click_trans_id: p.click_trans_id ?? null,
    merchant_trans_id: p.merchant_trans_id ?? null,
    ...extra,
    error,
    error_note: NOTE[error],
  });

  const required = action === 1 ? [...REQUIRED, 'merchant_prepare_id'] : REQUIRED;
  if (required.some((key) => p[key] === undefined || p[key] === '' || typeof p[key] === 'object')) return reply(-8);
  if (!config.click.enabled || !checkSign(p, action)) return reply(-1);
  if (String(p.service_id) !== config.click.serviceId) return reply(-8);
  if (Number(p.action) !== action) return reply(-3);

  try {
    return reply(0, action === 0 ? await prepare(p) : await complete(p));
  } catch (err) {
    if (err instanceof ClickReject) return reply(err.code);
    throw err;
  }
}

/** Click to'lov sahifasi manzili */
export function clickCheckoutUrl(intent, { returnUrl }) {
  const query = new URLSearchParams({
    service_id: config.click.serviceId,
    merchant_id: config.click.merchantId,
    amount: String(intent.amount),
    transaction_param: intent.id,
  });
  if (returnUrl) query.set('return_url', returnUrl);
  return `https://my.click.uz/services/pay?${query}`;
}
