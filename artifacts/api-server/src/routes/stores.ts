import { Router } from "express";
import { db, storesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, authenticateToken } from "../lib/auth";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    const isSudo = payload?.role === "sudo";

    const stores = await db.query.storesTable.findMany({
      orderBy: (t, { asc }) => asc(t.createdAt),
    });

    res.json(stores.map((s) => ({
      id: s.id,
      name: s.name,
      username: s.username,
      telegramBotToken: isSudo ? s.telegramBotToken : undefined,
      createdAt: s.createdAt,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || payload.role !== "sudo") {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }
    const { name, username, password, telegramBotToken } = req.body as {
      name: string;
      username: string;
      password: string;
      telegramBotToken?: string;
    };
    const passwordHash = await hashPassword(password);
    const [store] = await db.insert(storesTable).values({
      name,
      username,
      passwordHash,
      telegramBotToken: telegramBotToken || null,
    }).returning();
    res.status(201).json({
      id: store.id,
      name: store.name,
      username: store.username,
      telegramBotToken: store.telegramBotToken,
      createdAt: store.createdAt,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || payload.role !== "sudo") {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }
    const id = parseInt(req.params.id);
    const { name, username, password, telegramBotToken } = req.body as {
      name: string;
      username: string;
      password?: string;
      telegramBotToken?: string;
    };
    const updates: Record<string, unknown> = { name, username };
    if (password) updates.passwordHash = await hashPassword(password);
    if (telegramBotToken !== undefined) updates.telegramBotToken = telegramBotToken || null;
    const [store] = await db.update(storesTable).set(updates).where(eq(storesTable.id, id)).returning();
    res.json({
      id: store.id,
      name: store.name,
      username: store.username,
      telegramBotToken: store.telegramBotToken,
      createdAt: store.createdAt,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || payload.role !== "sudo") {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }
    const id = parseInt(req.params.id);
    await db.delete(storesTable).where(eq(storesTable.id, id));
    res.json({ success: true, message: "O'chirildi" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

export default router;
