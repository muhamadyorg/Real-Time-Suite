import { Router } from "express";
import { db, storesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticateToken } from "../lib/auth";
import type { Server as SocketServer } from "socket.io";

let io: SocketServer | undefined;
export function setSettingsSocketIO(socketIO: SocketServer) {
  io = socketIO;
}

const router = Router();

// GET /settings — joriy do'kon sozlamalarini qaytaradi (barcha rollar)
router.get("/", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }

    const storeId = payload.storeId;
    if (!storeId) { res.status(403).json({ error: "Do'kon aniqlanmadi" }); return; }

    const store = await db.query.storesTable.findFirst({ where: eq(storesTable.id, storeId) });
    if (!store) { res.status(404).json({ error: "Do'kon topilmadi" }); return; }

    res.json({
      showPinsToAdmins: store.showPinsToAdmins,
      canAdminAnalyze: store.canAdminAnalyze,
      canAdminDeleteOrders: store.canAdminDeleteOrders,
      canAdminPrint: store.canAdminPrint,
      canAdminEditOrders: store.canAdminEditOrders,
      canAdminMarkDelivered: store.canAdminMarkDelivered,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// PUT /settings — sozlamalarni yangilaydi (faqat superadmin)
router.put("/", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || (payload.role !== "superadmin" && payload.role !== "sudo")) {
      res.status(403).json({ error: "Ruxsat yo'q — faqat superadmin" });
      return;
    }

    const storeId = payload.storeId;
    if (!storeId) { res.status(403).json({ error: "Do'kon aniqlanmadi" }); return; }

    const { showPinsToAdmins, canAdminAnalyze, canAdminDeleteOrders, canAdminPrint, canAdminEditOrders, canAdminMarkDelivered } = req.body as Record<string, boolean>;

    const updates: Record<string, boolean> = {};
    if (typeof showPinsToAdmins === "boolean")     updates.showPinsToAdmins     = showPinsToAdmins;
    if (typeof canAdminAnalyze === "boolean")      updates.canAdminAnalyze      = canAdminAnalyze;
    if (typeof canAdminDeleteOrders === "boolean") updates.canAdminDeleteOrders  = canAdminDeleteOrders;
    if (typeof canAdminPrint === "boolean")        updates.canAdminPrint        = canAdminPrint;
    if (typeof canAdminEditOrders === "boolean")   updates.canAdminEditOrders   = canAdminEditOrders;
    if (typeof canAdminMarkDelivered === "boolean") updates.canAdminMarkDelivered = canAdminMarkDelivered;

    const [store] = await db.update(storesTable).set(updates).where(eq(storesTable.id, storeId)).returning();

    const settings = {
      showPinsToAdmins: store.showPinsToAdmins,
      canAdminAnalyze: store.canAdminAnalyze,
      canAdminDeleteOrders: store.canAdminDeleteOrders,
      canAdminPrint: store.canAdminPrint,
      canAdminEditOrders: store.canAdminEditOrders,
      canAdminMarkDelivered: store.canAdminMarkDelivered,
    };

    // Real-time — do'konga ulangan barcha clientlarga jo'natamiz
    io?.to(`store:${storeId}`).emit("settings:updated", settings);

    res.json(settings);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

export default router;
