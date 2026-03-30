import { Router } from "express";
import { db, accountsTable, storesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticateToken } from "../lib/auth";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload) {
      res.status(401).json({ error: "Ruxsat yo'q" });
      return;
    }

    let accounts;
    if (payload.role === "sudo") {
      accounts = await db.query.accountsTable.findMany({
        where: (t, { ne }) => ne(t.role, "sudo"),
        orderBy: (t, { asc }) => asc(t.createdAt),
      });
    } else if (payload.role === "superadmin" && payload.storeId) {
      accounts = await db.query.accountsTable.findMany({
        where: eq(accountsTable.storeId, payload.storeId),
        orderBy: (t, { asc }) => asc(t.createdAt),
      });
    } else {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }

    const storeIds = [...new Set(accounts.map((a) => a.storeId).filter(Boolean))] as number[];
    const stores = storeIds.length
      ? await db.select({ id: storesTable.id, name: storesTable.name }).from(storesTable)
      : [];
    const storeMap = new Map(stores.map((s) => [s.id, s.name]));

    res.json(
      accounts.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        pin: a.pin,
        storeId: a.storeId,
        storeName: a.storeId ? (storeMap.get(a.storeId) ?? null) : null,
        createdAt: a.createdAt,
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
    if (!payload || (payload.role !== "sudo" && payload.role !== "superadmin")) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }
    const { name, role, pin, storeId } = req.body as {
      name: string;
      role: string;
      pin?: string;
      storeId?: number;
    };

    const effectiveStoreId = payload.role === "superadmin" ? payload.storeId : storeId;

    const [account] = await db
      .insert(accountsTable)
      .values({
        name,
        role: role as "superadmin" | "admin" | "viewer" | "worker",
        pin: pin ?? null,
        storeId: effectiveStoreId ?? null,
      })
      .returning();

    let storeName: string | null = null;
    if (account.storeId) {
      const store = await db.query.storesTable.findFirst({ where: eq(storesTable.id, account.storeId) });
      storeName = store?.name ?? null;
    }

    res.status(201).json({ ...account, storeName });
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
    const { name, role, pin, storeId } = req.body as {
      name?: string;
      role?: string;
      pin?: string;
      storeId?: number;
    };

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (pin !== undefined) updates.pin = pin;
    if (storeId !== undefined && payload.role === "sudo") updates.storeId = storeId;

    const [account] = await db.update(accountsTable).set(updates).where(eq(accountsTable.id, id)).returning();

    let storeName: string | null = null;
    if (account.storeId) {
      const store = await db.query.storesTable.findFirst({ where: eq(storesTable.id, account.storeId) });
      storeName = store?.name ?? null;
    }

    res.json({ ...account, storeName });
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
    await db.delete(accountsTable).where(eq(accountsTable.id, id));
    res.json({ success: true, message: "O'chirildi" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

export default router;
