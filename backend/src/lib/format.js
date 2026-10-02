import crypto from 'node:crypto';

export function money(n) {
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`;
}

// Telegram HTML xabarlari uchun xavfsiz matn
export function esc(value) {
  return String(value ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}

// Maxfiy kalit/imzolarni solishtirish: vaqt bo'yicha taxmin qilib bo'lmaydi (timing attack)
export function safeEqual(a, b) {
  const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
  return crypto.timingSafeEqual(sha(a), sha(b));
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
