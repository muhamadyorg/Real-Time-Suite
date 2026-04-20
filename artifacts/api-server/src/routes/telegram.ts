import TelegramBot from "node-telegram-bot-api";
import { db, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

let globalBot: TelegramBot | null = null;
let globalBotToken: string | null = null;
const storeBots = new Map<number, TelegramBot>();
const storeTokens = new Map<number, string>(); // storeId -> token

// Bot status uchun
export function getBotStatus(): { global: boolean; stores: { storeId: number; active: boolean }[] } {
  return {
    global: globalBot !== null,
    stores: Array.from(storeTokens.keys()).map((storeId) => ({
      storeId,
      active: storeBots.has(storeId),
    })),
  };
}

// Shared registration handler — global bot yoki har bir do'kon boti uchun
function setupBotHandlers(bot: TelegramBot, storeId: number | null, storeName = "Do'kon", token: string) {
  let restartTimer: NodeJS.Timeout | null = null;
  let restartDelay = 5000;

  const scheduleRestart = () => {
    if (restartTimer) return;
    restartTimer = setTimeout(async () => {
      restartTimer = null;
      try {
        await bot.startPolling({ restart: false });
        restartDelay = 5000;
        logger.info({ storeId }, "Bot polling qayta boshlandi");
      } catch (e: any) {
        logger.warn({ storeId, err: e?.message }, "Bot polling qayta boshlash muvaffaqiyatsiz");
        restartDelay = Math.min(restartDelay * 2, 120_000);
        scheduleRestart();
      }
    }, restartDelay);
  };

  bot.on("polling_error", (err: any) => {
    const statusCode = err?.response?.statusCode ?? 0;
    const msg = err?.message ?? "";
    const is401 = err?.code === "ETELEGRAM" && (statusCode === 401 || msg.includes("401"));

    if (is401) {
      logger.warn({ storeId }, "Telegram bot token yaroqsiz (401) — polling to'xtatildi");
      try { bot.stopPolling(); } catch (_) {}
      if (storeId !== null) { storeBots.delete(storeId); storeTokens.delete(storeId); }
      else { globalBot = null; globalBotToken = null; }
      if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
    } else {
      logger.warn({ storeId, statusCode, err: msg }, "Bot polling xatosi — qayta uriniladi");
      restartDelay = Math.min(restartDelay * 2, 120_000);
      scheduleRestart();
    }
  });

  bot.on("message", async (msg) => {
    const chatId = String(msg.chat.id);
    const text = msg.text?.trim() ?? "";

    try {
      let client = await db.query.clientsTable.findFirst({
        where: eq(clientsTable.telegramUserId, chatId),
      });

      if (text === "/start") {
        if (client && client.registrationStep === "done") {
          await bot.sendMessage(
            chatId,
            `👋 <b>Xush kelibsiz, ${client.firstName}!</b>\n\n✅ Siz bizning mijozimiz siz.\n\n👤 Ism: <b>${client.firstName} ${client.lastName}</b>\n📱 Telefon: <b>${client.phone}</b>\n\n💎 Buyurtmalaringiz haqida xabar olasiz.`,
            { parse_mode: "HTML" }
          );
          return;
        }

        if (client) {
          await db.update(clientsTable).set({
            registrationStep: "first_name",
            tempData: null,
            status: "pending",
            botStoreId: storeId,
          }).where(eq(clientsTable.id, client.id));
        } else {
          const [newClient] = await db.insert(clientsTable).values({
            firstName: "",
            lastName: "",
            phone: "",
            telegramUserId: chatId,
            botStoreId: storeId,
            status: "pending",
            registrationStep: "first_name",
            tempData: null,
          }).returning();
          client = newClient;
        }

        await bot.sendMessage(
          chatId,
          `👋 <b>Xush kelibsiz!</b>\n\n🏪 <b>${storeName}</b> botiga xush kelibsiz!\n\nRo'yxatdan o'tish uchun bir necha qadam bajarishingiz kerak.\n\n📝 <b>Ismingizni kiriting:</b>`,
          { parse_mode: "HTML" }
        );
        return;
      }

      if (text === "/reregister") {
        if (client && client.status === "rejected") {
          await db.update(clientsTable).set({
            registrationStep: "first_name",
            tempData: null,
            status: "pending",
            firstName: "",
            lastName: "",
            phone: "",
            botStoreId: storeId,
          }).where(eq(clientsTable.id, client.id));
          await bot.sendMessage(chatId, "📝 <b>Ismingizni kiriting:</b>", { parse_mode: "HTML" });
        } else if (client && client.status !== "rejected") {
          await bot.sendMessage(chatId, "ℹ️ Bu buyruq faqat rad etilgan foydalanuvchilar uchun.", { parse_mode: "HTML" });
        } else {
          await bot.sendMessage(chatId, "❓ Ro'yxatdan o'tish uchun /start ni bosing.", { parse_mode: "HTML" });
        }
        return;
      }

      if (!client) {
        await bot.sendMessage(chatId, "❓ Ro'yxatdan o'tish uchun /start ni bosing.", { parse_mode: "HTML" });
        return;
      }

      const step = client.registrationStep;
      const tempData = client.tempData ? JSON.parse(client.tempData) : {};

      if (step === "first_name") {
        tempData.firstName = text;
        await db.update(clientsTable).set({ registrationStep: "phone", tempData: JSON.stringify(tempData) }).where(eq(clientsTable.id, client.id));
        await bot.sendMessage(chatId, `✅ <b>Ism:</b> ${text}\n\n📱 Endi <b>to'liq telefon raqamingizni</b> kiriting:\n\n<i>Masalan: +998901234567 yoki 998901234567</i>`, { parse_mode: "HTML" });

      } else if (step === "phone") {
        tempData.phone = text;
        // Familiya o'rniga raqamning oxirgi 4 ta raqami
        const digits = text.replace(/\D/g, "");
        const autoLastName = digits.slice(-4);
        await db.update(clientsTable).set({
          firstName: tempData.firstName,
          lastName: autoLastName,
          phone: tempData.phone,
          registrationStep: "done",
          status: "approved",
          tempData: null,
        }).where(eq(clientsTable.id, client.id));
        await bot.sendMessage(
          chatId,
          `🎊 <b>Ro'yxatdan muvaffaqiyatli o'tdingiz!</b>\n\n👤 Ism: <b>${tempData.firstName}</b>\n📱 Telefon: <b>${tempData.phone}</b>\n\n✅ Siz bizning <b>rasmiy mijozimiz</b>siz!\n💎 Bizga ishonganingiz uchun rahmat!`,
          { parse_mode: "HTML" }
        );

      } else if (step === "done") {
        await bot.sendMessage(chatId, "🌟 <b>Siz bizning mijozimiz siz!</b>\n\n✅ Buyurtmalaringiz holati haqida xabar olasiz.\n\n💎 Bizga ishonganingiz uchun rahmat!", { parse_mode: "HTML" });
      }
    } catch (err) {
      logger.error({ err }, "Telegram bot message handler error");
    }
  });
}

export async function initStoreBots() {
  try {
    const stores = await db.query.storesTable.findMany();
    for (const store of stores) {
      if (!store.telegramBotToken) continue;
      // Skip if already initialized with same token
      if (storeTokens.get(store.id) === store.telegramBotToken && storeBots.has(store.id)) continue;
      // Stop existing bot if token changed
      const existing = storeBots.get(store.id);
      if (existing) { try { existing.stopPolling(); } catch (_) {} storeBots.delete(store.id); }
      try {
        const bot = new TelegramBot(store.telegramBotToken, { polling: true });
        storeBots.set(store.id, bot);
        storeTokens.set(store.id, store.telegramBotToken);
        setupBotHandlers(bot, store.id, store.name, store.telegramBotToken);
        logger.info({ storeId: store.id, storeName: store.name }, "Store bot initialized");
      } catch (_e) {
        logger.warn({ storeId: store.id }, "Failed to init store bot");
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to init store bots");
  }
}

export async function checkAllBots() {
  try {
    const stores = await db.query.storesTable.findMany();
    for (const store of stores) {
      const token = store.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
      if (!token) continue;
      try {
        const bot = new TelegramBot(token, { polling: false });
        const me = await bot.getMe();
        logger.info({ storeId: store.id, storeName: store.name, botUsername: me.username }, "Bot ishlayapti");
      } catch (e: any) {
        logger.warn({ storeId: store.id, err: e?.message }, "Bot xatosi");
      }
    }
  } catch (err) {
    logger.error({ err }, "checkAllBots xatosi");
  }
}

export function updateStoreBot(storeId: number, token: string | null) {
  const existing = storeBots.get(storeId);
  if (existing) {
    try { existing.stopPolling(); } catch (_) {}
    storeBots.delete(storeId);
    storeTokens.delete(storeId);
  }
  if (token) {
    // Don't start if this token is the same as global bot token
    if (globalBotToken && token === globalBotToken) {
      logger.warn({ storeId }, "Store bot token is same as global bot — skipping duplicate polling");
      return;
    }
    try {
      db.query.storesTable.findFirst({ where: (t, { eq: e }) => e(t.id, storeId) }).then((store) => {
        const bot = new TelegramBot(token, { polling: true });
        storeBots.set(storeId, bot);
        storeTokens.set(storeId, token);
        setupBotHandlers(bot, storeId, store?.name ?? "Do'kon", token);
        logger.info({ storeId }, "Store bot updated");
      }).catch(() => {
        const bot = new TelegramBot(token, { polling: true });
        storeBots.set(storeId, bot);
        storeTokens.set(storeId, token);
        setupBotHandlers(bot, storeId, "Do'kon", token);
        logger.info({ storeId }, "Store bot updated");
      });
    } catch (_e) {
      logger.warn({ storeId }, "Failed to update store bot");
    }
  }
}

export async function notifyStoreAdmin(storeId: number, message: string): Promise<void> {
  try {
    const store = await db.query.storesTable.findFirst({ where: (t, { eq: e }) => e(t.id, storeId) });
    if (!store?.telegramChatId) return;
    const token = store.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    const bot = store.telegramBotToken ? (storeBots.get(storeId) ?? new TelegramBot(token, { polling: false })) : (globalBot ?? new TelegramBot(token, { polling: false }));
    await bot.sendMessage(store.telegramChatId, message, { parse_mode: "HTML" });
  } catch (err: any) {
    logger.warn({ storeId, err: err?.message }, "notifyStoreAdmin: xabar yuborilmadi");
  }
}

// storeId — mijoz qaysi bot bilan ro'yxatdan o'tganligi (client.botStoreId)
export function sendTelegramNotification(chatId: string, message: string, storeId?: number): Promise<void> {
  let bot: TelegramBot | null = null;
  if (storeId !== undefined && storeBots.has(storeId)) {
    bot = storeBots.get(storeId)!;
  } else {
    bot = globalBot;
  }
  if (!bot) return Promise.resolve();
  return bot.sendMessage(chatId, message, { parse_mode: "HTML" }).then(() => {}).catch((err) => {
    logger.warn({ err: err?.message, chatId, storeId }, "Telegram send failed");
  });
}

export function initTelegramBot(token: string) {
  // Don't start global bot if same token is already used by a store bot
  for (const [sid, storeToken] of storeTokens.entries()) {
    if (storeToken === token) {
      logger.warn({ storeId: sid }, "Global bot token same as store bot token — skipping global bot to avoid conflict");
      return;
    }
  }
  try {
    if (globalBot) { try { globalBot.stopPolling(); } catch (_) {} }
    globalBot = new TelegramBot(token, { polling: true });
    globalBotToken = token;
    setupBotHandlers(globalBot, null, "Do'kon", token);
    logger.info("Global Telegram bot initialized successfully");
  } catch (err) {
    logger.error({ err }, "Failed to initialize Telegram bot");
  }
}
