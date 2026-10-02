import crypto from 'node:crypto';

const DAY = 24 * 60 * 60;

/**
 * Telegram imzolagan ma'lumotni (initData, requestContact javobi) tekshiradi (HMAC-SHA-256).
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * To'g'ri bo'lsa parametrlarni (URLSearchParams), aks holda null qaytaradi.
 */
function checkSigned(raw, botToken, maxAgeSeconds) {
  if (typeof raw !== 'string' || !raw) return null;

  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest();
  const received = Buffer.from(hash, 'hex');

  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    return null;
  }

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) return null;
  return params;
}

function parseJson(value) {
  try {
    return JSON.parse(value || '');
  } catch {
    return null;
  }
}

/** Mini App initData. Telegram foydalanuvchisi obyektini yoki null qaytaradi. */
export function validateInitData(initData, botToken, maxAgeSeconds = DAY) {
  const params = checkSigned(initData, botToken, maxAgeSeconds);
  const user = params && parseJson(params.get('user'));
  return user && typeof user.id === 'number' ? user : null;
}

/**
 * Telegram.WebApp.requestContact() javobi. Raqamni Telegram o'zi imzolaydi, shuning uchun
 * uni mijoz o'zgartira olmaydi. { phone_number, user_id, ... } yoki null qaytaradi.
 */
export function validateContact(response, botToken, maxAgeSeconds = DAY) {
  const params = checkSigned(response, botToken, maxAgeSeconds);
  const contact = params && parseJson(params.get('contact'));
  return contact && typeof contact.user_id === 'number' && contact.phone_number ? contact : null;
}
