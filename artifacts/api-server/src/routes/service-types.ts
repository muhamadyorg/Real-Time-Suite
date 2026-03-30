import { Router } from "express";
import { db, serviceTypesTable, storesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticateToken } from "../lib/auth";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    let types;
    if (payload && payload.role === "sudo") {
      types = await db.query.serviceTypesTable.findMany({ orderBy: (t, { asc }) => asc(t.createdAt) });
    } else if (payload && payload.storeId) {
      types = await db.query.serviceTypesTable.findMany({
        where: eq(serviceTypesTable.storeId, payload.storeId),
        orderBy: (t, { asc }) => asc(t.createdAt),
      });
    } else {
      types = await db.query.serviceTypesTable.findMany({ orderBy: (t, { asc }) => asc(t.createdAt) });
    }
    res.json(types);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || (payload.role !== "sudo" && payload.role !== "superadmin")) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }
    const { name, storeId } = req.body as { name: string; storeId?: number };
    const effectiveStoreId = payload.role === "superadmin" ? payload.storeId : storeId;
    const [type] = await db.insert(serviceTypesTable).values({ name, storeId: effectiveStoreId ?? null }).returning();
    res.status(201).json(type);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || (payload.role !== "sudo" && payload.role !== "superadmin")) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }
    const id = parseInt(req.params.id);
    const { name, storeId } = req.body as { name: string; storeId?: number };
    const [type] = await db.update(serviceTypesTable).set({ name, storeId: storeId ?? null }).where(eq(serviceTypesTable.id, id)).returning();
    res.json(type);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || (payload.role !== "sudo" && payload.role !== "superadmin")) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }
    const id = parseInt(req.params.id);
    await db.delete(serviceTypesTable).where(eq(serviceTypesTable.id, id));
    res.json({ success: true, message: "O'chirildi" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

export default router;
