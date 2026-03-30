import TelegramBot from "node-telegram-bot-api";
import { db, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

let bot: TelegramBot | null = null;

export function sendTelegramNotification(chatId: string, message: string): Promise<void> {
  if (!bot) return Promise.resolve();
  return bot.sendMessage(chatId, message, { parse_mode: "HTML" }).then(() => {});
}

export function initTelegramBot(token: string) {
  try {
    bot = new TelegramBot(token, { polling: true });

    bot.on("message", async (msg) => {
      const chatId = String(msg.chat.id);
      const text = msg.text?.trim() ?? "";

      try {
        let client = await db.query.clientsTable.findFirst({
          where: eq(clientsTable.telegramUserId, chatId),
        });

        if (text === "/start") {
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

          await bot!.sendMessage(
            chatId,
            "👋 <b>Xush kelibsiz!</b>\n\n🎉 Bizning do'kon botiga xush kelibsiz!\n\nRo'yxatdan o'tish uchun bir necha qadam bajarishingiz kerak.\n\n📝 <b>Ismingizni kiriting:</b>",
            { parse_mode: "HTML" }
          );
          return;
        }

        if (!client) {
          await bot!.sendMessage(
            chatId,
            "❓ Ro'yxatdan o'tish uchun /start ni bosing.",
            { parse_mode: "HTML" }
          );
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

          await bot!.sendMessage(
            chatId,
            `✅ <b>Ism:</b> ${text}\n\n👤 Endi <b>Familiyangizni</b> kiriting:`,
            { parse_mode: "HTML" }
          );

        } else if (step === "last_name") {
          tempData.lastName = text;
          await db.update(clientsTable).set({
            registrationStep: "phone",
            tempData: JSON.stringify(tempData),
          }).where(eq(clientsTable.id, client.id));

          await bot!.sendMessage(
            chatId,
            `✅ <b>Familiya:</b> ${text}\n\n📱 Endi <b>telefon raqamingizni</b> kiriting:\n\n<i>Faqat raqamlarni kiriting, masalan: 901234567</i>`,
            { parse_mode: "HTML" }
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
            `🎊 <b>Ro'yxatdan o'tdingiz!</b>\n\n` +
            `👤 Ism: <b>${tempData.firstName} ${tempData.lastName}</b>\n` +
            `📱 Telefon: <b>${tempData.phone}</b>\n\n` +
            `⏳ So'rovingiz admin tomonidan ko'rib chiqilmoqda.\n` +
            `✨ Tasdiqlangandan so'ng siz bizning <b>rasmiy mijozimiz</b> bo'lasiz!`,
            { parse_mode: "HTML" }
          );

        } else if (step === "done") {
          if (client.status === "approved") {
            await bot!.sendMessage(
              chatId,
              "🌟 <b>Siz tasdiqlangan mijozimiz!</b>\n\n✅ Buyurtmalaringiz holati haqida xabar olasiz.\n\n💎 Bizga ishonganingiz uchun rahmat!",
              { parse_mode: "HTML" }
            );
          } else if (client.status === "pending") {
            await bot!.sendMessage(
              chatId,
              "⏳ <b>So'rovingiz ko'rib chiqilmoqda...</b>\n\nAdmin tasdiqlashi bilanoq sizga xabar beramiz. Sabr qiling! 🙏",
              { parse_mode: "HTML" }
            );
          } else {
            await bot!.sendMessage(
              chatId,
              "❌ <b>Afsuski, so'rovingiz rad etildi.</b>\n\nQayta ro'yxatdan o'tish uchun /start ni bosing.",
              { parse_mode: "HTML" }
            );
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
