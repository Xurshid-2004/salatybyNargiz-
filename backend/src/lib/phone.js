/**
 * Telefon raqamini yagona ko'rinishga keltiradi (E.164): "998 90 123-45-67" -> "+998901234567".
 * Telegram raqamni ba'zan "+" siz yuboradi. Noto'g'ri raqam uchun null qaytaradi.
 */
export function normalizePhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return `+${digits}`;
}

/** Mijoz telefon raqamini Telegram orqali tasdiqlaganmi (ro'yxatdan o'tganmi) */
export const isRegistered = (user) => Boolean(user?.phone && user.phoneVerifiedAt);
