import { Router } from "express";
import { db, ordersTable, serviceTypesTable, clientsTable, storesTable, accountsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { authenticateToken } from "../lib/auth";
import type { Server as SocketServer } from "socket.io";

let io: SocketServer | undefined;
export function setSocketIO(socketIO: SocketServer) {
  io = socketIO;
}

async function generateOrderId(): Promise<string> {
  const result = await db.select({ count: sql<number>`count(*)` }).from(ordersTable);
  const count = Number(result[0]?.count ?? 0);
  return String(count + 1).padStart(5, "0");
}

function formatQty(qty: string | number): string {
  const n = parseFloat(String(qty));
  return n % 1 === 0 ? String(Math.round(n)) : n.toString();
}

function mapOrder(o: typeof ordersTable.$inferSelect) {
  return {
    id: o.id,
    orderId: "#" + o.orderId,
    status: o.status,
    serviceTypeId: o.serviceTypeId,
    serviceTypeName: o.serviceTypeName,
    quantity: parseFloat(o.quantity),
    unit: o.unit,
    shelf: o.shelf,
    notes: o.notes,
    storeId: o.storeId,
    storeName: o.storeName,
    clientId: o.clientId,
    clientName: o.clientName,
    clientPhone: o.clientPhone,
    createdByName: o.createdByName,
    acceptedByName: o.acceptedByName,
    acceptedAt: o.acceptedAt,
    readyAt: o.readyAt,
    createdAt: o.createdAt,
  };
}

const router = Router();

// Public endpoint: GET /orders/public/:orderId (no auth needed)
router.get("/public/:orderId", async (req, res) => {
  try {
    const rawId = req.params.orderId.replace(/^#/, "");
    const order = await db.query.ordersTable.findFirst({
      where: eq(ordersTable.orderId, rawId),
    });
    if (!order) {
      res.status(404).json({ error: "Zakaz topilmadi" });
      return;
    }
    res.json(mapOrder(order));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// GET /orders/summary
router.get("/summary", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload) {
      res.status(401).json({ error: "Ruxsat yo'q" });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // For workers: always fetch fresh serviceTypeId from DB (not JWT, may be stale)
    let workerServiceTypeId: number | null = null;
    if (payload.role === "worker" && payload.accountId) {
      const account = await db.query.accountsTable.findFirst({
        where: eq(accountsTable.id, payload.accountId),
      });
      workerServiceTypeId = account?.serviceTypeId ?? null;
    }

    const conditions: ReturnType<typeof eq>[] = [];
    if (payload.role !== "sudo" && payload.storeId) {
      conditions.push(eq(ordersTable.storeId, payload.storeId));
    }
    // Workers only see their service type (read from DB, not stale JWT)
    if (payload.role === "worker" && workerServiceTypeId) {
      conditions.push(eq(ordersTable.serviceTypeId, workerServiceTypeId));
    }

    const all = await db.query.ordersTable.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
    });

    const newCount = all.filter((o) => o.status === "new").length;
    const acceptedCount = all.filter((o) => o.status === "accepted").length;
    const readyCount = all.filter((o) => o.status === "ready").length;
    const todayCount = all.filter((o) => o.createdAt >= today).length;

    res.json({ new: newCount, accepted: acceptedCount, ready: readyCount, totalToday: todayCount });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// GET /orders
router.get("/", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload) {
      res.status(401).json({ error: "Ruxsat yo'q" });
      return;
    }

    const { status, storeId, date, search } = req.query as {
      status?: string;
      storeId?: string;
      date?: string;
      search?: string;
    };

    // For workers: always fetch fresh serviceTypeId from DB (not JWT, may be stale)
    let workerServiceTypeId: number | null = null;
    if (payload.role === "worker" && payload.accountId) {
      const account = await db.query.accountsTable.findFirst({
        where: eq(accountsTable.id, payload.accountId),
      });
      workerServiceTypeId = account?.serviceTypeId ?? null;
    }

    const conditions: ReturnType<typeof eq>[] = [];

    if (payload.role !== "sudo") {
      if (payload.storeId) {
        conditions.push(eq(ordersTable.storeId, payload.storeId));
      }
    } else if (storeId) {
      conditions.push(eq(ordersTable.storeId, parseInt(storeId)));
    }

    // Workers only see orders for their assigned service type (from DB, not stale JWT)
    if (payload.role === "worker" && workerServiceTypeId) {
      conditions.push(eq(ordersTable.serviceTypeId, workerServiceTypeId));
    }

    if (status && ["new", "accepted", "ready"].includes(status)) {
      conditions.push(eq(ordersTable.status, status as "new" | "accepted" | "ready"));
    }

    let orders = await db.query.ordersTable.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(ordersTable.createdAt)],
    });

    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      orders = orders.filter((o) => o.createdAt >= d && o.createdAt < next);
    }

    if (search) {
      const q = search.toLowerCase();
      orders = orders.filter((o) =>
        [o.orderId, o.serviceTypeName, o.clientName, o.clientPhone, o.shelf, o.notes, o.createdByName, o.acceptedByName, String(parseFloat(o.quantity))]
          .some((v) => v && v.toLowerCase().includes(q))
      );
    }

    res.json(orders.map(mapOrder));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// POST /orders
