import { Telegraf, Markup } from 'telegraf';
import { config } from './config.js';
import { esc, money } from './lib/format.js';

export const bot = new Telegraf(config.botToken);

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
  },
  ru: {
    hello: 'Здравствуйте! 🥗 Добро пожаловать в <b>Salaty By Nargiz</b>.\nНажмите кнопку ниже, чтобы сделать заказ.',
    open: '🛒 Сделать заказ',
    noApp: 'Адрес приложения ещё не настроен. Администратор должен указать MINIAPP_URL.',
    success: 'Ваш заказ успешно принят! Курьер скоро свяжется с вами 🍕',
    delivered: 'Ваш заказ #{id} доставлен. Приятного аппетита! 🥗',
    cancelled: 'Ваш заказ #{id} отменён. Если есть вопросы, свяжитесь с нами.',
  },
  en: {
    hello: 'Hello! 🥗 Welcome to <b>Salaty By Nargiz</b>.\nTap the button below to place an order.',
    open: '🛒 Order now',
    noApp: 'The app address is not configured yet. The admin must set MINIAPP_URL.',
    success: 'Your order has been received! Our courier will contact you soon 🍕',
    delivered: 'Your order #{id} has been delivered. Enjoy your meal! 🥗',
    cancelled: 'Your order #{id} has been cancelled. If you have questions, please contact us.',
  },
};

const DELIVERY = { DELIVERY: '🚚 Yetkazib berish', PICKUP: '🏃 Olib ketish' };
const PAYMENT = { CASH: '💵 Naqd', CLICK: '💳 Click', PAYME: '💳 Payme' };

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

    // launch() bot to'xtaguncha tugamaydi, shuning uchun kutmaymiz
    launch(true);
  } catch (err) {
    console.error("❌ Botni ishga tushirib bo'lmadi. BOT_TOKEN to'g'rimi? Internet bormi?", safeMsg(err));
    if (!stopping) setTimeout(startBot, RETRY_MS);
  }
}

export function stopBot(reason) {
  stopping = true;
  try {
    bot.stop(reason);
  } catch {
    /* bot ishlamayotgan bo'lishi mumkin */
  }
}
