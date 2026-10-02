/** @type {any} Telegram.WebApp (telegram-web-app.js) */
export const tg = /** @type {any} */ (window).Telegram?.WebApp || null;
export const initData = tg?.initData || '';

export function haptic(kind = 'light') {
  try {
    tg?.HapticFeedback?.impactOccurred(kind);
  } catch {
    /* eski versiyalarda yo'q */
  }
}

export function hapticResult(type = 'success') {
  try {
    tg?.HapticFeedback?.notificationOccurred(type);
  } catch {
    /* eski versiyalarda yo'q */
  }
}

// Telegram 6.9+ da telefon raqamni ilovaning o'zidan so'rash mumkin
export const canRequestContact = () =>
  typeof tg?.requestContact === 'function' && Boolean(tg.isVersionAtLeast?.('6.9'));

/**
 * Telegram oynasi orqali raqam so'raydi.
 * { shared: true, response } - response: Telegram imzolagan matn (ba'zi ilovalarda kelmasligi mumkin)
 * { shared: false } - mijoz rad etdi
 */
export function requestContact() {
  return new Promise((resolve, reject) => {
    try {
      tg.requestContact((shared, result) => resolve({ shared: Boolean(shared), response: result?.response || '' }));
    } catch (err) {
      reject(err);
    }
  });
}
