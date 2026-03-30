import TelegramBot from "node-telegram-bot-api";
import { db, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

let bot: TelegramBot | null = null;

export function sendTelegramNotification(chatId: string, message: string): Promise<void> {
  if (!bot) return Promise.resolve();
  return bot.sendMessage(chatId, message).then(() => {});
}

export function initTelegramBot(token: string) {
  try {
    bot = new TelegramBot(token, { polling: true });

    bot.on("message", async (msg) => {
      const chatId = String(msg.chat.id);
      const text = msg.text?.trim() ?? "";

      try {
        // Check if client exists
        let client = await db.query.clientsTable.findFirst({
          where: eq(clientsTable.telegramUserId, chatId),
        });

        if (text === "/start") {
          // Reset or start registration
          if (client) {
            await db.update(clientsTable).set({
              registrationStep: "first_name",
              tempData: null,
              status: "pending",
            }).where(eq(clientsTable.id, client.id));
            client = { ...client, registrationStep: "first_name", tempData: null, status: "pending" };
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
          await bot!.sendMessage(chatId, "Xush kelibsiz! Ro'yxatdan o'tish uchun to'liq ismingizni yuboring:");
          return;
        }

        if (!client) {
          await bot!.sendMessage(chatId, "Ro'yxatdan o'tish uchun /start bosing.");
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
          await bot!.sendMessage(chatId, "Familiyangizni to'liq yozing:");

        } else if (step === "last_name") {
          tempData.lastName = text;
          await db.update(clientsTable).set({
            registrationStep: "phone",
            tempData: JSON.stringify(tempData),
          }).where(eq(clientsTable.id, client.id));
          await bot!.sendMessage(
            chatId,
            "BIZ SIZNING XOZRGI FAOL ISHLAYOTGAN VA BIZGA BERILADIGAN ZAKAZLARINGIZNING OXIRGI 4 RAQAMDAN IBORAT BO'LGAN RAQAMINGIZNING TO'LIQ YOZIB BERISHINGIZNI ILTIMOS QILAMIZ +998 KERAK EMAS FAQAT XX-XXX-XX-XX TALAB ETILADI XOLOS"
          );

        } else if (step === "phone") {
          tempData.phone = text;
          await db.update(clientsTable).set({
            firstName: tempData.firstName,
            lastName: tempData.lastName,
            phone: tempData.phone,
            registrationStep: "done",
            tempData: null,
          }).where(eq(clientsTable.id, client.id));
          await bot!.sendMessage(
            chatId,
            "Sizning so'rovingiz adminga yuborildi. Admin tasdiqlagandan so'ng siz bizning do'konimiz xaridoriga aylanasiz."
          );

        } else if (step === "done") {
          if (client.status === "approved") {
            await bot!.sendMessage(chatId, "Siz allaqachon tasdiqlanGansiz. Buyurtmalaringizni kuzatishingiz mumkin.");
          } else if (client.status === "pending") {
            await bot!.sendMessage(chatId, "So'rovingiz hali ko'rib chiqilmoqda. Iltimos, kuting.");
          } else {
            await bot!.sendMessage(chatId, "Sizning so'rovingiz rad etildi. /start bosib qayta ro'yxatdan o'ting.");
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
