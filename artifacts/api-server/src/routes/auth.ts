import { Router } from "express";
import { db, accountsTable, storesTable, adminAllowedServiceTypesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { hashPassword, comparePassword, createToken, verifyToken, authenticateToken } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

// Store login (username + password)
router.post("/store-login", async (req, res) => {
  try {
    const { username, password } = req.body as { username: string; password: string };
    if (!username || !password) {
      res.status(400).json({ error: "Username va parol majburiy" });
      return;
    }

    // Check if SUDO login
    if (username === "SUDO") {
      const sudoAccount = await db.query.accountsTable.findFirst({
        where: eq(accountsTable.role, "sudo"),
      });
      if (!sudoAccount || !sudoAccount.passwordHash) {
        res.status(401).json({ error: "Login yoki parol noto'g'ri" });
        return;
      }
      const valid = await comparePassword(password, sudoAccount.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Login yoki parol noto'g'ri" });
        return;
      }
      const token = createToken({ accountId: sudoAccount.id, role: "sudo", name: sudoAccount.name });
      res.json({ token, role: "sudo" });
      return;
    }

    // Check store login
    const store = await db.query.storesTable.findFirst({
      where: eq(storesTable.username, username),
    });
    if (!store) {
      res.status(401).json({ error: "Login yoki parol noto'g'ri" });
      return;
    }
    const valid = await comparePassword(password, store.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Login yoki parol noto'g'ri" });
      return;
    }

    // Find superadmin for this store or create store-level token
    const token = createToken({ storeId: store.id, role: "store", name: store.name });
    res.json({
      token,
      store: {
        id: store.id,
        name: store.name,
        username: store.username,
        createdAt: store.createdAt,
      },
      role: "store",
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

// PIN login (worker/admin/viewer/superadmin within a store)
router.post("/pin-login", async (req, res) => {
  try {
    const { pin, storeId } = req.body as { pin: string; storeId: number };
    if (!pin || !storeId) {
      res.status(400).json({ error: "PIN va do'kon ID majburiy" });
      return;
    }

    // Try exact match first
    let account = await db.query.accountsTable.findFirst({
      where: and(
        eq(accountsTable.pin, pin),
        eq(accountsTable.storeId, storeId)
      ),
    });

    // If not found and entered pin is 4 chars, try matching first 4 chars of stored pin (backward compat)
    if (!account && pin.length === 4) {
      const allAccounts = await db.query.accountsTable.findMany({
        where: eq(accountsTable.storeId, storeId),
      });
      account = allAccounts.find((a) => a.pin && a.pin.startsWith(pin) && a.pin.length > 4) ?? undefined;
    }

    if (!account) {
      res.status(401).json({ error: "PIN noto'g'ri" });
      return;
    }

    const store = await db.query.storesTable.findFirst({
      where: eq(storesTable.id, storeId),
    });

    const allowedRows = await db.query.adminAllowedServiceTypesTable.findMany({
      where: eq(adminAllowedServiceTypesTable.accountId, account.id),
    });
    const allowedServiceTypeIds = allowedRows.map((r) => r.serviceTypeId);

    const token = createToken({
      accountId: account.id,
      storeId: account.storeId ?? undefined,
      serviceTypeId: account.serviceTypeId ?? undefined,
      role: account.role,
      name: account.name,
    });

    res.json({
      token,
      account: {
        id: account.id,
        name: account.name,
        role: account.role,
        pin: account.pin,
        storeId: account.storeId,
        serviceTypeId: account.serviceTypeId,
        allowedServiceTypeIds,
        storeName: store?.name ?? null,
        createdAt: account.createdAt,
      },
      role: account.role,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

router.post("/logout", (_req, res) => {
  res.json({ success: true, message: "Tizimdan chiqildi" });
});

router.get("/me", async (req, res) => {
  try {
    const payload = await authenticateToken(req.headers.authorization);
    if (!payload) {
      res.status(401).json({ error: "Ruxsat yo'q" });
      return;
    }

    if (!payload.accountId) {
      // Store-level token
      res.json({
        id: 0,
        username: "store",
        role: payload.role,
        storeId: payload.storeId ?? null,
        storeName: payload.name ?? null,
        name: payload.name ?? null,
      });
      return;
    }

    const account = await db.query.accountsTable.findFirst({
      where: eq(accountsTable.id, payload.accountId),
    });

    if (!account) {
      res.status(401).json({ error: "Foydalanuvchi topilmadi" });
      return;
    }

    let storeName: string | null = null;
    if (account.storeId) {
      const store = await db.query.storesTable.findFirst({
        where: eq(storesTable.id, account.storeId),
      });
      storeName = store?.name ?? null;
    }

    res.json({
      id: account.id,
      username: account.username ?? account.name,
      role: account.role,
      storeId: account.storeId ?? null,
      storeName,
      name: account.name,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server xatosi" });
  }
});

export default router;
