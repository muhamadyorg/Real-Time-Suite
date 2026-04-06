import { Router } from "express";
import express from "express";
import { pool } from "@workspace/db";
import { verifyToken } from "../lib/auth";

const router = Router();

function isSudo(req: express.Request): boolean {
  const auth = req.headers.authorization?.split(" ")[1];
  if (!auth) return false;
  const payload = verifyToken(auth);
  return payload?.role === "sudo";
}

// FK-safe insert order: parent tables first, child tables last
// service_types must come before accounts (accounts.service_type_id → service_types.id)
const TABLES_ORDERED = [
  "stores",
  "service_types",
  "accounts",
  "clients",
  "products",
  "orders",
  "account_permissions",
  "store_permission_modes",
];

// Tables that have a store_id column (for per-store filtering)
const STORE_ID_TABLES = new Set([
  "service_types",
  "accounts",
  "orders",
  "account_permissions",
  "store_permission_modes",
]);

// Dynamically reset all sequences — covers every serial column, no hardcoded list
const SEQUENCE_RESET_SQL = `DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS tname, a.attname AS cname
    FROM pg_class c
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE c.relkind = 'r'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND pg_get_serial_sequence(quote_ident(c.relname), a.attname) IS NOT NULL
  LOOP
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(%L, %L), COALESCE((SELECT MAX(%I) FROM %I), 1))',
      r.tname, r.cname, r.cname, r.tname
    );
  END LOOP;
END $$;`;

// ─── SQL parsing helpers ──────────────────────────────────────────────────────

// Parse SQL VALUES(...) string into array of raw value tokens.
// Handles quoted strings with '' escaping.
function parseSqlValues(valsStr: string): string[] {
  const vals: string[] = [];
  let current = "";
  let i = 0;
  while (i < valsStr.length) {
    const ch = valsStr[i];
    if (ch === "'") {
      current += ch; i++;
      while (i < valsStr.length) {
        const c = valsStr[i];
        if (c === "'" && valsStr[i + 1] === "'") { current += "''"; i += 2; }
        else if (c === "'") { current += c; i++; break; }
        else { current += c; i++; }
      }
    } else if (ch === ",") {
      vals.push(current.trim()); current = ""; i++;
      while (i < valsStr.length && valsStr[i] === " ") i++;
    } else { current += ch; i++; }
  }
  if (current.trim()) vals.push(current.trim());
  return vals;
}

// Extract a named column's value from one INSERT line.
function getInsertColValue(line: string, colName: string): string | null {
  const m = line.match(/^INSERT INTO "\w+" \((.+?)\) VALUES \((.+)\);$/);
  if (!m) return null;
  const cols = m[1].split(", ").map(c => c.replace(/^"|"$/g, ""));
  const idx = cols.indexOf(colName);
  if (idx < 0) return null;
  return parseSqlValues(m[2])[idx] ?? null;
}

// Parse all INSERT lines from backup SQL, grouped by table name.
function parseBackupInserts(sql: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const line of sql.split("\n")) {
    const m = line.match(/^INSERT INTO "(\w+)"/);
    if (!m) continue;
    const t = m[1];
    (result[t] = result[t] || []).push(line);
  }
  return result;
}

// Extract stores list from backup SQL.
function parseStoresFromBackup(sql: string): { id: number; name: string }[] {
  const stores: { id: number; name: string }[] = [];
  for (const line of sql.split("\n")) {
    if (!line.startsWith('INSERT INTO "stores"')) continue;
    const idVal = getInsertColValue(line, "id");
    const nameVal = getInsertColValue(line, "name");
    if (!idVal || !nameVal) continue;
    const id = parseInt(idVal);
    const name = nameVal.replace(/^'|'$/g, "").replace(/''/g, "'");
    if (!isNaN(id)) stores.push({ id, name });
  }
  return stores;
}

// Filter INSERT lines by store_id membership.
function filterByStoreId(lines: string[], ids: Set<number>): string[] {
  return lines.filter(line => {
    const val = getInsertColValue(line, "store_id");
    if (val === null) return true;
    if (val === "NULL") return false;
    return ids.has(parseInt(val));
  });
}

