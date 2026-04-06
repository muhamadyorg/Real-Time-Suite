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

const TABLES_ORDERED = [
  "stores",
  "accounts",
  "service_types",
  "clients",
  "products",
  "orders",
  "account_permissions",
  "store_permission_modes",
];

// Dynamically reset all sequences in the public schema.
// Uses pg catalog — automatically covers every serial column, no manual list to maintain.
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
      'SELECT setval(pg_get_serial_sequence(%L, %L), COALESCE((SELECT MAX(id) FROM %I), 1))',
      r.tname, r.cname, r.tname
    );
  END LOOP;
END $$;`;

// GET /api/db/stats
router.get("/stats", async (req, res) => {
  if (!isSudo(req)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }
  try {
    const stats = await Promise.all(
      TABLES_ORDERED.map(async (table) => {
        const result = await pool.query(`SELECT COUNT(*) as count FROM "${table}"`);
        return { table, count: Number(result.rows[0].count) };
      })
    );
    const sizeRes = await pool.query(`SELECT pg_size_pretty(pg_database_size(current_database())) as size`);
    res.json({ stats, dbSize: sizeRes.rows[0].size });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/db/export — export all data as SQL
router.get("/export", async (req, res) => {
  if (!isSudo(req)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }
  try {
    const date = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    let totalRows = 0;
    let out = `-- Buyurtma tizimi DB backup\n`;
    out += `-- Sana: ${new Date().toISOString()}\n`;
    out += `-- Versiya: 1.0\n\n`;

    // Single multi-table TRUNCATE with CASCADE — safe even with FK constraints
    const tableList = TABLES_ORDERED.map(t => `"${t}"`).join(", ");
    out += `TRUNCATE ${tableList} CASCADE;\n\n`;

    // Disable FK trigger checks for fast bulk inserts
    out += `SET session_replication_role = 'replica';\n\n`;

    for (const table of TABLES_ORDERED) {
      const rowsRes = await pool.query(`SELECT * FROM "${table}" ORDER BY id`);
      out += `-- ===== ${table} (${rowsRes.rows.length} ta yozuv) =====\n`;
      totalRows += rowsRes.rows.length;

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
        out += `INSERT INTO "${table}" (${cols}) VALUES (${vals});\n`;
      }
      out += `\n`;
    }

    out += `SET session_replication_role = 'DEFAULT';\n\n`;
    out += `-- ===== Sequence reset (covers all serial columns, no drift) =====\n`;
    out += SEQUENCE_RESET_SQL + "\n";
    out += `-- Total rows: ${totalRows}\n`;

    res.setHeader("Content-Type", "application/sql");
    res.setHeader("Content-Disposition", `attachment; filename="backup-${date}.sql"`);
    res.send(out);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/db/import — restore from SQL text
// Sends entire SQL to PostgreSQL server in one call — server-side parser
// correctly handles semicolons inside string literals, dollar-quoting, etc.
router.post("/import", express.text({ type: "*/*", limit: "100mb" }), async (req, res) => {
  if (!isSudo(req)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }
  const sqlText = req.body as string;
  if (!sqlText || typeof sqlText !== "string") {
    res.status(400).json({ error: "SQL matn kerak" }); return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Pass the entire SQL to the PostgreSQL server in one call.
    // The server-side parser handles semicolons in string literals correctly.
    await client.query(sqlText);

    // Ensure all sequences reflect max IDs — covers every serial column dynamically
    await client.query(SEQUENCE_RESET_SQL);

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
