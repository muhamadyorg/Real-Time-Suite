import { Router } from "express";
import { db, clientsTable, clientAccountsTable, clientTransactionsTable, serviceTypesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticateToken } from "../lib/auth";
import { notifyStoreAdmin, sendTelegramNotification } from "./telegram";

const router = Router();

// Yordamchi: client account olish yoki yaratish
async function getOrCreateAccount(clientId: number, storeId: number): Promise<typeof clientAccountsTable.$inferSelect> {
  const existing = await db.query.clientAccountsTable.findFirst({
    where: and(eq(clientAccountsTable.clientId, clientId), eq(clientAccountsTable.storeId, storeId)),
  });
  if (existing) return existing;
  const [created] = await db.insert(clientAccountsTable).values({
    clientId,
    storeId,
    balance: "0",
  }).returning();
  return created;
}

// Yordamchi: service type nasiya enabled tekshirish
async function isNasiyaEnabled(serviceTypeId: number): Promise<boolean> {
  const st = await db.query.serviceTypesTable.findFirst({ where: eq(serviceTypesTable.id, serviceTypeId) });
  return st?.nasiyaEnabled ?? false;
}

// GET /api/client-accounts/all/transactions — MUST BE before /:clientId routes
// sudo/superadmin/admin uchun umumiy tranzaksiya tarixi
router.get("/all/transactions", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || !["sudo", "superadmin", "admin"].includes(payload.role)) {
      res.status(403).json({ error: "Ruxsat yo'q" }); return;
    }

    const storeId = payload.role === "sudo" ? undefined : payload.storeId;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

    const where = storeId ? eq(clientTransactionsTable.storeId, storeId) : undefined;

    const transactions = await db.query.clientTransactionsTable.findMany({
      where,
      orderBy: (t, { desc }) => desc(t.createdAt),
      limit,
    });

    const withClients = await Promise.all(transactions.map(async (tx) => {
      const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, tx.clientId) });
      return { ...tx, client };
    }));

    res.json(withClients);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// GET /api/client-accounts — barcha mijozlar + balanslari
// sudo, superadmin: barchasini ko'radi; admin/worker: o'z do'konini
router.get("/", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }

    const search = (req.query.search as string) ?? "";
    const storeId = payload.role === "sudo" ? undefined : payload.storeId;

    // Barcha mijozlarni olamiz (approved + pending)
    const clients = await db.query.clientsTable.findMany({
      orderBy: (t, { asc }) => asc(t.firstName),
    });

    // Filtrlash
    const filtered = clients.filter(c => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        c.firstName?.toLowerCase().includes(s) ||
        c.lastName?.toLowerCase().includes(s) ||
        c.phone?.toLowerCase().includes(s) ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(s)
      );
    });

    // Har bir mijoz uchun account balance + transaction count
    const results = await Promise.all(filtered.map(async (client) => {
      const whereConditions = storeId
        ? and(eq(clientAccountsTable.clientId, client.id), eq(clientAccountsTable.storeId, storeId))
        : eq(clientAccountsTable.clientId, client.id);
      const accounts = await db.query.clientAccountsTable.findMany({ where: whereConditions });
      const totalBalance = accounts.reduce((sum, a) => sum + parseFloat(a.balance ?? "0"), 0);

      let transactionCount = 0;
      if (storeId) {
        const { pool } = await import("@workspace/db");
        const txRes = await pool.query(
          `SELECT COUNT(*)::int AS cnt FROM client_transactions WHERE client_id = $1 AND store_id = $2`,
          [client.id, storeId]
        );
        transactionCount = txRes.rows[0]?.cnt ?? 0;
      } else {
        const { pool } = await import("@workspace/db");
        const txRes = await pool.query(
          `SELECT COUNT(*)::int AS cnt FROM client_transactions WHERE client_id = $1`,
          [client.id]
        );
        transactionCount = txRes.rows[0]?.cnt ?? 0;
      }

      return {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        telegramUserId: client.telegramUserId,
        status: client.status,
        balance: totalBalance,
        transactionCount,
        accounts,
      };
    }));

    res.json(results);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// GET /api/client-accounts/:clientId — bitta mijoz detail + transactions
