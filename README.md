# Salaty By Nargiz

Telegram Mini App + Admin Panel + Bot. Kompyuterda (localhost) sinaladi, serverga bitta xizmat sifatida chiqariladi
("Serverga chiqarish" bo'limiga qarang).

## Tuzilishi

```
backend/   Node.js: Telegram bot + API (port 3000)
miniapp/   Mijozlar uchun React Mini App (port 5173)
admin/     Ma'murlar uchun React Admin Panel (port 5174)
```

## Birinchi marta ishga tushirish

Kerak: Node.js 20 yoki yangiroq (https://nodejs.org). Terminalni shu papkada oching.

```bash
npm run install:all     # 1. barcha paketlarni o'rnatish
npm run db:migrate      # 2. bazada jadvallarni yaratish / yangilash (ma'lumotlar o'chmaydi)
npm run db:seed         # 3. boshlang'ich mahsulotlarni yozish
npm run dev             # 4. hammasini ishga tushirish
```

Keyingi safar faqat `npm run dev` yetadi.

- Admin Panel: http://localhost:5174 (parol: `backend/.env` ichidagi `ADMIN_PASSWORD`)
- Mini App: ngrok orqali Telegram ichida ochiladi (quyida)

## Mini Appni Telegramga ulash (ngrok)

1. https://ngrok.com saytida ro'yxatdan o'ting va ngrok dasturini o'rnating, `ngrok config add-authtoken <TOKEN>` bilan ulang.
2. `npm run dev` ishlab turganda, yangi terminal oynasida: `ngrok http 5173`
3. ngrok ko'rsatgan `https://xxxx.ngrok-free.app` manzilini nusxalang.
4. `backend/.env` faylida `MINIAPP_URL="https://xxxx.ngrok-free.app"` deb yozing (oxirida `/` bo'lmasin).
5. `npm run dev` ni to'xtating (Ctrl+C) va qaytadan ishga tushiring.
6. Telegramda botingizga `/start` yozing va "Buyurtma berish" tugmasini bosing.

Eslatma: ngrok bepul versiyasida har safar manzil o'zgaradi. Har yangi manzilda 4-5 qadamni takrorlang.
Birinchi ochilishda ngrok "Visit Site" sahifasini ko'rsatishi mumkin: tugmani bir marta bosing.

## Admin Telegram ID

Botga `/id` deb yozing, u sizning ID raqamingizni yuboradi. Uni `backend/.env` dagi
`ADMIN_TELEGRAM_IDS="123456789"` ga yozing (bir nechta bo'lsa vergul bilan). Qayta ishga tushiring.

## Serverga chiqarish (production)

Serverda bitta Node.js xizmati ishlaydi: bot, API, Mini App (`https://domen/`) va Admin Panel
(`https://domen/admin/`). ngrok kerak emas.

```bash
npm run build   # paketlarni o'rnatadi va Mini App + Admin Panelni yig'adi
npm start       # bazani yangilaydi (prisma migrate deploy) va serverni ishga tushiradi
```

### Railway (tavsiya etiladi)
1. Kodni GitHub'ga yopiq (private) repo qilib yuklang. `.env` fayli yuklanmaydi (`.gitignore` da bor).
2. https://railway.com da: New Project -> Deploy from GitHub repo -> repo'ni tanlang.
   Build va start buyruqlari `railway.json` dan o'qiladi.
3. Service -> Settings -> Networking -> **Generate Domain**: `https://xxxx.up.railway.app` manzili beriladi.
4. Service'ga **Volume** qo'shing, Mount path: `/data` (yuklangan rasmlar o'chib ketmasligi uchun).
5. Service -> **Variables** ga `backend/.env` dagi qiymatlarni yozing, shu bilan birga:
   - `MINIAPP_URL` = 3-qadamdagi manzil (oxirida `/` bo'lmasin)
   - `TRUST_PROXY=1`
   - `UPLOADS_DIR=/data/uploads`
   - `PAYMENTS_TEST_MODE=false`
   - `JWT_SECRET` = kamida 32 belgili yangi tasodifiy matn, `ADMIN_PASSWORD` = murakkab parol
   - Payme / Click kalitlari (pastdagi bo'lim). `PORT` ni yozmang, Railway o'zi beradi.
6. Deploy tugagach, logda shular chiqishi kerak: `✅ Backend ishga tushdi`, `🌐 Mini App (/)...`, `🤖 Bot ishga tushdi`.
7. Telegramda botga `/start` yozing. Admin Panel: `https://xxxx.up.railway.app/admin/`.

### Boshqa server (VPS)
Node.js 20+, `npm run build`, `npm start` (doimiy ishlashi uchun pm2 yoki systemd). Oldiga nginx + HTTPS
(Let's Encrypt) qo'ying va `.env` da `TRUST_PROXY=1` yozing.

### Muhim
- **Bitta bot tokeni bilan faqat bitta nusxa ishlaydi.** Server ishlab turganda kompyuterda shu token bilan
  `npm run dev` ni ishga tushirmang. Sinash uchun @BotFather'da alohida test bot oching.
- **Sinov va haqiqiy baza alohida bo'lsin.** Kompyuterda sinash uchun Neon'da alohida branch oching, aks holda
  sinov buyurtmalari haqiqiy bazaga tushadi.
- Har deploy'da `prisma migrate deploy` o'zi ishlaydi: faqat yangi o'zgarishlar qo'shiladi, ma'lumotlar o'chmaydi.

## Xavfsizlik

- Mini App so'rovlari Telegram imzosi (initData, HMAC-SHA-256) bilan tekshiriladi
- Prisma ORM parametrlashtirilgan so'rovlar ishlatadi (SQL injection himoyasi)
- CORS: faqat localhost va MINIAPP_URL manzillari
- Rate limit: umumiy, foydalanuvchi bo'yicha, buyurtma va admin kirishi uchun
- Maxfiy kalitlar faqat `backend/.env` da. `.env` faylini hech kimga yubormang

## Onlayn to'lov (Click / Payme)

Payme va Click ulanishi tayyor. Qaysi tizimning kalitlari `backend/.env` da yozilgan bo'lsa, o'sha haqiqiy
rejimda ishlaydi. Kalitlari yo'q tizim mijozga ko'rsatilmaydi. Server ishga tushganda konsolda holat yoziladi:
`💳 Onlayn to'lov: Payme - haqiqiy, Click - o'chirilgan`.

Qanday ishlaydi:
1. Mijoz savatda Payme yoki Click ni tanlaydi. Buyurtma hali bazaga yozilmaydi, "kutish" holatida turadi (30 daqiqa).
2. Mini App "Payme orqali to'lash" tugmasini ko'rsatadi, u to'lov sahifasini ochadi.
3. Mijoz to'lagach, Payme/Click serveri bizning serverga tasdiq yuboradi va buyurtma `To'langan` bo'lib yoziladi.
   Adminga xabar boradi, Mini App esa o'zi "Buyurtma qabul qilindi" sahifasiga o'tadi.
4. Pul faqat to'lov tizimining tasdig'i bilan hisobga olinadi. Mijoz tomondagi tugma yoki so'rov buyurtmani "to'langan" qila olmaydi.

### Payme
1. https://business.paycom.uz da kassa oching. Kassa sozlamalarida:
   - Endpoint URL: `https://SIZNING-DOMEN/api/payments/payme`
   - Hisob (account) maydoni: `order_id` (boshqa nom bersangiz, `PAYME_ACCOUNT_FIELD` ga yozing)
2. `.env` ga yozing: `PAYME_MERCHANT_ID` (kassa ID) va `PAYME_KEY` (kalit).
3. Sinov: `PAYME_KEY` ga sinov kalitini, `PAYME_CHECKOUT_URL="https://test.paycom.uz"` yozing va
   https://test.paycom.uz sandbox'idagi testlarni o'tkazing. Sandbox'da buyurtma raqami sifatida Mini App da
   yaratilgan to'lov ID sini kiriting (u 30 daqiqa amal qiladi). Testlar o'tgach, haqiqiy kalitga almashtiring.
4. Payme kabinetida kalit almashtirilsa, yangi kalitni `.env` ga yozib, serverni qayta ishga tushiring.

### Click
1. https://merchant.click.uz da servis oching. Servis sozlamalarida:
   - Prepare URL: `https://SIZNING-DOMEN/api/payments/click/prepare`
   - Complete URL: `https://SIZNING-DOMEN/api/payments/click/complete`
2. `.env` ga yozing: `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY`.

### Muhim
- Payme va Click serveri sizning serveringizga internet orqali murojaat qiladi. Shuning uchun doimiy domen va
  HTTPS kerak. Bepul ngrok manzili har safar o'zgaradi: haqiqiy to'lovlarni faqat doimiy serverda yoqing.
- Payme to'lovni qaytarsa (to'lovdan keyin bekor qilish), buyurtma `Bekor qilingan / Qaytarilgan` bo'ladi va
  adminga Telegram xabar boradi. Yetkazilgan buyurtma uchun to'lovni qaytarishga ruxsat berilmaydi.
- `PAYMENTS_TEST_MODE=true` faqat kompyuterda sinash uchun: kalitlari yozilmagan tizimda pulsiz
  "To'lovni tasdiqlash" tugmasi chiqadi. Kalitlari yozilgan tizimga bu sozlama ta'sir qilmaydi.
- Bazaga yangi jadvallar qo'shildi: yangilangandan keyin bir marta `npm run db:migrate` ni ishga tushiring.
