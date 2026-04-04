import { Router } from "express";
import { db, accountPermissionsTable, accountsTable, storePermissionModesTable, PERMISSION_KEYS } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { verifyToken } from "../lib/auth";
import type { PermissionMode } from "@workspace/db";

const router = Router();

function isSuperUser(role: string) {
  return role === "sudo" || role === "superadmin";
}

// GET /api/permissions/me — current user's effective permission keys
router.get("/me", async (req, res) => {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }
  const payload = verifyToken(auth);
  if (!payload) { res.status(401).json({ error: "Token yaroqsiz" }); return; }

  // sudo and superadmin always have all permissions
  if (isSuperUser(payload.role)) {
    res.json({ permissions: [...PERMISSION_KEYS] }); return;
  }

  if (!payload.accountId || !payload.storeId) {
    res.json({ permissions: [] }); return;
  }

  const storeId = payload.storeId;
  const accountId = payload.accountId;

  // Get all modes for this store
  const modes = await db.select().from(storePermissionModesTable)
    .where(eq(storePermissionModesTable.storeId, storeId));

  // Get this user's explicit entries
  const explicitPerms = await db.select({ permissionKey: accountPermissionsTable.permissionKey })
    .from(accountPermissionsTable)
    .where(and(
      eq(accountPermissionsTable.accountId, accountId),
      eq(accountPermissionsTable.storeId, storeId)
    ));
  const explicitSet = new Set(explicitPerms.map(p => p.permissionKey));

  const granted: string[] = [];
  for (const key of PERMISSION_KEYS) {
    const modeRow = modes.find(m => m.permissionKey === key);
    const mode: PermissionMode = (modeRow?.mode as PermissionMode) ?? "some";

    if (mode === "none") {
      // Nobody
    } else if (mode === "some") {
      // Only explicitly listed (whitelist)
      if (explicitSet.has(key)) granted.push(key);
    } else if (mode === "all") {
      // Everyone except explicitly listed (blacklist)
      if (!explicitSet.has(key)) granted.push(key);
    }
  }

  res.json({ permissions: granted });
});

// GET /api/permissions?storeId=X — list all entries + modes for a store (sudo/superadmin only)
router.get("/", async (req, res) => {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }
  const payload = verifyToken(auth);
  if (!payload || !isSuperUser(payload.role)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }

  const storeId = payload.role === "sudo"
    ? parseInt(req.query.storeId as string)
    : payload.storeId;

  if (!storeId) { res.status(400).json({ error: "storeId kerak" }); return; }

  const [perms, modes] = await Promise.all([
    db.select({ accountId: accountPermissionsTable.accountId, permissionKey: accountPermissionsTable.permissionKey })
      .from(accountPermissionsTable)
      .where(eq(accountPermissionsTable.storeId, storeId)),
    db.select({ permissionKey: storePermissionModesTable.permissionKey, mode: storePermissionModesTable.mode })
      .from(storePermissionModesTable)
      .where(eq(storePermissionModesTable.storeId, storeId)),
  ]);

  res.json({ perms, modes });
});

// PUT /api/permissions/mode — set mode for a permission
router.put("/mode", async (req, res) => {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }
  const payload = verifyToken(auth);
  if (!payload || !isSuperUser(payload.role)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }

  const { permissionKey, mode, storeId: bodyStoreId } = req.body as { permissionKey: string; mode: PermissionMode; storeId?: number };
  if (!permissionKey || !mode) { res.status(400).json({ error: "permissionKey va mode kerak" }); return; }
  if (!(PERMISSION_KEYS as readonly string[]).includes(permissionKey)) { res.status(400).json({ error: "Noto'g'ri permissionKey" }); return; }
  if (!["none", "some", "all"].includes(mode)) { res.status(400).json({ error: "Mode: none | some | all bo'lishi kerak" }); return; }

  const storeId = payload.role === "sudo" ? (bodyStoreId ?? payload.storeId) : payload.storeId;
  if (!storeId) { res.status(400).json({ error: "storeId kerak" }); return; }

  await db.insert(storePermissionModesTable)
    .values({ storeId, permissionKey, mode, updatedAt: new Date() })
    .onConflictDoUpdate({ target: [storePermissionModesTable.storeId, storePermissionModesTable.permissionKey], set: { mode, updatedAt: new Date() } });

  res.json({ ok: true, storeId, permissionKey, mode });
});

// POST /api/permissions — add user to a permission (whitelist or blacklist entry)
router.post("/", async (req, res) => {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) { res.status(401).json({ error: "Ruxsat yo'q" }); return; }
  const payload = verifyToken(auth);
  if (!payload || !isSuperUser(payload.role)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }

  const { accountId, permissionKey, storeId: bodyStoreId } = req.body as { accountId: number; permissionKey: string; storeId?: number };
  if (!accountId || !permissionKey) { res.status(400).json({ error: "accountId va permissionKey kerak" }); return; }
  if (!(PERMISSION_KEYS as readonly string[]).includes(permissionKey)) { res.status(400).json({ error: "Noto'g'ri permissionKey" }); return; }

  const storeId = payload.role === "sudo" ? (bodyStoreId ?? payload.storeId) : payload.storeId;
  if (!storeId) { res.status(400).json({ error: "storeId kerak" }); return; }

  const account = await db.query.accountsTable.findFirst({
    where: and(eq(accountsTable.id, accountId), eq(accountsTable.storeId, storeId))
  });
  if (!account) { res.status(404).json({ error: "Foydalanuvchi topilmadi" }); return; }

  await db.insert(accountPermissionsTable)
    .values({ accountId, permissionKey, storeId })
    .onConflictDoNothing();

  res.json({ ok: true });
});

// DELETE /api/permissions/:accountId/:permissionKey — remove user from a permission entry
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