// Build selective SQL for specific store IDs from backup inserts.
function buildSelectiveImportSql(
  inserts: Record<string, string[]>,
  storeIds: number[]
): string {
  const ids = new Set(storeIds);
  const idsStr = storeIds.join(", ");
  let sql = "";

  // Delete selected stores' existing data (reverse FK order, no cascade issues)
  sql += `-- Delete selected stores' existing data\n`;
  sql += `DELETE FROM "store_permission_modes" WHERE store_id IN (${idsStr});\n`;
  sql += `DELETE FROM "account_permissions" WHERE store_id IN (${idsStr});\n`;
  sql += `DELETE FROM "orders" WHERE store_id IN (${idsStr});\n`;
  sql += `DELETE FROM "accounts" WHERE store_id IN (${idsStr});\n`;
  sql += `DELETE FROM "service_types" WHERE store_id IN (${idsStr});\n`; // CASCADE removes products
  sql += `DELETE FROM "stores" WHERE id IN (${idsStr});\n\n`;

  // Collect service_type IDs for selected stores from backup (for products filtering)
  const stypeIds = new Set<number>();
  for (const line of (inserts["service_types"] || [])) {
    const sid = getInsertColValue(line, "store_id");
    const tid = getInsertColValue(line, "id");
    if (sid && tid && ids.has(parseInt(sid))) stypeIds.add(parseInt(tid));
  }

  // Collect client IDs referenced by selected stores' orders (for ON CONFLICT handling)
  const neededClientIds = new Set<number>();
  for (const line of (inserts["orders"] || [])) {
    const sid = getInsertColValue(line, "store_id");
    const cid = getInsertColValue(line, "client_id");
    if (sid && cid && ids.has(parseInt(sid))) neededClientIds.add(parseInt(cid));
  }

  // Insert in FK-safe order
  for (const table of TABLES_ORDERED) {
    const rows = inserts[table] || [];
    let filtered: string[] = [];

    if (table === "stores") {
      filtered = rows.filter(l => {
        const v = getInsertColValue(l, "id");
        return v && ids.has(parseInt(v));
      });
    } else if (table === "clients") {
      // Only insert clients referenced by selected orders; use ON CONFLICT DO NOTHING
      // to avoid overwriting existing clients
      filtered = rows
        .filter(l => {
          const v = getInsertColValue(l, "id");
          return v && neededClientIds.has(parseInt(v));
        })
        .map(l => l.replace(
          /^(INSERT INTO "clients" )(.+)$/,
          "$1$2 ON CONFLICT (id) DO NOTHING"
        ));
    } else if (table === "products") {
      filtered = rows.filter(l => {
        const v = getInsertColValue(l, "service_type_id");
        return v && stypeIds.has(parseInt(v));
      });
    } else if (STORE_ID_TABLES.has(table)) {
      filtered = filterByStoreId(rows, ids);
    }

    if (filtered.length) sql += filtered.join("\n") + "\n\n";
  }

  return sql;
}

// ─── GET /api/db/stats ────────────────────────────────────────────────────────

