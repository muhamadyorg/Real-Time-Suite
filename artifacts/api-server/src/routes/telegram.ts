import TelegramBot from "node-telegram-bot-api";
import { db, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

let globalBot: TelegramBot | null = null;
const storeBots = new Map<number, TelegramBot>();

export async function initStoreBots() {
  try {
    const stores = await db.query.storesTable.findMany();
    for (const store of stores) {
      if (store.telegramBotToken) {
        try {
          const bot = new TelegramBot(store.telegramBotToken, { polling: false });
          storeBots.set(store.id, bot);
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
  if (storeBots.has(storeId)) {
    storeBots.delete(storeId);
  }
  if (token) {
    try {
      const bot = new TelegramBot(token, { polling: false });
      storeBots.set(storeId, bot);
      logger.info({ storeId }, "Store bot updated");
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

export function sendTelegramNotification(chatId: string, message: string): Promise<void> {
  const bot = globalBot;
  if (!bot) return Promise.resolve();
  return bot.sendMessage(chatId, message, { parse_mode: "HTML" }).then(() => {}).catch((err) => {
    logger.warn({ err, chatId }, "Telegram send failed");
  });
}

export function initTelegramBot(token: string) {
  try {
    globalBot = new TelegramBot(token, { polling: true });

    globalBot.on("polling_error", (err: any) => {
      if (err?.code === "ETELEGRAM" && (err?.response?.statusCode === 401 || err?.message?.includes("401"))) {
        logger.warn("Telegram bot token yaroqsiz (401) — polling to'xtatildi");
        try { globalBot?.stopPolling(); } catch (_) {}
        globalBot = null;
      }
    });

    globalBot.on("message", async (msg) => {
      const chatId = String(msg.chat.id);
      const text = msg.text?.trim() ?? "";

      try {
        let client = await db.query.clientsTable.findFirst({
          where: eq(clientsTable.telegramUserId, chatId),
        });

        if (text === "/start") {
          if (client && client.registrationStep === "done") {
            if (client.status === "rejected") {
              await globalBot!.sendMessage(
                chatId,
                `👋 <b>Xush kelibsiz!</b>\n\n` +
                `❌ Afsuski, so'rovingiz rad etilgan.\n\n` +
                `Qayta ro'yxatdan o'tish uchun /reregister buyrug'ini yuboring.`,
                { parse_mode: "HTML" }
              );
            } else {
              const statusText = client.status === "approved"
                ? "✅ <b>Tasdiqlangan mijoz</b>"
                : "⏳ <b>Tasdiqlanish kutilmoqda</b>";
              await globalBot!.sendMessage(
                chatId,
                `👋 <b>Xush kelibsiz!</b>\n\n` +
                `ℹ️ Siz allaqachon ro'yxatdan o'tgansiz:\n\n` +
                `👤 Ism: <b>${client.firstName} ${client.lastName}</b>\n` +
                `📱 Telefon: <b>${client.phone}</b>\n` +
                `📊 Holat: ${statusText}`,
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
            }).where(eq(clientsTable.id, client.id));
          } else {
            const [newClient] = await db.insert(clientsTable).values({
              firstName: "",
              lastName: "",
              phone: "",
              telegramUserId: chatId,
              status: "pending",
              registrationStep: "first_name",
              tempData: null,
            }).returning();
            client = newClient;
          }

          await globalBot!.sendMessage(
            chatId,
            "👋 <b>Xush kelibsiz!</b>\n\n🎉 Bizning do'kon botiga xush kelibsiz!\n\nRo'yxatdan o'tish uchun bir necha qadam bajarishingiz kerak.\n\n📝 <b>Ismingizni kiriting:</b>",
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
            }).where(eq(clientsTable.id, client.id));
            await globalBot!.sendMessage(chatId, "📝 <b>Ismingizni kiriting:</b>", { parse_mode: "HTML" });
          } else if (client && client.status !== "rejected") {
            await globalBot!.sendMessage(chatId, "ℹ️ Bu buyruq faqat rad etilgan foydalanuvchilar uchun.", { parse_mode: "HTML" });
          } else {
            await globalBot!.sendMessage(chatId, "❓ Ro'yxatdan o'tish uchun /start ni bosing.", { parse_mode: "HTML" });
          }
          return;
        }

        if (!client) {
          await globalBot!.sendMessage(chatId, "❓ Ro'yxatdan o'tish uchun /start ni bosing.", { parse_mode: "HTML" });
          return;
        }

        const step = client.registrationStep;
        const tempData = client.tempData ? JSON.parse(client.tempData) : {};

        if (step === "first_name") {
          tempData.firstName = text;
          await db.update(clientsTable).set({
            registrationStep: "last_name",
            tempData: JSON.stringify(tempData),
          }).where(eq(clientsTable.id, client.id));
          await globalBot!.sendMessage(chatId, `✅ <b>Ism:</b> ${text}\n\n👤 Endi <b>Familiyangizni</b> kiriting:`, { parse_mode: "HTML" });

        } else if (step === "last_name") {
          tempData.lastName = text;
          await db.update(clientsTable).set({
            registrationStep: "phone",
            tempData: JSON.stringify(tempData),
          }).where(eq(clientsTable.id, client.id));
          await globalBot!.sendMessage(chatId, `✅ <b>Familiya:</b> ${text}\n\n📱 Endi <b>telefon raqamingizni</b> kiriting:\n\n<i>Faqat raqamlarni kiriting, masalan: 901234567</i>`, { parse_mode: "HTML" });

        } else if (step === "phone") {
          tempData.phone = text;
          await db.update(clientsTable).set({
            firstName: tempData.firstName,
            lastName: tempData.lastName,
            phone: tempData.phone,
            registrationStep: "done",
            tempData: null,
          }).where(eq(clientsTable.id, client.id));
          await globalBot!.sendMessage(
            chatId,
            `🎊 <b>Ro'yxatdan o'tdingiz!</b>\n\n` +
            `👤 Ism: <b>${tempData.firstName} ${tempData.lastName}</b>\n` +
            `📱 Telefon: <b>${tempData.phone}</b>\n\n` +
            `⏳ So'rovingiz admin tomonidan ko'rib chiqilmoqda.\n` +
            `✨ Tasdiqlangandan so'ng siz bizning <b>rasmiy mijozimiz</b> bo'lasiz!`,
            { parse_mode: "HTML" }
          );

        } else if (step === "done") {
          if (client.status === "approved") {
            await globalBot!.sendMessage(chatId, "🌟 <b>Siz tasdiqlangan mijozimiz!</b>\n\n✅ Buyurtmalaringiz holati haqida xabar olasiz.\n\n💎 Bizga ishonganingiz uchun rahmat!", { parse_mode: "HTML" });
          } else if (client.status === "pending") {
            await globalBot!.sendMessage(chatId, "⏳ <b>So'rovingiz ko'rib chiqilmoqda...</b>\n\nAdmin tasdiqlashi bilanoq sizga xabar beramiz. Sabr qiling! 🙏", { parse_mode: "HTML" });
          } else {
            await globalBot!.sendMessage(chatId, "❌ <b>Afsuski, so'rovingiz rad etildi.</b>\n\nQayta ro'yxatdan o'tish uchun /start ni bosing.", { parse_mode: "HTML" });
          }
        }
      } catch (err) {
        logger.error({ err }, "Telegram bot error");
      }
    });

    logger.info("Telegram bot initialized successfully");
  } catch (err) {
    logger.error({ err }, "Failed to initialize Telegram bot");
  }
}
