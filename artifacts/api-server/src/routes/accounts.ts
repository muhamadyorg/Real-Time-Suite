import { Router } from "express";
import { db, accountsTable, storesTable, ordersTable, adminAllowedServiceTypesTable, serviceTypesTable } from "@workspace/db";
import { eq, and, sql, ne, inArray } from "drizzle-orm";
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

    const accountIds = accounts.map((a) => a.id);
    const allowedRows = accountIds.length
      ? await db.query.adminAllowedServiceTypesTable.findMany({
          where: inArray(adminAllowedServiceTypesTable.accountId, accountIds),
        })
      : [];
    const allowedMap = new Map<number, number[]>();
    for (const row of allowedRows) {
      const arr = allowedMap.get(row.accountId) ?? [];
      arr.push(row.serviceTypeId);
      allowedMap.set(row.accountId, arr);
    }

    res.json(
      accounts.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        pin: a.pin,
        storeId: a.storeId,
        storeName: a.storeId ? (storeMap.get(a.storeId) ?? null) : null,
        serviceTypeId: a.serviceTypeId,
        allowedServiceTypeIds: allowedMap.get(a.id) ?? [],
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
    const { name, role, pin, storeId, serviceTypeId } = req.body as {
      name: string;
      role: string;
      pin?: string;
      storeId?: number;
      serviceTypeId?: number;
    };

    const effectiveStoreId = payload.role === "superadmin" ? payload.storeId : storeId;

    if (pin && effectiveStoreId) {
      const existing = await db.query.accountsTable.findFirst({
        where: and(eq(accountsTable.pin, pin), eq(accountsTable.storeId, effectiveStoreId)),
      });
      if (existing) {
        res.status(409).json({ error: "Bu PIN kod allaqachon boshqa foydalanuvchiga tegishli. Iltimos, boshqa PIN kod qo'ying." });
        return;
      }
    }

    const [account] = await db
      .insert(accountsTable)
      .values({
        name,
        role: role as "superadmin" | "admin" | "viewer" | "worker",
        pin: pin ?? null,
        storeId: effectiveStoreId ?? null,
        serviceTypeId: serviceTypeId ?? null,
      })
      .returning();

    let storeName: string | null = null;
    if (account.storeId) {
      const store = await db.query.storesTable.findFirst({ where: eq(storesTable.id, account.storeId) });
      storeName = store?.name ?? null;
    }

    res.status(201).json({ ...account, storeName, allowedServiceTypeIds: [] });
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
    const { name, role, pin, storeId, serviceTypeId } = req.body as {
      name?: string;
      role?: string;
      pin?: string;
      storeId?: number;
      serviceTypeId?: number | null;
    };

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (pin !== undefined) updates.pin = pin;
    if (storeId !== undefined && payload.role === "sudo") updates.storeId = storeId;
    if (serviceTypeId !== undefined) updates.serviceTypeId = serviceTypeId;

    if (pin) {
      const currentAccount = await db.query.accountsTable.findFirst({ where: eq(accountsTable.id, id) });
      const targetStoreId = (storeId !== undefined && payload.role === "sudo") ? storeId : currentAccount?.storeId;
      if (targetStoreId) {
        const existing = await db.query.accountsTable.findFirst({
          where: and(eq(accountsTable.pin, pin), eq(accountsTable.storeId, targetStoreId), ne(accountsTable.id, id)),
        });
        if (existing) {
          res.status(409).json({ error: "Bu PIN kod allaqachon boshqa foydalanuvchiga tegishli. Iltimos, boshqa PIN kod qo'ying." });
          return;
        }
      }
    }

    const [account] = await db.update(accountsTable).set(updates).where(eq(accountsTable.id, id)).returning();

    let storeName: string | null = null;
    if (account.storeId) {
      const store = await db.query.storesTable.findFirst({ where: eq(storesTable.id, account.storeId) });
      storeName = store?.name ?? null;
    }

    const allowedRows = await db.query.adminAllowedServiceTypesTable.findMany({
      where: eq(adminAllowedServiceTypesTable.accountId, id),
    });

    res.json({ ...account, storeName, allowedServiceTypeIds: allowedRows.map((r) => r.serviceTypeId) });
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
    await db.update(ordersTable).set({ createdById: sql`NULL` }).where(eq(ordersTable.createdById, id));
    await db.update(ordersTable).set({ acceptedById: sql`NULL` }).where(eq(ordersTable.acceptedById, id));
    await db.delete(accountsTable).where(eq(accountsTable.id, id));
    res.json({ success: true, message: "O'chirildi" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// GET /accounts/:id/service-types — get allowed service types for an admin
router.get("/:id/service-types", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || (payload.role !== "sudo" && payload.role !== "superadmin")) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }
    const id = parseInt(req.params.id);
    const rows = await db.query.adminAllowedServiceTypesTable.findMany({
      where: eq(adminAllowedServiceTypesTable.accountId, id),
    });
    res.json(rows.map((r) => r.serviceTypeId));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// PUT /accounts/:id/service-types — replace all allowed service types for an admin
router.put("/:id/service-types", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || (payload.role !== "sudo" && payload.role !== "superadmin")) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }
    const id = parseInt(req.params.id);
    const { serviceTypeIds } = req.body as { serviceTypeIds: number[] };

    await db.delete(adminAllowedServiceTypesTable).where(eq(adminAllowedServiceTypesTable.accountId, id));

    if (serviceTypeIds && serviceTypeIds.length > 0) {
      await db.insert(adminAllowedServiceTypesTable).values(
        serviceTypeIds.map((stid) => ({ accountId: id, serviceTypeId: stid }))
      );
    }

    res.json({ success: true, allowedServiceTypeIds: serviceTypeIds ?? [] });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// PATCH /accounts/:id/no-timer — superadmin/sudo uchun timer o'chirish/yoqish
router.patch("/:id/no-timer", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload || (payload.role !== "sudo" && payload.role !== "superadmin")) {
      res.status(403).json({ error: "Ruxsat yo'q" });
      return;
    }
    const id = parseInt(req.params.id);
    const { noTimer } = req.body as { noTimer: boolean };
    const [updated] = await db.update(accountsTable)
      .set({ noTimer: !!noTimer })
      .where(eq(accountsTable.id, id))
      .returning();
    res.json({ success: true, noTimer: updated.noTimer });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

export default router;