router.post("/", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || !["sudo", "superadmin", "admin"].includes(payload.role)) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }

    const { serviceTypeId, quantity, unit, shelf, notes, clientId, clientName, clientPhone } = req.body as {
      serviceTypeId: number;
      quantity: number;
      unit?: string;
      shelf?: string;
      notes?: string;
      clientId?: number;
      clientName?: string;
      clientPhone?: string;
    };

    const serviceType = await db.query.serviceTypesTable.findFirst({
      where: eq(serviceTypesTable.id, serviceTypeId),
    });
    if (!serviceType) {
      res.status(400).json({ error: "Xizmat turi topilmadi" });
      return;
    }

    let resolvedClientName = clientName ?? null;
    let resolvedClientPhone = clientPhone ?? null;
    let resolvedClientId = clientId ?? null;

    if (clientId) {
      const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, clientId) });
      if (client) {
        resolvedClientName = client.firstName + " " + client.lastName;
        resolvedClientPhone = client.phone;
      }
    }

    const storeId = payload.storeId ?? serviceType.storeId ?? 0;
    const orderId = await generateOrderId();

    const store = await db.query.storesTable.findFirst({ where: (t, { eq: e }) => e(t.id, storeId) });

    const [order] = await db
      .insert(ordersTable)
      .values({
        orderId,
        status: "new",
        serviceTypeId,
        serviceTypeName: serviceType.name,
        quantity: String(quantity),
        unit: unit ?? null,
        shelf: shelf ?? null,
        notes: notes ?? null,
        storeId,
        storeName: store?.name ?? "Do'kon",
        clientId: resolvedClientId,
        clientName: resolvedClientName,
        clientPhone: resolvedClientPhone,
        createdById: payload.accountId ?? null,
        createdByName: payload.name ?? "Admin",
      })
      .returning();

    const response = mapOrder(order);
    io?.to(`store:${storeId}`).emit("order:created", response);
    res.status(201).json(response);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// GET /orders/:id
router.get("/:id", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload) {
      res.status(401).json({ error: "Ruxsat yo'q" });
      return;
    }
    const id = parseInt(req.params.id);
    const order = await db.query.ordersTable.findFirst({ where: eq(ordersTable.id, id) });
    if (!order) {
      res.status(404).json({ error: "Zakaz topilmadi" });
      return;
    }
    res.json(mapOrder(order));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// PATCH /orders/:id/status
router.patch("/:id/status", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || !["sudo", "superadmin", "admin", "worker"].includes(payload.role)) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }

    const id = parseInt(req.params.id);
    const { status } = req.body as { status: "new" | "accepted" | "ready" };

    const updates: Record<string, unknown> = { status };

    if (status === "accepted") {
      updates.acceptedById = payload.accountId ?? null;
      updates.acceptedByName = payload.name ?? null;
      updates.acceptedAt = new Date();
    } else if (status === "ready") {
      updates.readyAt = new Date();
    }

    const [order] = await db
      .update(ordersTable)
      .set(updates)
      .where(eq(ordersTable.id, id))
      .returning();

    const response = mapOrder(order);
    io?.to(`store:${order.storeId}`).emit("order:updated", response);

    // Telegram notification for client
    if (order.clientId && order.status === "accepted") {
      try {
        const { sendTelegramNotification } = await import("./telegram");
        const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, order.clientId) });
        if (client?.telegramUserId) {
          const qty = formatQty(order.quantity);
          await sendTelegramNotification(
            client.telegramUserId,
            `⚡️ <b>Buyurtma qabul qilindi!</b>\n\n` +
            `👋 Hurmatli <b>${client.firstName} ${client.lastName}</b>,\n\n` +
            `📦 Buyurtma raqami: <b>${order.orderId}</b>\n` +
            `🛠 Xizmat: <b>${order.serviceTypeName}</b>\n` +
            `🔢 Miqdor: <b>${qty}${order.unit ? " " + order.unit : ""}</b>\n\n` +
            `⏳ Buyurtmangiz tayyorlanmoqda...\n` +
            `Tayyor bo'lishi bilanoq xabar beramiz! 🔔`
          );
        }
      } catch (_e) { /* Telegram not configured */ }
    }

    if (order.clientId && order.status === "ready") {
      try {
        const { sendTelegramNotification } = await import("./telegram");
        const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, order.clientId) });
        if (client?.telegramUserId) {
          const qty = formatQty(order.quantity);
          await sendTelegramNotification(
            client.telegramUserId,
            `✅ <b>Buyurtmangiz TAYYOR!</b>\n\n` +
            `🎉 Hurmatli <b>${client.firstName} ${client.lastName}</b>,\n\n` +
            `📦 Buyurtma raqami: <b>${order.orderId}</b>\n` +
            `🛠 Xizmat: <b>${order.serviceTypeName}</b>\n` +
            `🔢 Miqdor: <b>${qty}${order.unit ? " " + order.unit : ""}</b>\n\n` +
            `🏪 Buyurtmangizni olib ketishingiz mumkin!\n` +
            `💎 Bizga ishonganingiz uchun katta rahmat!`
          );
        }
      } catch (_e) { /* Telegram not configured */ }
    }

    res.json(response);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

export default router;
