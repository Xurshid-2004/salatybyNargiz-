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

const miniappUrl = stripSlash(process.env.MINIAPP_URL);
const env = (name) => (process.env[name] || '').trim();

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
