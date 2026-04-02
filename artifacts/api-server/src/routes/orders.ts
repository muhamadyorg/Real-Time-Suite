import { Router } from "express";
import { db, ordersTable, serviceTypesTable, clientsTable, storesTable, accountsTable } from "@workspace/db";
import { eq, and, asc, sql, isNull, lt } from "drizzle-orm";
import { authenticateToken } from "../lib/auth";
import type { Server as SocketServer } from "socket.io";

let io: SocketServer | undefined;
export function setSocketIO(socketIO: SocketServer) {
  io = socketIO;
}

async function generateOrderId(): Promise<string> {
  const result = await db.select({ maxId: sql<string>`max(cast(order_id as integer))` }).from(ordersTable);
  const maxId = result[0]?.maxId ? parseInt(result[0].maxId) : 0;
  return String(maxId + 1).padStart(5, "0");
}

function generateLockPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function formatQty(qty: string | number): string {
  const n = parseFloat(String(qty));
  return n % 1 === 0 ? String(Math.round(n)) : n.toString();
}

function mapOrder(o: typeof ordersTable.$inferSelect, showLockPin = true) {
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
    createdById: o.createdById,
    createdByName: o.createdByName,
    acceptedById: o.acceptedById,
    acceptedByName: o.acceptedByName,
    acceptedAt: o.acceptedAt,
    readyAt: o.readyAt,
    lockPin: showLockPin ? o.lockPin : undefined,
    isLocked: !!o.lockPin,
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
    res.json(mapOrder(order, false));
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

    let workerServiceTypeId: number | null = null;
    if (payload.role === "worker" && payload.accountId) {
      const account = await db.query.accountsTable.findFirst({
        where: eq(accountsTable.id, payload.accountId),
      });
      workerServiceTypeId = account?.serviceTypeId ?? null;
    }

    if (payload.role === "worker" && !workerServiceTypeId) {
      res.json({ new: 0, accepted: 0, ready: 0, today: 0 });
      return;
    }

    const conditions: ReturnType<typeof eq>[] = [];
    if (payload.role !== "sudo" && payload.storeId) {
      conditions.push(eq(ordersTable.storeId, payload.storeId));
    }
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

    let workerServiceTypeId: number | null = null;
    if (payload.role === "worker" && payload.accountId) {
      const account = await db.query.accountsTable.findFirst({
        where: eq(accountsTable.id, payload.accountId),
      });
      workerServiceTypeId = account?.serviceTypeId ?? null;
    }

    if (payload.role === "worker" && !workerServiceTypeId) {
      res.json([]);
      return;
    }

    const conditions: ReturnType<typeof eq>[] = [];

    if (payload.role !== "sudo") {
      if (payload.storeId) {
        conditions.push(eq(ordersTable.storeId, payload.storeId));
      }
    } else if (storeId) {
      conditions.push(eq(ordersTable.storeId, parseInt(storeId)));
    }

    if (payload.role === "worker" && workerServiceTypeId) {
      conditions.push(eq(ordersTable.serviceTypeId, workerServiceTypeId));
    }

    if (status && ["new", "accepted", "ready"].includes(status)) {
      conditions.push(eq(ordersTable.status, status as "new" | "accepted" | "ready"));
    }

    let orders = await db.query.ordersTable.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [asc(ordersTable.createdAt)],
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

    const showLockPin = payload.role !== "worker";
    res.json(orders.map((o) => mapOrder(o, showLockPin)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// POST /orders — admin, superadmin, sudo, AND worker (own serviceType only)
router.post("/", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || !["sudo", "superadmin", "admin", "worker"].includes(payload.role)) {
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

    // Workers can only create orders for their own serviceType
    if (payload.role === "worker") {
      const account = await db.query.accountsTable.findFirst({
        where: eq(accountsTable.id, payload.accountId!),
      });
      if (!account?.serviceTypeId || account.serviceTypeId !== serviceTypeId) {
        res.status(403).json({ error: "Siz faqat o'z bo'limingizga zakaz qo'sha olasiz" });
        return;
      }
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

    // Check if there are existing "new" orders in this store → if yes, lock this new order
    const existingNewOrders = await db.query.ordersTable.findMany({
      where: and(eq(ordersTable.storeId, storeId), eq(ordersTable.status, "new")),
    });
    const lockPin = existingNewOrders.length > 0 ? generateLockPin() : null;

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
        createdByName: payload.name ?? "Xodim",
        lockPin,
      })
      .returning();

    const showLockPin = payload.role !== "worker";
    const response = mapOrder(order, showLockPin);
    io?.to(`store:${storeId}`).emit("order:created", mapOrder(order, true));
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
    const showLockPin = payload.role !== "worker";
    res.json(mapOrder(order, showLockPin));
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
    const { status, lockPin: providedLockPin } = req.body as { status: "new" | "accepted" | "ready"; lockPin?: string };

    const order = await db.query.ordersTable.findFirst({ where: eq(ordersTable.id, id) });
    if (!order) {
      res.status(404).json({ error: "Zakaz topilmadi" });
      return;
    }

    // Check lock PIN when accepting a locked order
    if (status === "accepted" && order.lockPin) {
      const isCreator = payload.accountId && order.createdById === payload.accountId;
      if (!isCreator) {
        if (!providedLockPin || providedLockPin !== order.lockPin) {
          res.status(403).json({ error: "Qulf PIN kodi noto'g'ri" });
          return;
        }
      }
    }

    const updates: Record<string, unknown> = { status };

    if (status === "accepted") {
      updates.acceptedById = payload.accountId ?? null;
      updates.acceptedByName = payload.name ?? null;
      updates.acceptedAt = new Date();
    } else if (status === "ready") {
      updates.readyAt = new Date();
    }

    const [updatedOrder] = await db
      .update(ordersTable)
      .set(updates)
      .where(eq(ordersTable.id, id))
      .returning();

    // When order is accepted, unlock the next oldest "new" order in the same store
    if (status === "accepted") {
      const nextOrder = await db.query.ordersTable.findFirst({
        where: and(
          eq(ordersTable.storeId, updatedOrder.storeId),
          eq(ordersTable.status, "new")
        ),
        orderBy: [asc(ordersTable.createdAt)],
      });
      if (nextOrder && nextOrder.lockPin) {
        await db.update(ordersTable).set({ lockPin: null }).where(eq(ordersTable.id, nextOrder.id));
        io?.to(`store:${updatedOrder.storeId}`).emit("order:updated", mapOrder({ ...nextOrder, lockPin: null }, true));
      }
    }

    const response = mapOrder(updatedOrder, true);
    io?.to(`store:${updatedOrder.storeId}`).emit("order:updated", response);

    // Telegram notification for client
    if (updatedOrder.clientId && updatedOrder.status === "accepted") {
      try {
        const { sendTelegramNotification } = await import("./telegram");
        const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, updatedOrder.clientId) });
        if (client?.telegramUserId) {
          const qty = formatQty(updatedOrder.quantity);
          await sendTelegramNotification(
            client.telegramUserId,
            `⚡️ <b>Buyurtma qabul qilindi!</b>\n\n` +
            `👋 Hurmatli <b>${client.firstName} ${client.lastName}</b>,\n\n` +
            `📦 Buyurtma raqami: <b>${updatedOrder.orderId}</b>\n` +
            `🛠 Xizmat: <b>${updatedOrder.serviceTypeName}</b>\n` +
            `🔢 Miqdor: <b>${qty}${updatedOrder.unit ? " " + updatedOrder.unit : ""}</b>\n` +
            (updatedOrder.shelf ? `📍 Qolib: <b>${updatedOrder.shelf}</b>\n` : ``) +
            (updatedOrder.notes ? `📝 Izoh: <b>${updatedOrder.notes}</b>\n` : ``) +
            `\n⏳ Buyurtmangiz tayyorlanmoqda...\n` +
            `Tayyor bo'lishi bilanoq xabar beramiz! 🔔`,
            updatedOrder.storeId ?? undefined
          );
        }
      } catch (_e) { /* Telegram not configured */ }
    }

    if (updatedOrder.clientId && updatedOrder.status === "ready") {
      try {
        const { sendTelegramNotification } = await import("./telegram");
        const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, updatedOrder.clientId) });
        if (client?.telegramUserId) {
          const qty = formatQty(updatedOrder.quantity);
          await sendTelegramNotification(
            client.telegramUserId,
            `✅ <b>Buyurtmangiz TAYYOR!</b>\n\n` +
            `🎉 Hurmatli <b>${client.firstName} ${client.lastName}</b>,\n\n` +
            `📦 Buyurtma raqami: <b>${updatedOrder.orderId}</b>\n` +
            `🛠 Xizmat: <b>${updatedOrder.serviceTypeName}</b>\n` +
            `🔢 Miqdor: <b>${qty}${updatedOrder.unit ? " " + updatedOrder.unit : ""}</b>\n` +
            (updatedOrder.shelf ? `📍 Qolib: <b>${updatedOrder.shelf}</b>\n` : ``) +
            (updatedOrder.notes ? `📝 Izoh: <b>${updatedOrder.notes}</b>\n` : ``) +
            `\n🏪 Buyurtmangizni olib ketishingiz mumkin!\n` +
            `💎 Bizga ishonganingiz uchun katta rahmat!`,
            updatedOrder.storeId ?? undefined
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

// DELETE /orders/:id
router.delete("/:id", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || !["sudo", "superadmin", "admin"].includes(payload.role)) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }
    const id = parseInt(req.params.id);
    const order = await db.query.ordersTable.findFirst({ where: eq(ordersTable.id, id) });
    if (!order) {
      res.status(404).json({ error: "Zakaz topilmadi" });
      return;
    }
    await db.delete(ordersTable).where(eq(ordersTable.id, id));

    // If deleted order had no lockPin (was the unlocked oldest), unlock the next one
    if (!order.lockPin && order.status === "new") {
      const nextOrder = await db.query.ordersTable.findFirst({
        where: and(eq(ordersTable.storeId, order.storeId), eq(ordersTable.status, "new")),
        orderBy: [asc(ordersTable.createdAt)],
      });
      if (nextOrder && nextOrder.lockPin) {
        await db.update(ordersTable).set({ lockPin: null }).where(eq(ordersTable.id, nextOrder.id));
        io?.to(`store:${order.storeId}`).emit("order:updated", mapOrder({ ...nextOrder, lockPin: null }, true));
      }
    }

    io?.to(`store:${order.storeId}`).emit("order:deleted", { id });
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// PUT /orders/:id (edit)
router.put("/:id", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || !["sudo", "superadmin", "admin"].includes(payload.role)) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }
    const id = parseInt(req.params.id);
    const { quantity, unit, shelf, notes, clientId, clientName, clientPhone, status } = req.body as {
      quantity?: number;
      unit?: string;
      shelf?: string;
      notes?: string;
      clientId?: number;
      clientName?: string;
      clientPhone?: string;
      status?: string;
    };

    const updates: Record<string, unknown> = {};
    if (quantity !== undefined) updates.quantity = String(quantity);
    if (unit !== undefined) updates.unit = unit;
    if (shelf !== undefined) updates.shelf = shelf;
    if (notes !== undefined) updates.notes = notes;
    if (clientId !== undefined) updates.clientId = clientId;
    if (clientName !== undefined) updates.clientName = clientName;
    if (clientPhone !== undefined) updates.clientPhone = clientPhone;
    if (status !== undefined) updates.status = status;

    if (clientId) {
      const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, clientId) });
      if (client) {
        updates.clientName = client.firstName + " " + client.lastName;
        updates.clientPhone = client.phone;
      }
    }

    const [order] = await db.update(ordersTable).set(updates).where(eq(ordersTable.id, id)).returning();
    const response = mapOrder(order, true);
    io?.to(`store:${order.storeId}`).emit("order:updated", response);
    res.json(response);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

export default router;
