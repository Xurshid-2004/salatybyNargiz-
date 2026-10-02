import crypto from 'node:crypto';
import { Telegraf, Markup } from 'telegraf';
import { config } from './config.js';
import { prisma } from './prisma.js';
import { esc, money } from './lib/format.js';
import { normalizePhone } from './lib/phone.js';
import { confirmCardPayment, rejectCardPayment } from './lib/cardPayments.js';

// webhookReply: false - javoblar har doim oddiy API so'rovi bilan yuboriladi (polling bilan bir xil ishlaydi)
export const bot = new Telegraf(config.botToken, { telegram: { webhookReply: false } });

// Webhook manzili va maxfiy kaliti bot tokenidan olinadi: har deploy'da bir xil, tashqaridan topib bo'lmaydi
const fromToken = (label) => crypto.createHash('sha256').update(`${label}:${config.botToken}`).digest('hex');
export const webhookPath = `/api/telegram/${fromToken('webhook-path').slice(0, 32)}`;
const webhookSecret = fromToken('webhook-secret');
export const webhookHandler = bot.webhookCallback(webhookPath, { secretToken: webhookSecret });

// Bot ishga tushganda to'ldiriladi (to'lovdan keyin qaytish havolasi uchun)
export let botUsername = '';

const isHttps = (url) => /^https:\/\//i.test(url || '');

// Xato matnlarida bot tokeni ko'rinib qolmasligi uchun
const safeMsg = (err) => String(err?.message || err).split(config.botToken).join('***');

export function pickLang(code) {
  if (!code) return 'ru';
  if (code.startsWith('uz')) return 'uz';
  if (code.startsWith('en')) return 'en';
  return 'ru';
}

const TEXT = {
  uz: {
    hello: "Assalomu alaykum! 🥗 <b>Salaty By Nargiz</b> ga xush kelibsiz.\nBuyurtma berish uchun pastdagi tugmani bosing.",
    open: '🛒 Buyurtma berish',
    noApp: "Ilova manzili hali sozlanmagan. Administrator MINIAPP_URL ni sozlashi kerak.",
    success: "Buyurtmangiz muvaffaqiyatli qabul qilindi! Kuryerimiz tez orada bog'lanadi 🍕",
    delivered: 'Buyurtmangiz #{id} yetkazildi. Yoqimli ishtaha! 🥗',
    cancelled: "Buyurtmangiz #{id} bekor qilindi. Savollar bo'lsa, biz bilan bog'laning.",
    phoneAsk: "Ro'yxatdan o'tish uchun pastdagi «📱 Raqamni yuborish» tugmasini bosing.",
    phoneButton: '📱 Raqamni yuborish',
    phoneSaved: "✅ Raqamingiz tasdiqlandi: {phone}\nEndi buyurtma berishingiz mumkin.",
    phoneForeign: "Faqat o'zingizning raqamingizni yuboring: pastdagi «📱 Raqamni yuborish» tugmasini bosing.",
    cardRejected: "Karta orqali to'lovingiz ({amount}) tasdiqlanmadi: kartaga pul tushmadi. Buyurtma qabul qilinmadi. Pul o'tkazgan bo'lsangiz, biz bilan bog'laning.",
  },
  ru: {
    hello: 'Здравствуйте! 🥗 Добро пожаловать в <b>Salaty By Nargiz</b>.\nНажмите кнопку ниже, чтобы сделать заказ.',
    open: '🛒 Сделать заказ',
    noApp: 'Адрес приложения ещё не настроен. Администратор должен указать MINIAPP_URL.',
    success: 'Ваш заказ успешно принят! Курьер скоро свяжется с вами 🍕',
    delivered: 'Ваш заказ #{id} доставлен. Приятного аппетита! 🥗',
    cancelled: 'Ваш заказ #{id} отменён. Если есть вопросы, свяжитесь с нами.',
    phoneAsk: 'Для регистрации нажмите кнопку «📱 Отправить номер» ниже.',
    phoneButton: '📱 Отправить номер',
    phoneSaved: '✅ Ваш номер подтверждён: {phone}\nТеперь можно оформлять заказы.',
    phoneForeign: 'Отправьте свой номер: нажмите кнопку «📱 Отправить номер» ниже.',
    cardRejected: 'Оплата картой ({amount}) не подтверждена: деньги на карту не поступили. Заказ не принят. Если вы перевели деньги, свяжитесь с нами.',
  },
  en: {
    hello: 'Hello! 🥗 Welcome to <b>Salaty By Nargiz</b>.\nTap the button below to place an order.',
    open: '🛒 Order now',
    noApp: 'The app address is not configured yet. The admin must set MINIAPP_URL.',
    success: 'Your order has been received! Our courier will contact you soon 🍕',
    delivered: 'Your order #{id} has been delivered. Enjoy your meal! 🥗',
    cancelled: 'Your order #{id} has been cancelled. If you have questions, please contact us.',
    phoneAsk: 'To sign up, tap the «📱 Share phone number» button below.',
    phoneButton: '📱 Share phone number',
    phoneSaved: '✅ Your number is confirmed: {phone}\nYou can place orders now.',
    phoneForeign: 'Please send your own number: tap the «📱 Share phone number» button below.',
    cardRejected: 'Your card payment ({amount}) was not confirmed: the money did not arrive. The order was not placed. If you did transfer the money, please contact us.',
  },
};

