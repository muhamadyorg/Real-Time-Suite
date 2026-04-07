import { Router } from "express";
import { db, clientsTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";
import { authenticateToken } from "../lib/auth";
import { sendTelegramNotification } from "./telegram";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload) {
      res.status(401).json({ error: "Ruxsat yo'q" });
      return;
    }

    const isWorkerOrViewer = ["worker", "viewer"].includes(payload.role);
    if (!["sudo", "superadmin", "admin", "worker", "viewer"].includes(payload.role)) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }

    const { search, status } = req.query as { search?: string; status?: string };

    let clients = await db.query.clientsTable.findMany({
      orderBy: (t, { desc }) => desc(t.createdAt),
    });

    // Workers and viewers can only see approved clients
    if (isWorkerOrViewer) {
      clients = clients.filter((c) => c.status === "approved");
    } else if (status && ["pending", "approved", "rejected"].includes(status)) {
      clients = clients.filter((c) => c.status === status);
    }

    if (search) {
      const q = search.toLowerCase();
      clients = clients.filter((c) =>
        [c.firstName, c.lastName, c.phone, c.telegramUserId]
          .some((v) => v && v.toLowerCase().includes(q))
      );
    }

    res.json(
      clients.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        telegramUserId: c.telegramUserId,
        status: c.status,
        createdAt: c.createdAt,
      }))
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || !["sudo", "superadmin", "admin"].includes(payload.role)) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }
    const { firstName, lastName, phone, telegramUserId } = req.body as {
      firstName: string; lastName: string; phone: string; telegramUserId?: string;
    };
    const [client] = await db.insert(clientsTable).values({
      firstName, lastName, phone,
      telegramUserId: telegramUserId ?? null,
      status: "approved",
    }).returning();
    res.status(201).json(client);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || !["sudo", "superadmin", "admin"].includes(payload.role)) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }
    const id = parseInt(req.params.id);
    const { firstName, lastName, phone, telegramUserId } = req.body as {
      firstName: string; lastName: string; phone: string; telegramUserId?: string;
    };
    const [client] = await db.update(clientsTable).set({ firstName, lastName, phone, telegramUserId: telegramUserId ?? null }).where(eq(clientsTable.id, id)).returning();
    res.json(client);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || !["sudo", "superadmin"].includes(payload.role)) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }
    const id = parseInt(req.params.id);
    await db.delete(clientsTable).where(eq(clientsTable.id, id));
    res.json({ success: true, message: "O'chirildi" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

router.post("/:id/approve", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || !["sudo", "superadmin", "admin"].includes(payload.role)) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }
    const id = parseInt(req.params.id);
    const [client] = await db.update(clientsTable).set({ status: "approved" }).where(eq(clientsTable.id, id)).returning();

    // Notify via telegram — client qaysi bot bilan ro'yxatdan o'tgan bo'lsa, o'sha bot orqali
    if (client.telegramUserId) {
      try {
        await sendTelegramNotification(
          client.telegramUserId,
          `🎉 <b>Tabriklaymiz, ${client.firstName} ${client.lastName}!</b>\n\n` +
          `✅ Siz <b>tasdiqlandingiz</b> va endi bizning rasmiy mijozimiz bo'ldingiz!\n\n` +
          `💎 Buyurtma bersangiz, buyurtmangiz holati haqida sizga xabar berib boramiz.\n` +
          `🛍 Xizmatimizdan foydalanganingiz uchun rahmat!`,
          client.botStoreId ?? undefined
        );
      } catch (_e) { /* Telegram not configured */ }
    }

    res.json(client);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

router.post("/:id/reject", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || !["sudo", "superadmin", "admin"].includes(payload.role)) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }
    const id = parseInt(req.params.id);
    const [client] = await db.update(clientsTable).set({ status: "rejected" }).where(eq(clientsTable.id, id)).returning();

    if (client.telegramUserId) {
      try {
        await sendTelegramNotification(
          client.telegramUserId,
          `❌ <b>Hurmatli ${client.firstName} ${client.lastName},</b>\n\n` +
          `Afsuski, ma'lumotlaringiz <b>tasdiqlanmadi</b>.\n\n` +
          `🔄 Qayta ro'yxatdan o'tish uchun botga <b>/start</b> bosing va ma'lumotlaringizni qaytadan kiriting.`,
          client.botStoreId ?? undefined
        );
      } catch (_e) { /* Telegram not configured */ }
    }

    res.json(client);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

export default router;
