import { Router } from "express";
import TelegramBot from "node-telegram-bot-api";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";
import { authenticateToken } from "../lib/auth";
import { getBotStatus } from "./telegram";

const router = Router();

// GET /api/telegram/status — sudo only — bot holati va do'kon ma'lumotlari
router.get("/status", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || !["sudo", "superadmin", "admin"].includes(payload.role)) {
      res.status(401).json({ error: "Ruxsat yo'q" });
      return;
    }

    const stores = await db.query.storesTable.findMany();
    const botStatus = getBotStatus();
    const globalToken = process.env.TELEGRAM_BOT_TOKEN;

    const storeInfo = await Promise.all(stores.map(async (s) => {
      const hasToken = !!s.telegramBotToken;
      const hasChatId = !!s.telegramChatId;
      const isActive = botStatus.stores.find(b => b.storeId === s.id)?.active ?? false;

      let botUsername: string | null = null;
      if (hasToken) {
        try {
          const bot = new TelegramBot(s.telegramBotToken!, { polling: false });
          const me = await bot.getMe();
          botUsername = me.username ?? null;
        } catch (_) {
          botUsername = null;
        }
      }

      return {
        storeId: s.id,
        storeName: s.name,
        hasToken,
        hasChatId,
        chatId: s.telegramChatId,
        isPolling: isActive,
        botUsername,
        tokenValid: botUsername !== null,
      };
    }));

    let globalBotUsername: string | null = null;
    let globalTokenValid = false;
    if (globalToken) {
      try {
        const bot = new TelegramBot(globalToken, { polling: false });
        const me = await bot.getMe();
        globalBotUsername = me.username ?? null;
        globalTokenValid = true;
      } catch (_) {}
    }

    res.json({
      globalBot: {
        hasToken: !!globalToken,
        isPolling: botStatus.global,
        botUsername: globalBotUsername,
        tokenValid: globalTokenValid,
      },
      stores: storeInfo,
    });
  } catch (err) {
    logger.error({ err }, "telegram/status error");
    res.status(500).json({ error: "Server xatosi" });
  }
});

// POST /api/telegram/test — sudo only — test xabar yuborish
router.post("/test", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || payload.role !== "sudo") {
      res.status(401).json({ error: "Ruxsat yo'q" });
      return;
    }

    const { storeId, chatId, token, message } = req.body as {
      storeId?: number;
      chatId?: string;
      token?: string;
      message?: string;
    };

    const testMsg = message || "✅ Test xabari muvaffaqiyatli yetib keldi!";

    if (!chatId) {
      res.status(400).json({ error: "chatId kiritilmagan" });
      return;
    }

    let botToken = token;
    if (!botToken && storeId) {
      const store = await db.query.storesTable.findFirst({ where: (t, { eq }) => eq(t.id, storeId) });
      botToken = store?.telegramBotToken ?? undefined;
    }
    if (!botToken) {
      botToken = process.env.TELEGRAM_BOT_TOKEN;
    }
    if (!botToken) {
      res.status(400).json({ error: "Bot token topilmadi" });
      return;
    }

    try {
      const bot = new TelegramBot(botToken, { polling: false });
      await bot.sendMessage(chatId, testMsg, { parse_mode: "HTML" });
      res.json({ success: true, message: "Xabar yuborildi" });
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "Xabar yuborishda xato" });
    }
  } catch (err) {
    logger.error({ err }, "telegram/test error");
    res.status(500).json({ error: "Server xatosi" });
  }
});

export default router;