router.get("/stats", async (req, res) => {
  if (!isSudo(req)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }
  try {
    const stats = await Promise.all(
      TABLES_ORDERED.map(async (table) => {
        const r = await pool.query(`SELECT COUNT(*) AS count FROM "${table}"`);
        return { table, count: Number(r.rows[0].count) };
      })
    );
    const sizeRes = await pool.query(`
      SELECT pg_size_pretty(
        COALESCE(SUM(pg_total_relation_size(quote_ident(table_name))), 0)::bigint
      ) AS size
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    // Also return stores list for per-store panel
    const storesRes = await pool.query(`SELECT id, name FROM "stores" ORDER BY id`);
    res.json({ stats, dbSize: sizeRes.rows[0].size, stores: storesRes.rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── GET /api/db/export?storeId=X ────────────────────────────────────────────

router.get("/export", async (req, res) => {
  if (!isSudo(req)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }
  const storeId = req.query.storeId ? parseInt(req.query.storeId as string) : null;
  const isFiltered = storeId !== null && !isNaN(storeId);

  try {
    const date = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    let storeName = "all";
    if (isFiltered) {
      const sr = await pool.query(`SELECT name FROM "stores" WHERE id = $1`, [storeId]);
      storeName = sr.rows[0]?.name?.replace(/[^a-zA-Z0-9]/g, "_") ?? `store_${storeId}`;
    }

    let totalRows = 0;
    let out = `-- Buyurtma tizimi DB backup\n`;
    out += `-- Sana: ${new Date().toISOString()}\n`;
    out += isFiltered
      ? `-- Do'kon: ${storeName} (id=${storeId})\n\n`
      : `-- Versiya: 1.0\n\n`;

    if (isFiltered) {
      // Per-store: DELETE only this store's data (reverse FK)
      out += `DELETE FROM "store_permission_modes" WHERE store_id = ${storeId};\n`;
      out += `DELETE FROM "account_permissions" WHERE store_id = ${storeId};\n`;
      out += `DELETE FROM "orders" WHERE store_id = ${storeId};\n`;
      out += `DELETE FROM "accounts" WHERE store_id = ${storeId};\n`;
      out += `DELETE FROM "service_types" WHERE store_id = ${storeId};\n`; // CASCADE → products
      out += `DELETE FROM "stores" WHERE id = ${storeId};\n\n`;
    } else {
      // Full backup: DELETE all in reverse FK order
      for (const table of [...TABLES_ORDERED].reverse()) {
        out += `DELETE FROM "${table}";\n`;
      }
      out += "\n";
    }

    for (const table of TABLES_ORDERED) {
      let query: string;
      if (!isFiltered) {
        query = `SELECT * FROM "${table}" ORDER BY id`;
      } else if (table === "stores") {
        query = `SELECT * FROM "stores" WHERE id = ${storeId}`;
      } else if (STORE_ID_TABLES.has(table)) {
        query = `SELECT * FROM "${table}" WHERE store_id = ${storeId} ORDER BY id`;
      } else if (table === "products") {
        query = `SELECT * FROM "products" WHERE service_type_id IN (
          SELECT id FROM service_types WHERE store_id = ${storeId}
        ) ORDER BY id`;
      } else if (table === "clients") {
        // Only clients referenced by this store's orders
        query = `SELECT * FROM "clients" WHERE id IN (
          SELECT DISTINCT client_id FROM orders WHERE store_id = ${storeId}
        ) ORDER BY id`;
      } else {
        query = `SELECT * FROM "${table}" ORDER BY id`;
      }

      const rowsRes = await pool.query(query);
      totalRows += rowsRes.rows.length;
      if (!rowsRes.rows.length) continue;

      out += `-- ===== ${table} (${rowsRes.rows.length} ta yozuv) =====\n`;
      for (const row of rowsRes.rows) {
        const cols = Object.keys(row).map(c => `"${c}"`).join(", ");
        const vals = Object.values(row).map(v => {
          if (v === null || v === undefined) return "NULL";
          if (typeof v === "number") return v.toString();
          if (typeof v === "boolean") return v ? "true" : "false";
          if (v instanceof Date) return `'${v.toISOString()}'`;
          const str = String(v).replace(/\\/g, "\\\\").replace(/'/g, "''");
          return `'${str}'`;
        }).join(", ");
        // Clients use ON CONFLICT to avoid overwriting when merging stores
        if (table === "clients" && isFiltered) {
          out += `INSERT INTO "${table}" (${cols}) VALUES (${vals}) ON CONFLICT (id) DO NOTHING;\n`;
        } else {
          out += `INSERT INTO "${table}" (${cols}) VALUES (${vals});\n`;
        }
      }
      out += "\n";
    }

    out += `-- ===== Sequence reset =====\n${SEQUENCE_RESET_SQL}\n`;
    out += `-- Total rows: ${totalRows}\n`;

    const filename = isFiltered ? `backup-${storeName}-${date}.sql` : `backup-${date}.sql`;
    res.setHeader("Content-Type", "application/sql");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(out);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── POST /api/db/import/preview ─────────────────────────────────────────────

router.post(
  "/import/preview",
  express.text({ type: "*/*", limit: "100mb" }),
  (req, res) => {
    if (!isSudo(req)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }
    const stores = parseStoresFromBackup(req.body as string);
    res.json({ stores });
  }
);

// ─── POST /api/db/import ─────────────────────────────────────────────────────
// Optional header: X-Store-Ids: "1,2,3" — import only these stores

router.post("/import", express.text({ type: "*/*", limit: "100mb" }), async (req, res) => {
  if (!isSudo(req)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }
  const sqlText = req.body as string;
  if (!sqlText || typeof sqlText !== "string") {
    res.status(400).json({ error: "SQL matn kerak" }); return;
  }

  // Strip session_replication_role (requires superuser on some setups)
  const cleanedSql = sqlText
    .split("\n")
    .filter(line => !/SET\s+session_replication_role/i.test(line))
    .join("\n");

  // Optional selective import: only specified store IDs
  const storeIdsHeader = req.headers["x-store-ids"] as string | undefined;
  const storeIds = storeIdsHeader
    ? storeIdsHeader.split(",").map(Number).filter(n => !isNaN(n) && n > 0)
    : null;

  const finalSql = (storeIds && storeIds.length > 0)
    ? buildSelectiveImportSql(parseBackupInserts(cleanedSql), storeIds)
    : cleanedSql;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const table of TABLES_ORDERED) {
      await client.query(`ALTER TABLE "${table}" DISABLE TRIGGER ALL`);
    }
    await client.query(finalSql);
    await client.query(SEQUENCE_RESET_SQL);
    for (const table of TABLES_ORDERED) {
      await client.query(`ALTER TABLE "${table}" ENABLE TRIGGER ALL`);
    }
    await client.query("COMMIT");
    res.json({ ok: true, message: "Import muvaffaqiyatli bajarildi" });
  } catch (e: any) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

export default router;