router.get("/:clientId", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }

    const clientId = parseInt(req.params.clientId);
    const storeId = payload.role === "sudo" ? undefined : payload.storeId;

    const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, clientId) });
    if (!client) { res.status(404).json({ error: "Mijoz topilmadi" }); return; }

    const whereAcc = storeId
      ? and(eq(clientAccountsTable.clientId, clientId), eq(clientAccountsTable.storeId, storeId))
      : eq(clientAccountsTable.clientId, clientId);
    const accounts = await db.query.clientAccountsTable.findMany({ where: whereAcc });
    const balance = accounts.reduce((sum, a) => sum + parseFloat(a.balance ?? "0"), 0);

    const whereTx = storeId
      ? and(eq(clientTransactionsTable.clientId, clientId), eq(clientTransactionsTable.storeId, storeId))
      : eq(clientTransactionsTable.clientId, clientId);
    const transactions = await db.query.clientTransactionsTable.findMany({
      where: whereTx,
      orderBy: (t, { desc }) => desc(t.createdAt),
      limit: 50,
    });

    res.json({ client, balance, accounts, transactions });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// POST /api/client-accounts/:clientId/transaction — tranzaksiya qo'shish
// type: "qarz" (mijoz qarzdor boldi), "tolov" (mijoz to'ladi), "tuzatish" (admin korrektsiya)
router.post("/:clientId/transaction", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }

    const clientId = parseInt(req.params.clientId);
    const {
      type,       // "qarz" | "tolov" | "tuzatish" | "naqd"
      amount,     // musbat son
      sign,       // "plus" | "minus" — tuzatish va tolov uchun
      serviceTypeId,
      orderId,
      orderCode,
      note,
    } = req.body as {
      type: "qarz" | "tolov" | "tuzatish" | "naqd";
      amount: number;
      sign?: "plus" | "minus";
      serviceTypeId?: number;
      orderId?: number;
      orderCode?: string;
      note?: string;
    };

    if (!type) { res.status(400).json({ error: "Tranzaksiya turi ko'rsatilmagan" }); return; }
    // Naqd uchun amount 0 bo'lishi mumkin (summa kiritilmasa)
    if (type !== "naqd" && (!amount || amount <= 0)) { res.status(400).json({ error: "Summa noto'g'ri" }); return; }
    const safeAmount = amount ?? 0;

    // Ruxsatlar
    const isSuperUser = ["sudo", "superadmin", "admin"].includes(payload.role);
    const isWorker = payload.role === "worker";

    // Worker faqat nasiya yoqilgan xizmat turida ishlaydi
    if (isWorker && serviceTypeId) {
      const enabled = await isNasiyaEnabled(serviceTypeId);
      if (!enabled) { res.status(403).json({ error: "Bu xizmat uchun nasiya ruxsat etilmagan" }); return; }
    } else if (isWorker && !serviceTypeId) {
      res.status(403).json({ error: "Xizmat turi ko'rsatilmagan" }); return;
    }

    const storeId = payload.role === "sudo" ? (req.body.storeId as number) : payload.storeId!;
    if (!storeId) { res.status(400).json({ error: "Do'kon aniqlanmadi" }); return; }

    const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, clientId) });
    if (!client) { res.status(404).json({ error: "Mijoz topilmadi" }); return; }

    // Servicetyp nomi
    let serviceTypeName: string | undefined;
    if (serviceTypeId) {
      const st = await db.query.serviceTypesTable.findFirst({ where: eq(serviceTypesTable.id, serviceTypeId) });
      serviceTypeName = st?.name;
    }

    // Account olish yoki yaratish
    const account = await getOrCreateAccount(clientId, storeId);
    const balanceBefore = parseFloat(account.balance ?? "0");

    // Delta hisoblash:
    // "qarz" → mijoz qarz oldi → balance kamayadi (minus)
    // "tolov" → mijoz to'ladi → balance ortadi (plus) yoki kamayadi (minus) — sign bilan
    // "tuzatish" → admin belgilagan sign bilan o'zgartiradi
    // "naqd" → balancega ta'sir qilmaydi, faqat qayd etish uchun
    let delta = 0;
    if (type === "qarz") {
      delta = -Math.abs(safeAmount); // qarz: balance kamayadi
    } else if (type === "tolov") {
      delta = sign === "minus" ? -Math.abs(safeAmount) : Math.abs(safeAmount); // to'lov: odatda balance ortadi
    } else if (type === "tuzatish") {
      if (!isSuperUser) { res.status(403).json({ error: "Tuzatish faqat admin uchun" }); return; }
      delta = sign === "minus" ? -Math.abs(safeAmount) : Math.abs(safeAmount);
    } else if (type === "naqd") {
      delta = 0; // Naqd — balancega ta'sir qilmaydi
    }

    const balanceAfter = balanceBefore + delta;

    // Balance yangilash
    await db.update(clientAccountsTable)
      .set({ balance: balanceAfter.toFixed(2), updatedAt: new Date() })
      .where(and(eq(clientAccountsTable.clientId, clientId), eq(clientAccountsTable.storeId, storeId)));

    // Tranzaksiya yozish
    const [tx] = await db.insert(clientTransactionsTable).values({
      clientId,
      storeId,
      serviceTypeId: serviceTypeId ?? null,
      serviceTypeName: serviceTypeName ?? null,
      orderId: orderId ?? null,
      orderCode: orderCode ?? null,
      type,
      amount: safeAmount.toFixed(2),
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
      note: note ?? null,
      performedById: payload.accountId ?? null,
      performedByName: payload.name ?? "Noma'lum",
    }).returning();

    res.status(201).json({ transaction: tx, balance: balanceAfter });

    // Telegram bildirishnomalar (fon rejimida, javobni kutmasdan)
    const typeLabel = type === "qarz" ? "📦 Nasiya" : type === "tolov" ? "💰 To'lov" : type === "tuzatish" ? "✏️ Tuzatish" : "💵 Naqd";
    const balanceStr = balanceAfter >= 0 ? `+${balanceAfter.toFixed(0)}` : balanceAfter.toFixed(0);
    const storeTag = serviceTypeName ? ` (${serviceTypeName})` : "";
    const noteStr = note ? `\n📝 ${note}` : "";
    const orderStr = orderCode ? `\n🔖 Buyurtma: #${orderCode}` : "";

    // Mijoz to'liq ismi
    const clientFullName = [(client as any).firstName, (client as any).lastName].filter(Boolean).join(" ") || "Noma'lum";

    // Mijozga to'g'ridan-to'g'ri xabar (agar Telegram bog'langan bo'lsa)
    if ((client as any).telegramUserId) {
      const clientMsg = `${typeLabel}${storeTag}\n👤 Mijoz: ${clientFullName}\n📞 Telefon: ${(client as any).phone || "—"}\nSumma: ${safeAmount.toFixed(0)} so'm\nBalans: ${balanceStr} so'm${orderStr}${noteStr}\nBajaruvchi: ${payload.name}`;
      sendTelegramNotification((client as any).telegramUserId, clientMsg, storeId).catch(() => {});
    }

    // Do'kon adminga bildirishnoma
    const adminMsg = `${typeLabel}${storeTag}\n👤 ${clientFullName}\n📞 ${(client as any).phone || "—"}\nSumma: ${safeAmount.toFixed(0)} so'm\nBalans: ${balanceStr} so'm${orderStr}${noteStr}\nBajaruvchi: ${payload.name}`;
    notifyStoreAdmin(storeId, adminMsg).catch(() => {});
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// GET /api/client-accounts/:clientId/transactions — to'liq tarix
router.get("/:clientId/transactions", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }

    const clientId = parseInt(req.params.clientId);
    const storeId = payload.role === "sudo" ? undefined : payload.storeId;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

    const where = storeId
      ? and(eq(clientTransactionsTable.clientId, clientId), eq(clientTransactionsTable.storeId, storeId))
      : eq(clientTransactionsTable.clientId, clientId);

    const transactions = await db.query.clientTransactionsTable.findMany({
      where,
      orderBy: (t, { desc }) => desc(t.createdAt),
      limit,
    });

    res.json(transactions);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

export default router;
