import crypto from 'node:crypto';

/**
 * Telegram Mini App initData imzosini tekshiradi (HMAC-SHA-256).
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * Muvaffaqiyatli bo'lsa Telegram foydalanuvchisi obyektini, aks holda null qaytaradi.
 */
export function validateInitData(initData, botToken, maxAgeSeconds = 24 * 60 * 60) {
  if (typeof initData !== 'string' || !initData) return null;

  const params = new URLSearchParams(initData);
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

  try {
    const user = JSON.parse(params.get('user') || '');
    return user && typeof user.id === 'number' ? user : null;
  } catch {
    return null;
  }
}
