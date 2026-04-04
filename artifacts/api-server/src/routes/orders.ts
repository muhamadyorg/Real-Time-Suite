import { Router } from "express";
import { db, ordersTable, serviceTypesTable, clientsTable, storesTable, accountsTable } from "@workspace/db";
import { eq, and, asc, desc, sql, isNull, lt } from "drizzle-orm";
import { authenticateToken } from "../lib/auth";
import type { Server as SocketServer } from "socket.io";

let io: SocketServer | undefined;
export function setSocketIO(socketIO: SocketServer) {
  io = socketIO;
}

async function generateOrderId(): Promise<string> {
  // Only count base orders (no dash = not a split part)
  const result = await db.select({ maxId: sql<string>`max(cast(order_id as integer)) filter (where order_id ~ '^[0-9]+$')` }).from(ordersTable);
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
    product: o.product,
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
    deliveredAt: o.deliveredAt,
    deliveredByName: o.deliveredByName,
    lockPin: showLockPin ? o.lockPin : undefined,
    isLocked: !!o.lockPin,
    splitGroup: o.splitGroup,
    splitPart: o.splitPart,
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

    if (status && ["new", "accepted", "ready", "topshirildi"].includes(status)) {
      conditions.push(eq(ordersTable.status, status as "new" | "accepted" | "ready" | "topshirildi"));
    }

    const isReady = status === "ready";
    let orders = await db.query.ordersTable.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: isReady ? [desc(ordersTable.readyAt), desc(ordersTable.createdAt)] : [asc(ordersTable.createdAt)],
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

    const { serviceTypeId, quantity, unit, shelf, product, notes, clientId, clientName, clientPhone } = req.body as {
      serviceTypeId: number;
      quantity: number;
      unit?: string;
      shelf?: string;
      product?: string;
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
        product: product ?? null,
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
    const { status, lockPin: providedLockPin } = req.body as { status: "new" | "accepted" | "ready" | "topshirildi"; lockPin?: string };

    const order = await db.query.ordersTable.findFirst({ where: eq(ordersTable.id, id) });
    if (!order) {
      res.status(404).json({ error: "Zakaz topilmadi" });
      return;
    }

    // "topshirildi" uchun ruxsat tekshiruvi
    if (status === "topshirildi") {
      if (!["sudo", "superadmin"].includes(payload.role)) {
        if (payload.role !== "admin") {
          res.status(403).json({ error: "Ruxsat yo'q" }); return;
        }
        const store = await db.query.storesTable.findFirst({ where: eq(storesTable.id, order.storeId) });
        if (!store?.canAdminMarkDelivered) {
          res.status(403).json({ error: "Adminlarga olib ketildi belgilash ruxsati berilmagan" }); return;
        }
      }
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
    } else if (status === "topshirildi") {
      updates.deliveredAt = new Date();
      updates.deliveredByName = payload.name ?? null;
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

    // Auto-merge: if this order is a split part and all parts in the group are now "ready", merge them
    let mergedOrder: typeof updatedOrder | null = null;
    if (status === "ready" && updatedOrder.splitGroup) {
      const allParts = await db.query.ordersTable.findMany({
        where: eq(ordersTable.splitGroup, updatedOrder.splitGroup),
      });
      // Also find the part 1 (the original, which has orderId = splitGroup)
      const part1 = await db.query.ordersTable.findFirst({
        where: eq(ordersTable.orderId, updatedOrder.splitGroup),
      });
      const allOrdersInGroup = part1 ? [part1, ...allParts.filter(p => p.id !== part1.id)] : allParts;
      const allReady = allOrdersInGroup.every(p => p.status === "ready" || p.id === updatedOrder.id);

      if (allReady && allOrdersInGroup.length > 0) {
        const totalQty = allOrdersInGroup.reduce((sum, p) => sum + parseFloat(p.quantity), 0);
        const latestReadyAt = allOrdersInGroup.reduce((latest, p) => {
          const t = p.id === updatedOrder.id ? (updatedOrder.readyAt ?? new Date()) : p.readyAt;
          return t && (!latest || t > latest) ? t : latest;
        }, null as Date | null);

        // Update part 1 (original) with combined quantity, remove split info
        const mainOrder = allOrdersInGroup.find(p => p.orderId === updatedOrder.splitGroup) ?? allOrdersInGroup[0];
        const [merged] = await db.update(ordersTable).set({
          quantity: String(totalQty),
          readyAt: latestReadyAt ?? new Date(),
          splitGroup: null,
          splitPart: null,
        }).where(eq(ordersTable.id, mainOrder.id)).returning();

        // Delete all other parts
        for (const part of allOrdersInGroup) {
          if (part.id !== mainOrder.id) {
            await db.delete(ordersTable).where(eq(ordersTable.id, part.id));
            io?.to(`store:${mainOrder.storeId}`).emit("order:deleted", { id: part.id });
          }
        }

        io?.to(`store:${mainOrder.storeId}`).emit("order:updated", mapOrder(merged, true));
        mergedOrder = merged;
      }
    }

    const response = mergedOrder ? mapOrder(mergedOrder, true) : mapOrder(updatedOrder, true);
    if (!mergedOrder) {
      io?.to(`store:${updatedOrder.storeId}`).emit("order:updated", response);
    }

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

// POST /orders/:id/split — worker bolib qabul qilish
router.post("/:id/split", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || !["sudo", "superadmin", "admin", "worker"].includes(payload.role)) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }

    const id = parseInt(req.params.id);
    const { quantity: takeQty } = req.body as { quantity: number };

    if (!takeQty || takeQty <= 0) {
      res.status(400).json({ error: "Olinadigan miqdor 0 dan katta bo'lishi kerak" });
      return;
    }

    const order = await db.query.ordersTable.findFirst({ where: eq(ordersTable.id, id) });
    if (!order) { res.status(404).json({ error: "Zakaz topilmadi" }); return; }
    if (order.status !== "new") { res.status(400).json({ error: "Faqat yangi zakazlarni bo'lish mumkin" }); return; }

    const totalQty = parseFloat(order.quantity);
    if (takeQty >= totalQty) {
      res.status(400).json({ error: `Olinadigan miqdor (${takeQty}) umumiy miqdordan (${totalQty}) kam bo'lishi kerak` });
      return;
    }

    const remainQty = totalQty - takeQty;

    // Check lock PIN
    const isCreator = payload.accountId && order.createdById === payload.accountId;
    if (order.lockPin && !isCreator) {
      const { lockPin: providedPin } = req.body as any;
      if (!providedPin || providedPin !== order.lockPin) {
        res.status(403).json({ error: "Qulf PIN kodi noto'g'ri" });
        return;
      }
    }

    // Determine split group (base orderId without suffix)
    const baseId = order.splitGroup ?? order.orderId;

    // Count existing parts in this group to find next part number
    const existingParts = await db.query.ordersTable.findMany({
      where: eq(ordersTable.splitGroup, baseId),
    });
    // Parts: original (part 1 or without splitGroup) + any others
    const highestPart = existingParts.reduce((max, p) => Math.max(max, p.splitPart ?? 1), order.splitGroup ? 0 : 1);
    const nextPartNum = highestPart + 1;

    // New remaining order gets ID = "baseId-N"
    const newOrderId = `${baseId}-${nextPartNum}`;

    // Create remaining order as new
    const [remainingOrder] = await db.insert(ordersTable).values({
      orderId: newOrderId,
      status: "new",
      serviceTypeId: order.serviceTypeId,
      serviceTypeName: order.serviceTypeName,
      quantity: String(remainQty),
      unit: order.unit,
      shelf: order.shelf,
      product: order.product,
      notes: order.notes,
      storeId: order.storeId,
      storeName: order.storeName,
      clientId: order.clientId,
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      createdById: order.createdById,
      createdByName: order.createdByName,
      lockPin: null,
      splitGroup: baseId,
      splitPart: nextPartNum,
    }).returning();

    // Accept the original order with taken quantity, mark as part 1 if first split
    const acceptUpdates: any = {
      quantity: String(takeQty),
      status: "accepted",
      acceptedById: payload.accountId ?? null,
      acceptedByName: payload.name ?? null,
      acceptedAt: new Date(),
      lockPin: null,
    };
    if (!order.splitGroup) {
      acceptUpdates.splitGroup = baseId;
      acceptUpdates.splitPart = 1;
    }
    const [acceptedOrder] = await db.update(ordersTable).set(acceptUpdates)
      .where(eq(ordersTable.id, id)).returning();

    io?.to(`store:${order.storeId}`).emit("order:updated", mapOrder(acceptedOrder, true));
    io?.to(`store:${order.storeId}`).emit("order:created", mapOrder(remainingOrder, true));

    res.json({ accepted: mapOrder(acceptedOrder, true), remaining: mapOrder(remainingOrder, true) });
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
    const { quantity, unit, shelf, product, notes, clientId, clientName, clientPhone, status, serviceTypeId } = req.body as {
      quantity?: number;
      unit?: string;
      shelf?: string;
      product?: string;
      notes?: string;
      clientId?: number;
      clientName?: string;
      clientPhone?: string;
      status?: string;
      serviceTypeId?: number;
    };

    const updates: Record<string, unknown> = {};
    if (quantity !== undefined) updates.quantity = String(quantity);
    if (unit !== undefined) updates.unit = unit;
    if (shelf !== undefined) updates.shelf = shelf;
    if (product !== undefined) updates.product = product;
    if (notes !== undefined) updates.notes = notes;
    if (clientId !== undefined) updates.clientId = clientId;
    if (clientName !== undefined) updates.clientName = clientName;
    if (clientPhone !== undefined) updates.clientPhone = clientPhone;
    if (status !== undefined) updates.status = status;
    if (serviceTypeId !== undefined) {
      const svcType = await db.query.serviceTypesTable.findFirst({ where: eq(serviceTypesTable.id, serviceTypeId) });
      if (svcType) {
        updates.serviceTypeId = serviceTypeId;
        updates.serviceTypeName = svcType.name;
      }
    }

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