const DELIVERY = { DELIVERY: '🚚 Yetkazib berish', PICKUP: '🏃 Olib ketish' };
const PAYMENT = { CASH: '💵 Naqd', CLICK: '💳 Click', PAYME: '💳 Payme', CARD: "💳 Karta (o'tkazma)" };

const formatCard = (n) => String(n).replace(/(\d{4})(?=\d)/g, '$1 ');
const isAdmin = (telegramId) => config.adminTelegramIds.includes(String(telegramId));

async function sendSafe(chatId, text, extra = {}) {
  try {
    await bot.telegram.sendMessage(String(chatId), text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...extra,
    });
  } catch (err) {
    console.error(`Xabar yuborib bo'lmadi (${chatId}):`, safeMsg(err));
  }
}

export function notifyCustomer(user) {
  const t = TEXT[user.language] || TEXT.uz;
  return sendSafe(user.telegramId, esc(t.success));
}

/** Admin buyurtmani "Yetkazildi" yoki "Bekor qilindi" qilganda mijozga xabar */
export function notifyCustomerStatus(user, order) {
  const t = TEXT[user.language] || TEXT.uz;
  const key = order.status === 'DELIVERED' ? 'delivered' : order.status === 'CANCELLED' ? 'cancelled' : null;
  if (!key) return Promise.resolve();
  return sendSafe(user.telegramId, esc(t[key].replace('{id}', order.id)));
}

export function notifyAdmins(order) {
  if (!config.adminTelegramIds.length) return Promise.resolve();

  const u = order.user;
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
  const items = order.items.map((i) => `• ${esc(i.name)} × ${i.qty} = ${money(i.price * i.qty)}`).join('\n');

  const lines = [
    `🆕 <b>Yangi buyurtma #${order.id}</b>`,
    `👤 ${esc(name)}${u.username ? ` (@${esc(u.username)})` : ''}`,
    `📞 ${esc(order.phone)}`,
    `${DELIVERY[order.deliveryType]}${order.branch ? `: ${esc(order.branch)}` : ''}`,
  ];
  if (order.address) lines.push(`📍 ${esc(order.address)}`);
  if (order.latitude != null && order.longitude != null) {
    lines.push(`🗺 https://www.google.com/maps?q=${order.latitude},${order.longitude}`);
  }
  lines.push(
    `${PAYMENT[order.paymentMethod]} — ${order.paymentStatus === 'PAID' ? "✅ to'langan" : "⏳ to'lanmagan"}`,
    '',
    items,
    '',
    `💰 <b>Jami: ${money(order.total)}</b>`,
  );

  const text = lines.join('\n');
  return Promise.allSettled(config.adminTelegramIds.map((id) => sendSafe(id, text)));
}

/** To'lov tizimi pulni mijozga qaytardi - buyurtma bekor qilindi */
export function notifyAdminsRefund(order) {
  const text = `↩️ <b>Buyurtma #${order.id} bekor qilindi</b>\n${PAYMENT[order.paymentMethod]} to'lovni mijozga qaytardi (${money(order.total)}). Buyurtmani tayyorlamang.`;
  return Promise.allSettled(config.adminTelegramIds.map((id) => sendSafe(id, text)));
}

/**
 * Karta orqali to'lov: mijoz chek yukladi. Adminlarga chek rasmi va "Pul tushdi / tushmadi" tugmalari boradi.
 * intent.user - mijoz. receipt - chek rasmi (Buffer).
 */
