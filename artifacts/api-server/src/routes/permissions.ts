import { Router } from "express";
import { db, accountPermissionsTable, accountsTable, PERMISSION_KEYS } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { verifyToken } from "../lib/auth";

const router = Router();

function isSuperUser(role: string) {
  return role === "sudo" || role === "superadmin";
}

// GET /api/permissions/me — current user's permission keys
router.get("/me", async (req, res) => {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }
  const payload = verifyToken(auth);
  if (!payload) { res.status(401).json({ error: "Token yaroqsiz" }); return; }

  // sudo and superadmin have all permissions
  if (isSuperUser(payload.role)) {
    res.json({ permissions: [...PERMISSION_KEYS] }); return;
  }

  if (!payload.accountId || !payload.storeId) {
    res.json({ permissions: [] }); return;
  }

  const rows = await db.select({ permissionKey: accountPermissionsTable.permissionKey })
    .from(accountPermissionsTable)
    .where(and(
      eq(accountPermissionsTable.accountId, payload.accountId),
      eq(accountPermissionsTable.storeId, payload.storeId)
    ));

  res.json({ permissions: rows.map(r => r.permissionKey) });
});

// GET /api/permissions?storeId=X — list all (accountId, permissionKey) for a store (sudo/superadmin only)
router.get("/", async (req, res) => {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }
  const payload = verifyToken(auth);
  if (!payload || !isSuperUser(payload.role)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }

  const storeId = payload.role === "sudo"
    ? parseInt(req.query.storeId as string)
    : payload.storeId;

  if (!storeId) { res.status(400).json({ error: "storeId kerak" }); return; }

  const rows = await db.select({
    accountId: accountPermissionsTable.accountId,
    permissionKey: accountPermissionsTable.permissionKey,
  }).from(accountPermissionsTable)
    .where(eq(accountPermissionsTable.storeId, storeId));

  res.json(rows);
});

// POST /api/permissions — grant permission to a user
router.post("/", async (req, res) => {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }
  const payload = verifyToken(auth);
  if (!payload || !isSuperUser(payload.role)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }

  const { accountId, permissionKey, storeId: bodyStoreId } = req.body as { accountId: number; permissionKey: string; storeId?: number };

  if (!accountId || !permissionKey) { res.status(400).json({ error: "accountId va permissionKey kerak" }); return; }
  if (!(PERMISSION_KEYS as readonly string[]).includes(permissionKey)) {
    res.status(400).json({ error: "Noto'g'ri permissionKey" }); return;
  }

  const storeId = payload.role === "sudo" ? (bodyStoreId ?? payload.storeId) : payload.storeId;
  if (!storeId) { res.status(400).json({ error: "storeId kerak" }); return; }

  // Ensure account belongs to this store (or is a special account)
  const account = await db.query.accountsTable.findFirst({
    where: and(eq(accountsTable.id, accountId), eq(accountsTable.storeId, storeId))
  });
  if (!account) { res.status(404).json({ error: "Foydalanuvchi topilmadi" }); return; }

  await db.insert(accountPermissionsTable)
    .values({ accountId, permissionKey, storeId })
    .onConflictDoNothing();

  res.json({ ok: true });
});

// DELETE /api/permissions/:accountId/:permissionKey — revoke permission
router.delete("/:accountId/:permissionKey", async (req, res) => {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }
  const payload = verifyToken(auth);
  if (!payload || !isSuperUser(payload.role)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }

  const accountId = parseInt(req.params.accountId);
  const { permissionKey } = req.params;
  const storeId = payload.role === "sudo"
    ? parseInt(req.query.storeId as string) || payload.storeId
    : payload.storeId;

  if (!storeId) { res.status(400).json({ error: "storeId kerak" }); return; }

  await db.delete(accountPermissionsTable).where(and(
    eq(accountPermissionsTable.accountId, accountId),
    eq(accountPermissionsTable.permissionKey, permissionKey),
    eq(accountPermissionsTable.storeId, storeId)
  ));

  res.json({ ok: true });
});

export default router;
