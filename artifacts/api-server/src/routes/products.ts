import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { authenticateToken } from "../lib/auth";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }

    const { serviceTypeId } = req.query as { serviceTypeId?: string };

    let products;
    if (serviceTypeId) {
      products = await db.query.productsTable.findMany({
        where: eq(productsTable.serviceTypeId, parseInt(serviceTypeId)),
        orderBy: [asc(productsTable.sortOrder), asc(productsTable.id)],
      });
    } else {
      products = await db.query.productsTable.findMany({
        orderBy: [asc(productsTable.serviceTypeId), asc(productsTable.sortOrder), asc(productsTable.id)],
      });
    }

    res.json(products);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || !["sudo", "superadmin"].includes(payload.role)) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }

    const { name, serviceTypeId, sortOrder } = req.body as { name: string; serviceTypeId: number; sortOrder?: number };
    if (!name || !serviceTypeId) {
      res.status(400).json({ error: "Nom va xizmat turi kerak" });
      return;
    }

    const [product] = await db.insert(productsTable).values({
      name,
      serviceTypeId,
      sortOrder: sortOrder ?? 0,
      active: true,
    }).returning();

    res.status(201).json(product);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || !["sudo", "superadmin"].includes(payload.role)) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }

    const id = parseInt(req.params.id);
    const { name, sortOrder, active } = req.body as { name?: string; sortOrder?: number; active?: boolean };

    const updates: Partial<{ name: string; sortOrder: number; active: boolean }> = {};
    if (name !== undefined) updates.name = name;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (active !== undefined) updates.active = active;

    const [updated] = await db.update(productsTable).set(updates).where(eq(productsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Topilmadi" }); return; }

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || !["sudo", "superadmin"].includes(payload.role)) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }

    const id = parseInt(req.params.id);
    const [deleted] = await db.delete(productsTable).where(eq(productsTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Topilmadi" }); return; }

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

export default router;
