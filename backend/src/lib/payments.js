import { config } from '../config.js';
import { botUsername } from '../bot.js';
import { paymeCheckoutUrl } from './payme.js';
import { clickCheckoutUrl } from './click.js';

/**
 * To'lov usuli qaysi rejimda ishlaydi:
 * 'live' - kalitlar yozilgan, haqiqiy to'lov;
 * 'test' - kalitlar yo'q va PAYMENTS_TEST_MODE=true, pul yechilmaydi;
 * null   - o'chirilgan (mijozga ko'rsatilmaydi).
 */
export function paymentMode(provider) {
  if (provider === 'CASH') return 'live';
  // Kartaga o'tkazma: har doim haqiqiy (sinov rejimi yo'q), admin tasdiqlaydi
  if (provider === 'CARD') return config.card.enabled ? 'live' : null;
  const live = provider === 'PAYME' ? config.payme.enabled : provider === 'CLICK' ? config.click.enabled : false;
  if (live) return 'live';
  return config.paymentsTestMode ? 'test' : null;
}

export const availableMethods = () => ['CASH', 'CARD', 'CLICK', 'PAYME'].filter((m) => paymentMode(m));

/** Karta orqali to'lov uchun mijozga ko'rsatiladigan karta */
export const transferCard = () => ({ number: config.card.number, holder: config.card.holder });

/** Mijoz to'lov qiladigan sahifa manzili (faqat 'live' rejimda) */
export function paymentUrl(intent, user) {
  if (paymentMode(intent.provider) !== 'live') return null;
  const returnUrl = config.paymentReturnUrl || (botUsername ? `https://t.me/${botUsername}` : '');
  if (intent.provider === 'PAYME') return paymeCheckoutUrl(intent, { lang: user.language, returnUrl });
  if (intent.provider === 'CLICK') return clickCheckoutUrl(intent, { returnUrl });
  return null;
}
