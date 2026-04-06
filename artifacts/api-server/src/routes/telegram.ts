import TelegramBot from "node-telegram-bot-api";
import { db, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

let globalBot: TelegramBot | null = null;
const storeBots = new Map<number, TelegramBot>();

// Shared registration handler — global bot yoki har bir do'kon boti uchun
function setupBotHandlers(bot: TelegramBot, storeId: number | null, storeName = "Do'kon") {
  bot.on("polling_error", (err: any) => {
    const is401 = err?.code === "ETELEGRAM" && (err?.response?.statusCode === 401 || err?.message?.includes("401"));
    if (is401) {
      logger.warn({ storeId }, "Telegram bot token yaroqsiz (401) — polling to'xtatildi");
      try { bot.stopPolling(); } catch (_) {}
      if (storeId !== null) storeBots.delete(storeId);
      else globalBot = null;
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
          if (client.status === "rejected") {
            await bot.sendMessage(
              chatId,
              `👋 <b>Xush kelibsiz!</b>\n\n❌ Afsuski, so'rovingiz rad etilgan.\n\nQayta ro'yxatdan o'tish uchun /reregister buyrug'ini yuboring.`,
              { parse_mode: "HTML" }
            );
          } else {
            const statusText = client.status === "approved"
              ? "✅ <b>Tasdiqlangan mijoz</b>"
              : "⏳ <b>Tasdiqlanish kutilmoqda</b>";
            await bot.sendMessage(
              chatId,
              `👋 <b>Xush kelibsiz!</b>\n\nℹ️ Siz allaqachon ro'yxatdan o'tgansiz:\n\n👤 Ism: <b>${client.firstName} ${client.lastName}</b>\n📱 Telefon: <b>${client.phone}</b>\n📊 Holat: ${statusText}`,
              { parse_mode: "HTML" }
            );
          }
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
        await db.update(clientsTable).set({ registrationStep: "last_name", tempData: JSON.stringify(tempData) }).where(eq(clientsTable.id, client.id));
        await bot.sendMessage(chatId, `✅ <b>Ism:</b> ${text}\n\n👤 Endi <b>Familiyangizni</b> kiriting:`, { parse_mode: "HTML" });

      } else if (step === "last_name") {
        tempData.lastName = text;
        await db.update(clientsTable).set({ registrationStep: "phone", tempData: JSON.stringify(tempData) }).where(eq(clientsTable.id, client.id));
        await bot.sendMessage(chatId, `✅ <b>Familiya:</b> ${text}\n\n📱 Endi <b>telefon raqamingizni</b> kiriting:\n\n<i>Faqat raqamlarni kiriting, masalan: 901234567</i>`, { parse_mode: "HTML" });

      } else if (step === "phone") {
        tempData.phone = text;
        await db.update(clientsTable).set({
          firstName: tempData.firstName,
          lastName: tempData.lastName,
          phone: tempData.phone,
          registrationStep: "done",
          tempData: null,
        }).where(eq(clientsTable.id, client.id));
        await bot.sendMessage(
          chatId,
          `🎊 <b>Ro'yxatdan o'tdingiz!</b>\n\n👤 Ism: <b>${tempData.firstName} ${tempData.lastName}</b>\n📱 Telefon: <b>${tempData.phone}</b>\n\n⏳ So'rovingiz admin tomonidan ko'rib chiqilmoqda.\n✨ Tasdiqlangandan so'ng siz bizning <b>rasmiy mijozimiz</b> bo'lasiz!`,
          { parse_mode: "HTML" }
        );

      } else if (step === "done") {
        if (client.status === "approved") {
          await bot.sendMessage(chatId, "🌟 <b>Siz tasdiqlangan mijozimiz!</b>\n\n✅ Buyurtmalaringiz holati haqida xabar olasiz.\n\n💎 Bizga ishonganingiz uchun rahmat!", { parse_mode: "HTML" });
        } else if (client.status === "pending") {
          await bot.sendMessage(chatId, "⏳ <b>So'rovingiz ko'rib chiqilmoqda...</b>\n\nAdmin tasdiqlashi bilanoq sizga xabar beramiz. Sabr qiling! 🙏", { parse_mode: "HTML" });
        } else {
          await bot.sendMessage(chatId, "❌ <b>Afsuski, so'rovingiz rad etildi.</b>\n\nQayta ro'yxatdan o'tish uchun /start ni bosing.", { parse_mode: "HTML" });
        }
      }
    } catch (err) {
      logger.error({ err }, "Telegram bot error");
    }
  });
}

export async function initStoreBots() {
  try {
    const stores = await db.query.storesTable.findMany();
    for (const store of stores) {
      if (store.telegramBotToken) {
        try {
          const bot = new TelegramBot(store.telegramBotToken, { polling: true });
          storeBots.set(store.id, bot);
          setupBotHandlers(bot, store.id, store.name);
          logger.info({ storeId: store.id, storeName: store.name }, "Store bot initialized");
        } catch (_e) {
          logger.warn({ storeId: store.id }, "Failed to init store bot");
        }
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
  }
  if (token) {
    try {
      db.query.storesTable.findFirst({ where: (t, { eq: e }) => e(t.id, storeId) }).then((store) => {
        const bot = new TelegramBot(token, { polling: true });
        storeBots.set(storeId, bot);
        setupBotHandlers(bot, storeId, store?.name ?? "Do'kon");
        logger.info({ storeId }, "Store bot updated");
      }).catch(() => {
        const bot = new TelegramBot(token, { polling: true });
        storeBots.set(storeId, bot);
        setupBotHandlers(bot, storeId, "Do'kon");
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
  try {
    globalBot = new TelegramBot(token, { polling: true });
    setupBotHandlers(globalBot, null, "Do'kon");
    logger.info("Telegram bot initialized successfully");
  } catch (err) {
    logger.error({ err }, "Failed to initialize Telegram bot");
  }
}
