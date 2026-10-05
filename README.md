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
npm run db:seed         # 3. menyuni (narx va rasmlari bilan) yozish, qayta ishga tushirsa bo'ladi
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
4. Service -> **Variables** ga `backend/.env` dagi qiymatlarni yozing, shu bilan birga:
   - `MINIAPP_URL` = 3-qadamdagi manzil (oxirida `/` bo'lmasin)
   - `TRUST_PROXY=1`
   - `PAYMENTS_TEST_MODE=false`
   - `JWT_SECRET` = kamida 32 belgili yangi tasodifiy matn, `ADMIN_PASSWORD` = murakkab parol
   - Payme / Click kalitlari (pastdagi bo'lim). `PORT` ni yozmang, Railway o'zi beradi.
5. Deploy tugagach, logda shular chiqishi kerak: `✅ Backend ishga tushdi`, `🌐 Mini App (/)...`, `🤖 Bot ishga tushdi`.
6. Telegramda botga `/start` yozing. Admin Panel: `https://xxxx.up.railway.app/admin/`.

### Render (bepul tarif)
Bepul tarifda server 15 daqiqa so'rov bo'lmasa uxlaydi va disk doimiy emas. Loyiha bunga moslangan:
- **Bot webhook rejimida ishlaydi** (Render'da o'zi yoqiladi). Telegram har bir xabarni serverga yuboradi va shu so'rov
  uxlab yotgan serverni uyg'otadi: `/start`, raqam yuborish va admin tugmalari server uxlasa ham ishlaydi.
  Uyg'onish 30-60 soniya oladi, xabar yo'qolmaydi (Telegram qayta yuboradi).
- Rasmlar va cheklar bazada saqlanadi, disk kerak emas.
- Tezroq javob uchun (ixtiyoriy): https://uptimerobot.com da har 5 daqiqada `https://DOMEN/api/health` ni tekshiradigan
  monitor qo'shing, server uxlamaydi. Bitta xizmat uchun bepul soat (750 soat/oy) yetadi.
- Logda `🤖 Bot webhook rejimida ishlaydi` chiqishi kerak.

### Boshqa server (VPS)
Node.js 20+, `npm run build`, `npm start` (doimiy ishlashi uchun pm2 yoki systemd). Oldiga nginx + HTTPS
(Let's Encrypt) qo'ying va `.env` da `TRUST_PROXY=1` yozing.

### Muhim
- **Bitta bot tokeni bilan faqat bitta nusxa ishlaydi.** Server ishlab turganda kompyuterda shu token bilan
  `npm run dev` ni ishga tushirmang. Sinash uchun @BotFather'da alohida test bot oching.
- **Sinov va haqiqiy baza alohida bo'lsin.** Kompyuterda sinash uchun Neon'da alohida branch oching, aks holda
  sinov buyurtmalari haqiqiy bazaga tushadi.
- Har deploy'da `prisma migrate deploy` o'zi ishlaydi: faqat yangi o'zgarishlar qo'shiladi, ma'lumotlar o'chmaydi.
- GitHub'ga `git push` qilinsa, Render/Railway yangi versiyani o'zi yig'ib chiqaradi (Auto-Deploy yoqilgan bo'lsa).
  Variables (muhit o'zgaruvchilari) har deploy'da saqlanib qoladi, ularni qayta yozish shart emas.

## Ro'yxatdan o'tish (telefon raqam)

Mini App birinchi ochilganda mijoz telefon raqamini tasdiqlaydi, shundan keyingina menyu ochiladi.
SMS kerak emas: raqamni Telegram o'zi beradi va imzolaydi.

1. Mijoz "Telefon raqamni yuborish" tugmasini bosadi, Telegram oynasida roziligini beradi.
2. Mini App Telegram imzolagan javobni serverga yuboradi (`POST /api/app/auth/contact`). Server imzoni bot tokeni bilan
   tekshiradi va raqam aynan shu mijozniki ekanini (user_id) solishtiradi. Raqam `+998901234567` ko'rinishida saqlanadi.
3. Shu bilan birga raqam bot chatiga ham keladi va bot uni tasdiqlaydi. Shuning uchun imzo qaysidir ilovada kelmasa ham
   ro'yxatdan o'tish ishlayveradi.
4. Juda eski Telegram ilovalarida bot chatga "📱 Raqamni yuborish" tugmasini yuboradi.

Himoya: raqamni mijoz qo'lda yoza olmaydi, boshqa odamning kontakti qabul qilinmaydi, buyurtma serverda ham faqat
tasdiqlangan raqam bilan qabul qilinadi (`PHONE_REQUIRED`). Buyurtmadagi telefon - tasdiqlangan raqam.
Oldin ro'yxatdan o'tgan mijozlar ham bir marta raqamini tasdiqlaydi.

## Karta orqali to'lov (kartaga o'tkazma)

Savatda "Naqd pul" bilan birga **"Karta orqali"** (oldindan to'lov) chiqadi. Pul to'g'ridan-to'g'ri do'kon kartasiga
o'tadi (`9860 1201 2410 4734`, `CARD_NUMBER` bilan almashtiriladi).

1. Mijoz "Karta orqali" ni tanlaydi. Buyurtma hali yaratilmaydi, to'lov "kutish" holatida turadi.
2. Mini App karta raqami va aniq summani ko'rsatadi ("Nusxalash" tugmalari bilan). Mijoz o'z bank ilovasida
   (Payme, Click, Uzum...) o'tkazadi va **chek skrinshotini yuklaydi**.
3. Adminga chek boradi: Telegram'da (rasm + **✅ Pul tushdi / ❌ Pul tushmadi** tugmalari) va Admin Panelda
   ("Karta to'lovlari" bo'limi, ovozli xabar bilan).
4. Admin bank ilovasida kartaga aynan shu summa tushganini tekshirib tasdiqlaydi. Shundagina buyurtma
   **"Karta - To'langan"** bo'lib yaratiladi, mijozga va adminlarga oddiy buyurtma xabari boradi.
   Rad etilsa, mijozga "pul tushmadi" xabari boradi, buyurtma yaratilmaydi.

Muhim:
- Shaxsiy kartaga tushgan pulni hech bir dastur avtomatik tasdiqlay olmaydi (bankning ochiq API'si yo'q), shuning
  uchun oxirgi qadamni admin qiladi. Mijoz to'lovni o'zi "to'landi" qila olmaydi, summa serverda hisoblanadi.
- Telegram'da tasdiqlash uchun `ADMIN_TELEGRAM_IDS` yozilgan bo'lishi kerak (aks holda faqat Admin Panelda).
- Mijozga chek yuklash uchun 24 soat beriladi. Cheklar 30 kundan keyin bazadan o'chiriladi (Telegram'da nusxasi qoladi).
- Biznes tushumini shaxsiy kartaga ko'p qabul qilish bank cheklovlariga olib kelishi mumkin. To'liq avtomatik
  to'lov uchun Payme/Click ulanishi tayyor (pastdagi bo'lim) - kalitlarni yozish kifoya.

## Mahsulot rasmlari

Admin Panelda yuklangan rasm diskka emas, bazaga **base64** ko'rinishida yoziladi, shuning uchun server qayta
ishga tushganda yoki yangi deploy'da o'chib ketmaydi (Render bepul tarifida doimiy disk yo'q).

- Yuborishdan oldin Admin Panel rasmni kichraytiradi (1280px, WEBP), odatda 100-300 KB bo'ladi. Chegara: 2 MB.
- Fayl turi faylning o'z ichidan tekshiriladi: faqat JPG, PNG, WEBP.
- Rasm `https://domen/api/images/products/<id>?v=...` manzilidan beriladi va brauzerda uzoq keshlanadi.
- Oldin diskka yuklangan rasmlar (`/uploads/...`) serverda o'chib ketgan bo'lishi mumkin: o'sha mahsulotlarga rasmni
  Admin Panel orqali qaytadan yuklang.

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
- Bazaga yangi jadvallar qo'shildi: yangilangandan keyin bir marta `npm run db:migrate` ni ishga tushiring
  (serverda `npm start` buni o'zi qiladi).
