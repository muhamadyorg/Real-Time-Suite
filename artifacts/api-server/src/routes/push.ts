import { Router } from "express";
import webpush from "web-push";
import { db, pushSubscriptionsTable, notificationRulesTable, accountsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { authenticateToken } from "../lib/auth";

const router = Router();

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:admin@zakaz.uz",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

// GET /push/vapid-key — public key for frontend (no auth)
router.get("/vapid-key", (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /push/subscribe — save subscription
router.post("/subscribe", async (req, res) => {
  const payload = await authenticateToken(req.headers.authorization);
  if (!payload) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }

  const { subscription } = req.body as {
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  };
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    res.status(400).json({ error: "subscription ma'lumotlari to'liq emas" });
    return;
  }
  try {
    await db.delete(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.endpoint, subscription.endpoint));

    await db.insert(pushSubscriptionsTable).values({
      accountId: payload.accountId!,
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
router.delete("/subscribe", async (req, res) => {
  const payload = await authenticateToken(req.headers.authorization);
  if (!payload) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }

  const { endpoint } = req.body as { endpoint?: string };
  try {
    if (endpoint) {
      await db.delete(pushSubscriptionsTable)
        .where(and(
          eq(pushSubscriptionsTable.accountId, payload.accountId!),
          eq(pushSubscriptionsTable.endpoint, endpoint),
        ));
    } else {
      await db.delete(pushSubscriptionsTable)
        .where(eq(pushSubscriptionsTable.accountId, payload.accountId!));
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Server xatosi" });
  }
});

// GET /push/rules?storeId=X
router.get("/rules", async (req, res) => {
  const payload = await authenticateToken(req.headers.authorization);
  if (!payload) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }
  if (!["sudo", "superadmin", "admin"].includes(payload.role)) {
    res.status(403).json({ error: "Ruxsat yo'q" }); return;
  }
  const storeId = parseInt(String(req.query.storeId || payload.storeId));
  if (!storeId) { res.status(400).json({ error: "storeId kerak" }); return; }
  try {
    const rules = await db.query.notificationRulesTable.findMany({
      where: eq(notificationRulesTable.storeId, storeId),
    });
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: "Server xatosi" });
  }
});

// POST /push/rules
router.post("/rules", async (req, res) => {
  const payload = await authenticateToken(req.headers.authorization);
  if (!payload) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }
  if (!["sudo", "superadmin"].includes(payload.role)) {
    res.status(403).json({ error: "Faqat superadmin" }); return;
  }
  const { storeId, serviceTypeId, accountId } = req.body as {
    storeId: number; serviceTypeId: number; accountId: number;
  };
  if (!storeId || !serviceTypeId || !accountId) {
    res.status(400).json({ error: "storeId, serviceTypeId, accountId kerak" }); return;
  }
  try {
    const existing = await db.query.notificationRulesTable.findFirst({
      where: and(
        eq(notificationRulesTable.storeId, storeId),
        eq(notificationRulesTable.serviceTypeId, serviceTypeId),
        eq(notificationRulesTable.accountId, accountId),
      ),
    });
    if (existing) { res.json(existing); return; }
    const [rule] = await db.insert(notificationRulesTable)
      .values({ storeId, serviceTypeId, accountId })
      .returning();
    res.status(201).json(rule);
  } catch (err) {
    res.status(500).json({ error: "Server xatosi" });
  }
});

// DELETE /push/rules/:id
router.delete("/rules/:id", async (req, res) => {
  const payload = await authenticateToken(req.headers.authorization);
  if (!payload) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }
  if (!["sudo", "superadmin"].includes(payload.role)) {
    res.status(403).json({ error: "Faqat superadmin" }); return;
  }
  try {
    await db.delete(notificationRulesTable)
      .where(eq(notificationRulesTable.id, parseInt(req.params.id)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Server xatosi" });
  }
});

// Helper: send push notifications for a new order
// Sends to:
//   1. All subscriptions where account.serviceTypeId = order.serviceTypeId (automatic for workers)
//   2. All subscriptions listed in notification_rules for this store+serviceType (admin overrides)
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
    // 1. Accounts whose serviceTypeId matches (worker auto-subscribe)
    const matchingAccounts = await db.query.accountsTable.findMany({
      where: and(
        eq(accountsTable.storeId, storeId),
        eq(accountsTable.serviceTypeId, serviceTypeId),
      ),
    });
    const autoAccountIds = new Set(matchingAccounts.map(a => a.id));

    // 2. Explicit notification_rules for this store+serviceType
    const rules = await db.query.notificationRulesTable.findMany({
      where: and(
        eq(notificationRulesTable.storeId, storeId),
        eq(notificationRulesTable.serviceTypeId, serviceTypeId),
      ),
    });
    for (const r of rules) autoAccountIds.add(r.accountId);

    if (autoAccountIds.size === 0) return;

    // Find subscriptions for these accounts
    const accountIds = [...autoAccountIds];
    const subs = await db.query.pushSubscriptionsTable.findMany({
      where: (t, { inArray }) => inArray(t.accountId, accountIds),
    });

    if (subs.length === 0) return;

    const body = [
      product ? `📦 ${product}` : null,
      clientName ? `👤 ${clientName}` : null,
    ].filter(Boolean).join(" • ") || "Yangi zakaz";

    const pushPayload = JSON.stringify({
      title: `🆕 ${serviceTypeName} — #${orderId}`,
      body,
      tag: `order-${orderId}`,
      icon: "/icon-192.png",
      badge: "/favicon-32.png",
      data: { orderId, serviceTypeId, storeId },
    });

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            pushPayload,
          );
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await db.delete(pushSubscriptionsTable)
              .where(eq(pushSubscriptionsTable.id, sub.id));
          }
        }
      })
    );
  } catch (err) {
    console.error("sendOrderPushNotifications error", err);
  }
}

export default router;
