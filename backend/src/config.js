import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    console.error(`❌ backend/.env faylida ${name} yozilmagan. .env.example faylini qarang.`);
    process.exit(1);
  }
  return value.trim();
}

const list = (value) =>
  (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const stripSlash = (url) => (url || '').trim().replace(/\/+$/, '');

const env = (name) => (process.env[name] || '').trim();

// Hosting bergan ochiq manzil (Render, Railway). Kompyuterda bo'sh.
const hostingUrl = stripSlash(
  env('RENDER_EXTERNAL_URL') || (env('RAILWAY_PUBLIC_DOMAIN') ? `https://${env('RAILWAY_PUBLIC_DOMAIN')}` : ''),
);

// Mini App manzili. Yozilmagan bo'lsa, hosting manzili olinadi.
const miniappUrl = stripSlash(env('MINIAPP_URL') || hostingUrl);

// Luhn tekshiruvi: karta raqamida xato yozilgan raqam bo'lsa ushlaydi
function luhnValid(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return sum % 10 === 0;
}

// Karta orqali oldindan to'lov (P2P o'tkazma): mijoz shu kartaga o'tkazadi va chek yuklaydi,
// admin pul tushganini tekshirib tasdiqlaydi. CARD_NUMBER bilan almashtiriladi, CARD_NUMBER=off - o'chadi.
const cardNumber = (env('CARD_NUMBER') || '9860120124104734').replace(/[\s-]/g, '');
const card = {
  number: /^\d{16}$/.test(cardNumber) && luhnValid(cardNumber) ? cardNumber : '',
  holder: env('CARD_HOLDER'),
};
card.enabled = Boolean(card.number);
card.invalid = !card.enabled && cardNumber.toLowerCase() !== 'off';

const payme = {
  merchantId: env('PAYME_MERCHANT_ID'),
  key: env('PAYME_KEY'),
  // Payme kabinetida "Hisob" (account) maydoniga berilgan nom
  accountField: env('PAYME_ACCOUNT_FIELD') || 'order_id',
  checkoutUrl: stripSlash(env('PAYME_CHECKOUT_URL')) || 'https://checkout.paycom.uz',
};
payme.enabled = Boolean(payme.merchantId && payme.key);

const click = {
  serviceId: env('CLICK_SERVICE_ID'),
  merchantId: env('CLICK_MERCHANT_ID'),
  secretKey: env('CLICK_SECRET_KEY'),
};
click.enabled = Boolean(click.serviceId && click.merchantId && click.secretKey);

// Server proksi (Railway, Render, nginx) ortida ishlasa: TRUST_PROXY=1
const trustProxy = env('TRUST_PROXY') || 'loopback';

export const config = {
  port: Number(process.env.PORT) || 3000,
  trustProxy: /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
  // Yuklangan rasmlar papkasi. Serverda doimiy diskka (volume) yo'naltiring.
  uploadsDir: env('UPLOADS_DIR'),
  botToken: required('BOT_TOKEN'),
  jwtSecret: required('JWT_SECRET'),
  adminPassword: required('ADMIN_PASSWORD'),
  adminTelegramIds: list(process.env.ADMIN_TELEGRAM_IDS).filter((id) => /^\d+$/.test(id)),
  miniappUrl,

  // Bot rejimi. Hostingda - webhook: Telegram xabarni serverga o'zi yuboradi va Render bepul tarifida
  // uxlab qolgan serverni uyg'otadi. Kompyuterda - polling. BOT_WEBHOOK=false - har doim polling.
  botWebhookBase: env('BOT_WEBHOOK') === 'false' ? '' : hostingUrl,

  // Faqat shu manzillardan keladigan brauzer so'rovlariga ruxsat beriladi (CORS).
  corsOrigins: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    ...(miniappUrl ? [miniappUrl] : []),
  ],

  // Onlayn to'lov tizimlari. Kalitlari .env da yozilgan tizim haqiqiy rejimda ishlaydi.
  payme,
  click,
  card,

  // Sinov rejimi FAQAT aniq PAYMENTS_TEST_MODE=true yozilganda yoqiladi va faqat
  // kalitlari yozilmagan tizimlarga ta'sir qiladi (pul yechilmaydi).
  paymentsTestMode: env('PAYMENTS_TEST_MODE') === 'true',

  // To'lovdan keyin mijoz qaytadigan manzil. Bo'sh bo'lsa - bot chati (https://t.me/<bot>).
  paymentReturnUrl: stripSlash(env('PAYMENT_RETURN_URL')),

  // Filiallar ro'yxati. Kerak bo'lsa shu yerni o'zgartiring.
  branches: [{ id: 'main', name: 'Salaty By Nargiz (asosiy filial)', address: 'Toshkent' }],

  workHours: '24/7',
  bonusPercent: 2, // yetkazilgan buyurtma summasidan % bonus
};
