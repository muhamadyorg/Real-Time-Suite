import { Router } from "express";
import { db, clientsTable, clientAccountsTable, clientTransactionsTable, serviceTypesTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
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
    if (!payload || !["sudo", "superadmin", "admin", "store"].includes(payload.role)) {
      res.status(403).json({ error: "Ruxsat yo'q" }); return;
    }

    const storeId = payload.role === "sudo" ? undefined : payload.storeId;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 10000);

    const where = storeId ? eq(clientTransactionsTable.storeId, storeId) : undefined;

    const transactions = await db.query.clientTransactionsTable.findMany({
      where,
      orderBy: (t, { desc }) => desc(t.createdAt),
      limit,
    });

    const clientIds = [...new Set(transactions.map(tx => tx.clientId).filter(Boolean))];
    const clients = clientIds.length
      ? await db.query.clientsTable.findMany({ where: inArray(clientsTable.id, clientIds as number[]) })
      : [];
    const clientMap = new Map(clients.map(c => [c.id, c]));
    const withClients = transactions.map(tx => ({ ...tx, client: clientMap.get(tx.clientId!) ?? null }));

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

    // Barcha accountlarni bitta so'rovda olamiz (N+1 dan qochish)
    const filteredIds = filtered.map(c => c.id);
    const allAccounts = filteredIds.length
      ? await db.query.clientAccountsTable.findMany({
          where: storeId
            ? and(inArray(clientAccountsTable.clientId, filteredIds), eq(clientAccountsTable.storeId, storeId))
            : inArray(clientAccountsTable.clientId, filteredIds),
        })
      : [];
    const accountsByClient = new Map<number, typeof allAccounts>();
    for (const acc of allAccounts) {
      if (!accountsByClient.has(acc.clientId)) accountsByClient.set(acc.clientId, []);
      accountsByClient.get(acc.clientId)!.push(acc);
    }
    const results = filtered.map(client => {
      const accounts = accountsByClient.get(client.id) ?? [];
      const totalBalance = accounts.reduce((sum, a) => sum + parseFloat(a.balance ?? "0"), 0);
      return {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        telegramUserId: client.telegramUserId,
        status: client.status,
        balance: totalBalance,
        accounts,
      };
    });

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
      type,       // "qarz" | "tolov" | "tuzatish" | "naqd" | "click" | "dokonga"
      amount,     // musbat son
      sign,       // "plus" | "minus" — tuzatish va tolov uchun
      serviceTypeId,
      orderId,
      orderCode,
      note,
    } = req.body as {
      type: "qarz" | "tolov" | "tuzatish" | "naqd" | "click" | "dokonga";
      amount: number;
      sign?: "plus" | "minus";
      serviceTypeId?: number;
      orderId?: number;
      orderCode?: string;
      note?: string;
    };

    if (!type) { res.status(400).json({ error: "Tranzaksiya turi ko'rsatilmagan" }); return; }
    // Naqd/click/dokonga uchun amount 0 bo'lishi mumkin
    const noAmountTypes = ["naqd", "click", "dokonga"];
    if (!noAmountTypes.includes(type) && (!amount || amount <= 0)) { res.status(400).json({ error: "Summa noto'g'ri" }); return; }
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
    } else if (type === "naqd" || type === "click" || type === "dokonga") {
      delta = 0; // Naqd/click/dokonga — balancega ta'sir qilmaydi, faqat qayd uchun
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
    const typeLabel = type === "qarz" ? "📦 Nasiya" : type === "tolov" ? "💰 To'lov" : type === "tuzatish" ? "✏️ Tuzatish" : type === "click" ? "📲 Click" : type === "dokonga" ? "🏪 Dokonga" : "💵 Naqd";
    const balanceSign = balanceAfter < 0 ? "−" : balanceAfter > 0 ? "+" : "";
    const balanceStr = `${balanceSign}${Math.abs(balanceAfter).toLocaleString("uz-UZ", { maximumFractionDigits: 0 })} so'm`;
    const balanceLabel = balanceAfter < 0 ? "🔴 Qarz" : balanceAfter > 0 ? "🟢 Haq" : "⚪ Nol";
    const storeTag = serviceTypeName ? ` — ${serviceTypeName}` : "";
    const noteStr = note ? `\n📝 Izoh: ${note}` : "";
    const orderStr = orderCode ? `\n🔖 Buyurtma: #${orderCode}` : "";
    const amountFmt = `${Math.abs(safeAmount).toLocaleString("uz-UZ", { maximumFractionDigits: 0 })} so'm`;

    // Mijoz to'liq ismi
    const clientFullName = [(client as any).firstName, (client as any).lastName].filter(Boolean).join(" ") || "Noma'lum";

    // Mijozga to'g'ridan-to'g'ri xabar (agar Telegram bog'langan bo'lsa)
    // botStoreId — mijoz qaysi do'kon boti orqali ro'yxatdan o'tgan
    if ((client as any).telegramUserId) {
      const clientMsg = [
        `${typeLabel}${storeTag}`,
        `👤 Mijoz: <b>${clientFullName}</b>`,
        `📞 Telefon: ${(client as any).phone || "—"}`,
        `💵 Summa: <b>${amountFmt}</b>`,
        `${balanceLabel} Balans: <b>${balanceStr}</b>`,
        orderStr,
        noteStr,
        `👨‍💼 Bajaruvchi: ${payload.name}`,
      ].filter(Boolean).join("\n");
      const clientBotStoreId = (client as any).botStoreId ?? storeId;
      sendTelegramNotification((client as any).telegramUserId, clientMsg, clientBotStoreId).catch(() => {});
    }

    // Do'kon adminga bildirishnoma
    const adminMsg = [
      `${typeLabel}${storeTag}`,
      `👤 Mijoz: <b>${clientFullName}</b>`,
      `📞 ${(client as any).phone || "—"}`,
      `💵 Summa: <b>${amountFmt}</b>`,
      `${balanceLabel} Balans: <b>${balanceStr}</b>`,
      orderStr,
      noteStr,
      `👨‍💼 Bajaruvchi: ${payload.name}`,
    ].filter(Boolean).join("\n");
    notifyStoreAdmin(storeId, adminMsg).catch(() => {});
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// DELETE /api/client-accounts/transactions/:txId — tranzaksiyani o'chirish (faqat sudo/superadmin)
router.delete("/transactions/:txId", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || !["sudo", "superadmin"].includes(payload.role)) {
      res.status(403).json({ error: "Ruxsat yo'q" }); return;
    }

    const txId = parseInt(req.params.txId);
    if (!txId) { res.status(400).json({ error: "Tranzaksiya ID noto'g'ri" }); return; }

    const tx = await db.query.clientTransactionsTable.findFirst({
      where: eq(clientTransactionsTable.id, txId),
    });
    if (!tx) { res.status(404).json({ error: "Tranzaksiya topilmadi" }); return; }

    const delta = parseFloat(tx.balanceAfter ?? "0") - parseFloat(tx.balanceBefore ?? "0");

    if (delta !== 0 && tx.clientId && tx.storeId) {
      const account = await db.query.clientAccountsTable.findFirst({
        where: and(
          eq(clientAccountsTable.clientId, tx.clientId),
          eq(clientAccountsTable.storeId, tx.storeId)
        ),
      });
      if (account) {
        const newBalance = parseFloat(account.balance ?? "0") - delta;
        await db.update(clientAccountsTable)
          .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
          .where(and(
            eq(clientAccountsTable.clientId, tx.clientId),
            eq(clientAccountsTable.storeId, tx.storeId)
          ));
      }
    }

    await db.delete(clientTransactionsTable).where(eq(clientTransactionsTable.id, txId));

    res.json({ ok: true });
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