export function notifyAdminsCardPayment(intent, receipt, replaced = false) {
  if (!config.adminTelegramIds.length) return Promise.resolve();

  const p = intent.payload;
  const u = intent.user;
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
  const items = p.items.map((i) => `• ${esc(i.name)} × ${i.qty} = ${money(i.price * i.qty)}`).join('\n');
  const lines = [
    `💳 <b>Karta orqali to'lov${replaced ? ' (chek almashtirildi)' : ''} — tekshiring</b>`,
    `💰 <b>${money(intent.amount)}</b> → ${formatCard(config.card.number)}`,
    `👤 ${esc(name)}${u.username ? ` (@${esc(u.username)})` : ''}`,
    `📞 ${esc(p.phone)}`,
    `${DELIVERY[p.deliveryType]}${p.branch ? `: ${esc(p.branch)}` : ''}`,
  ];
  if (p.address) lines.push(`📍 ${esc(p.address)}`);
  lines.push(
    '',
    items,
    '',
    "Bank ilovasida kartaga aynan shu summa tushganini tekshiring. «Pul tushdi» bosilgandagina buyurtma qabul qilinadi.",
  );
  const keyboard = Markup.inlineKeyboard([
    Markup.button.callback('✅ Pul tushdi', `card:ok:${intent.id}`),
    Markup.button.callback('❌ Pul tushmadi', `card:no:${intent.id}`),
  ]);

  return Promise.allSettled(
    config.adminTelegramIds.map(async (chatId) => {
      try {
        await bot.telegram.sendPhoto(chatId, { source: receipt, filename: 'chek.jpg' }, {
          caption: `🧾 Chek: ${money(intent.amount)} — ${name}`,
        });
      } catch (err) {
        console.error(`Chek rasmini yuborib bo'lmadi (${chatId}):`, safeMsg(err));
      }
      await sendSafe(chatId, lines.join('\n'), keyboard);
    }),
  );
}

/** Admin karta to'lovini rad etdi - mijozga xabar */
export function notifyCustomerCardRejected(user, intent) {
  const t = TEXT[user.language] || TEXT.uz;
  return sendSafe(user.telegramId, esc(t.cardRejected.replace('{amount}', money(intent.amount))));
}

const DECISION_TEXT = {
  confirmed: (r) => `✅ Tasdiqlandi. Buyurtma #${r.orderId} qabul qilindi.`,
  already_paid: (r) => `✅ Bu to'lov allaqachon tasdiqlangan (buyurtma #${r.orderId}).`,
  rejected: () => '❌ Rad etildi. Mijozga xabar yuborildi.',
  already_cancelled: () => "❌ Bu to'lov allaqachon rad etilgan.",
  not_found: () => "To'lov topilmadi.",
};

// Admin Telegram'dagi "Pul tushdi / Pul tushmadi" tugmasini bosdi
bot.action(/^card:(ok|no):([0-9a-f-]{36})$/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("Bu amal faqat adminlar uchun", { show_alert: true });
  const [, action, intentId] = ctx.match;
  const result = action === 'ok' ? await confirmCardPayment(intentId) : await rejectCardPayment(intentId);
  const text = DECISION_TEXT[result.status](result);
  await ctx.answerCbQuery(text);
  try {
    await ctx.editMessageReplyMarkup(undefined); // tugmalar qayta bosilmasin
  } catch {
    /* xabar allaqachon o'zgargan */
  }
  const who = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');
  await ctx.reply(`${text}\n👤 ${who}`, { reply_parameters: { message_id: ctx.callbackQuery.message.message_id } });
});

const phoneKeyboard = (t) => Markup.keyboard([Markup.button.contactRequest(t.phoneButton)]).resize().oneTime();

/** Mini App so'raganda: chatga "Raqamni yuborish" tugmasini yuboradi. Yuborib bo'lmasa xato tashlaydi. */
export async function requestPhoneInChat(user) {
  const t = TEXT[user.language] || TEXT.uz;
  await bot.telegram.sendMessage(String(user.telegramId), t.phoneAsk, phoneKeyboard(t));
}

bot.start(async (ctx) => {
  const t = TEXT[pickLang(ctx.from?.language_code)];
  if (!isHttps(config.miniappUrl)) return ctx.reply(t.noApp);
  await ctx.reply(t.hello, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([Markup.button.webApp(t.open, config.miniappUrl)]),
  });
});

// Admin Telegram ID sini bilish uchun: botga /id deb yozing
bot.command('id', (ctx) => ctx.reply(`Sizning Telegram ID raqamingiz: ${ctx.from.id}`));

