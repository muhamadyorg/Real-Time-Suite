import { Router } from "express";
import { db, ordersTable, serviceTypesTable, clientsTable, storesTable } from "@workspace/db";
import { eq, and, desc, sql, ilike, or } from "drizzle-orm";
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

const router = Router();

// GET /orders/summary - must come before /:id
router.get("/summary", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload) {
      res.status(401).json({ error: "Ruxsat yo'q" });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let whereClause = undefined;
    if (payload.role !== "sudo" && payload.storeId) {
      whereClause = eq(ordersTable.storeId, payload.storeId);
    }

    const all = await db.query.ordersTable.findMany({ where: whereClause });

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

    const conditions: ReturnType<typeof eq>[] = [];

    if (payload.role !== "sudo") {
      if (payload.storeId) {
        conditions.push(eq(ordersTable.storeId, payload.storeId));
      }
    } else if (storeId) {
      conditions.push(eq(ordersTable.storeId, parseInt(storeId)));
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
        [o.orderId, o.serviceTypeName, o.clientName, o.clientPhone, o.shelf, o.notes, o.createdByName, o.acceptedByName]
          .some((v) => v && v.toLowerCase().includes(q))
      );
    }

    res.json(
      orders.map((o) => ({
        id: o.id,
        orderId: "#" + o.orderId,
        status: o.status,
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

    // Get store name
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

    const response = {
      id: order.id,
      orderId: "#" + order.orderId,
      status: order.status,
      serviceTypeName: order.serviceTypeName,
      quantity: parseFloat(order.quantity),
      unit: order.unit,
      shelf: order.shelf,
      notes: order.notes,
      storeId: order.storeId,
      storeName: order.storeName,
      clientId: order.clientId,
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      createdByName: order.createdByName,
      acceptedByName: order.acceptedByName,
      acceptedAt: order.acceptedAt,
      readyAt: order.readyAt,
      createdAt: order.createdAt,
    };

    io?.to(`store:${storeId}`).emit("order:created", response);

    res.status(201).json(response);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

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
    res.json({
      id: order.id,
      orderId: "#" + order.orderId,
      status: order.status,
      serviceTypeName: order.serviceTypeName,
      quantity: parseFloat(order.quantity),
      unit: order.unit,
      shelf: order.shelf,
      notes: order.notes,
      storeId: order.storeId,
      storeName: order.storeName,
      clientId: order.clientId,
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      createdByName: order.createdByName,
      acceptedByName: order.acceptedByName,
      acceptedAt: order.acceptedAt,
      readyAt: order.readyAt,
      createdAt: order.createdAt,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

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

    const response = {
      id: order.id,
      orderId: "#" + order.orderId,
      status: order.status,
      serviceTypeName: order.serviceTypeName,
      quantity: parseFloat(order.quantity),
      unit: order.unit,
      shelf: order.shelf,
      notes: order.notes,
      storeId: order.storeId,
      storeName: order.storeName,
      clientId: order.clientId,
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      createdByName: order.createdByName,
      acceptedByName: order.acceptedByName,
      acceptedAt: order.acceptedAt,
      readyAt: order.readyAt,
      createdAt: order.createdAt,
    };

    io?.to(`store:${order.storeId}`).emit("order:updated", response);

    // Telegram notification for client
    if (order.clientId && order.status === "accepted") {
      try {
        const { sendTelegramNotification } = await import("./telegram");
        const client = await db.query.clientsTable.findFirst({ where: eq(clientsTable.id, order.clientId) });
        if (client?.telegramUserId) {
          await sendTelegramNotification(
            client.telegramUserId,
            `⚡️ <b>Buyurtma qabul qilindi!</b>\n\n` +
            `👋 Hurmatli <b>${client.firstName} ${client.lastName}</b>,\n\n` +
            `📦 Buyurtma raqami: <b>${order.orderId}</b>\n` +
            `🛠 Xizmat: <b>${order.serviceTypeName}</b>\n` +
            `🔢 Miqdor: <b>${order.quantity}${order.unit ? " " + order.unit : ""}</b>\n\n` +
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
          await sendTelegramNotification(
            client.telegramUserId,
            `✅ <b>Buyurtmangiz TAYYOR!</b>\n\n` +
            `🎉 Hurmatli <b>${client.firstName} ${client.lastName}</b>,\n\n` +
            `📦 Buyurtma raqami: <b>${order.orderId}</b>\n` +
            `🛠 Xizmat: <b>${order.serviceTypeName}</b>\n` +
            `🔢 Miqdor: <b>${order.quantity}${order.unit ? " " + order.unit : ""}</b>\n\n` +
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
