import { Router } from "express";
import webpush from "web-push";
import { db, pushSubscriptionsTable, notificationRulesTable, accountsTable, serviceTypesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticateToken } from "../lib/auth";

const router = Router();

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:admin@zakaz.uz",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

// GET /push/vapid-key — public key for frontend
router.get("/vapid-key", (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /push/subscribe — save subscription
router.post("/subscribe", authenticateToken, async (req, res) => {
  const payload = (req as any).user;
  const { subscription } = req.body as {
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  };
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    res.status(400).json({ error: "subscription ma'lumotlari to'liq emas" });
    return;
  }
  try {
    // Delete old subscription for same endpoint
    await db.delete(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.endpoint, subscription.endpoint));

    await db.insert(pushSubscriptionsTable).values({
      accountId: payload.accountId,
      storeId: payload.storeId ?? null,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("subscribe error", err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// DELETE /push/subscribe — remove subscription
router.delete("/subscribe", authenticateToken, async (req, res) => {
  const payload = (req as any).user;
  const { endpoint } = req.body as { endpoint?: string };
  try {
    if (endpoint) {
      await db.delete(pushSubscriptionsTable)
        .where(and(
          eq(pushSubscriptionsTable.accountId, payload.accountId),
          eq(pushSubscriptionsTable.endpoint, endpoint),
        ));
    } else {
      await db.delete(pushSubscriptionsTable)
        .where(eq(pushSubscriptionsTable.accountId, payload.accountId));
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Server xatosi" });
  }
});

// GET /push/rules?storeId=X — get notification rules
router.get("/rules", authenticateToken, async (req, res) => {
  const payload = (req as any).user;
  const storeId = parseInt(String(req.query.storeId || payload.storeId));
  if (!["sudo", "superadmin"].includes(payload.role) && payload.role !== "admin") {
    res.status(403).json({ error: "Ruxsat yo'q" });
    return;
  }
  try {
    const rules = await db.query.notificationRulesTable.findMany({
      where: eq(notificationRulesTable.storeId, storeId),
    });
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: "Server xatosi" });
  }
});

// POST /push/rules — create rule
router.post("/rules", authenticateToken, async (req, res) => {
  const payload = (req as any).user;
  const { storeId, serviceTypeId, accountId } = req.body as {
    storeId: number; serviceTypeId: number; accountId: number;
  };
  if (!["sudo", "superadmin"].includes(payload.role)) {
    res.status(403).json({ error: "Faqat superadmin" });
    return;
  }
  try {
    const existing = await db.query.notificationRulesTable.findFirst({
      where: and(
        eq(notificationRulesTable.storeId, storeId),
        eq(notificationRulesTable.serviceTypeId, serviceTypeId),
        eq(notificationRulesTable.accountId, accountId),
      ),
    });
    if (existing) {
      res.json(existing);
      return;
    }
    const [rule] = await db.insert(notificationRulesTable)
      .values({ storeId, serviceTypeId, accountId })
      .returning();
    res.status(201).json(rule);
  } catch (err) {
    res.status(500).json({ error: "Server xatosi" });
  }
});

// DELETE /push/rules/:id
router.delete("/rules/:id", authenticateToken, async (req, res) => {
  const payload = (req as any).user;
  if (!["sudo", "superadmin"].includes(payload.role)) {
    res.status(403).json({ error: "Faqat superadmin" });
    return;
  }
  try {
    await db.delete(notificationRulesTable)
      .where(eq(notificationRulesTable.id, parseInt(req.params.id)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Helper: send push to a specific account for a given service type and store
export async function sendOrderPushNotifications(params: {
  storeId: number;
  serviceTypeId: number;
  serviceTypeName: string;
  orderId: string;
  product?: string | null;
  clientName?: string | null;
}) {
  const { storeId, serviceTypeId, serviceTypeName, orderId, product, clientName } = params;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  try {
    // Find which accounts should be notified for this service type
    const rules = await db.query.notificationRulesTable.findMany({
      where: and(
        eq(notificationRulesTable.storeId, storeId),
        eq(notificationRulesTable.serviceTypeId, serviceTypeId),
      ),
    });

    if (rules.length === 0) return;

    const accountIds = rules.map(r => r.accountId);

    // Get all push subscriptions for these accounts
    const subs = await db.query.pushSubscriptionsTable.findMany({
      where: (t, { inArray }) => inArray(t.accountId, accountIds),
    });

    if (subs.length === 0) return;

    const body = [
      product ? `📦 ${product}` : null,
      clientName ? `👤 ${clientName}` : null,
    ].filter(Boolean).join(" • ") || "Yangi zakaz";

    const payload = JSON.stringify({
      title: `🆕 ${serviceTypeName} — zakaz #${orderId}`,
      body,
      tag: `order-${orderId}`,
      icon: "/icon-192.png",
      badge: "/favicon-32.png",
      data: { orderId, serviceTypeId, storeId },
    });

    const sendPromises = subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired — remove it
          await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, sub.id));
        }
      }
    });
    await Promise.allSettled(sendPromises);
  } catch (err) {
    console.error("sendOrderPushNotifications error", err);
  }
}

export default router;