// Ro'yxatdan o'tish: mijoz raqamini yubordi (Mini App dagi requestContact yoki chatdagi tugma orqali).
// Telegram user_id ni o'zi qo'yadi: boshqa odamning kontakti kelsa, user_id mos kelmaydi.
bot.on('contact', async (ctx) => {
  const { contact } = ctx.message;
  const from = ctx.from;
  const fallback = TEXT[pickLang(from.language_code)];
  if (contact.user_id !== from.id) return ctx.reply(fallback.phoneForeign, phoneKeyboard(fallback));
  const phone = normalizePhone(contact.phone_number);
  if (!phone) return ctx.reply(fallback.phoneForeign, phoneKeyboard(fallback));

  const profile = {
    firstName: String(from.first_name || 'Mijoz').slice(0, 100),
    lastName: from.last_name ? String(from.last_name).slice(0, 100) : null,
    username: from.username ? String(from.username).slice(0, 100) : null,
  };
  const user = await prisma.user.upsert({
    where: { telegramId: BigInt(from.id) },
    update: { ...profile, phone, phoneVerifiedAt: new Date() },
    create: {
      ...profile,
      telegramId: BigInt(from.id),
      language: pickLang(from.language_code),
      phone,
      phoneVerifiedAt: new Date(),
    },
  });
  const t = TEXT[user.language] || fallback;
  await ctx.reply(t.phoneSaved.replace('{phone}', phone), Markup.removeKeyboard());
});

bot.on('text', async (ctx) => {
  const t = TEXT[pickLang(ctx.from?.language_code)];
  if (!isHttps(config.miniappUrl)) return ctx.reply(t.noApp);
  await ctx.reply(t.hello, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([Markup.button.webApp(t.open, config.miniappUrl)]),
  });
});

bot.catch((err) => console.error('Bot xatosi:', safeMsg(err)));

const RETRY_MS = 10_000;
let stopping = false;

// Serverda yangi versiya chiqqanda eski nusxa bir necha soniya ishlab turadi (Telegram 409 Conflict
// qaytaradi). Bot butunlay to'xtab qolmasligi uchun qayta ulanamiz.
function launch(dropPendingUpdates) {
  bot.launch({ dropPendingUpdates }).catch((err) => {
    if (stopping) return;
    console.error(`Bot to‘xtadi: ${safeMsg(err)}. ${RETRY_MS / 1000} soniyadan keyin qayta ulanadi...`);
    setTimeout(() => launch(false), RETRY_MS);
  });
}

let webhookTimer = null;
const webhookUrl = () => `${config.botWebhookBase}${webhookPath}`;

async function ensureWebhook() {
  const info = await bot.telegram.getWebhookInfo();
  if (info.url === webhookUrl()) return;
  await bot.telegram.setWebhook(webhookUrl(), {
    secret_token: webhookSecret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
  });
  if (info.url !== '') console.log('🔁 Bot webhook manzili qayta o‘rnatildi');
}

function ensureWebhookSafe() {
  if (stopping) return;
  ensureWebhook().catch((err) => console.error('Webhook tekshiruvi:', safeMsg(err)));
}

export async function startBot() {
  try {
    const me = await bot.telegram.getMe();
    botUsername = me.username;
    console.log(`🤖 Bot ishga tushdi: @${me.username}`);

    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Buyurtma berish' },
      { command: 'id', description: 'Telegram ID raqamim' },
    ]);

    // Manzil bo'lmasa, menyu tugmasini oddiy holatga qaytaramiz - eski (o'chgan) manzil qolib ketmasin
    await bot.telegram.setChatMenuButton({
      menuButton: isHttps(config.miniappUrl)
        ? { type: 'web_app', text: 'Buyurtma', web_app: { url: config.miniappUrl } }
        : { type: 'default' },
    });

    if (config.botWebhookBase) {
      // Hostingda: webhook. Telegram yangilanishni serverga yuboradi va uxlab qolgan serverni uyg'otadi.
      bot.botInfo = me;
      await ensureWebhook();
      console.log('🤖 Bot webhook rejimida ishlaydi');
      // Deploy paytida eski nusxa webhook'ni o'chirib yuborishi mumkin - vaqti-vaqti bilan tekshirib turamiz
      setTimeout(ensureWebhookSafe, 30_000);
      webhookTimer = setInterval(ensureWebhookSafe, 2 * 60_000);
      webhookTimer.unref();
    } else {
      // Kompyuterda: polling. launch() bot to'xtaguncha tugamaydi, shuning uchun kutmaymiz
      launch(true);
    }
  } catch (err) {
    console.error("❌ Botni ishga tushirib bo'lmadi. BOT_TOKEN to'g'rimi? Internet bormi?", safeMsg(err));
    if (!stopping) setTimeout(startBot, RETRY_MS);
  }
}

export function stopBot(reason) {
  stopping = true;
  clearInterval(webhookTimer);
  try {
    bot.stop(reason);
  } catch {
    /* bot ishlamayotgan bo'lishi mumkin */
  }
}
