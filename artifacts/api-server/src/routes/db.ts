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
// accounts.service_type_id → service_types.id  (so service_types must come before accounts)
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

// Reverse order for DELETE (children first, parents last)
const TABLES_REVERSE = [...TABLES_ORDERED].reverse();

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
    const sizeRes = await pool.query(`
      SELECT pg_size_pretty(
        COALESCE(SUM(pg_total_relation_size(quote_ident(table_name))), 0)::bigint
      ) AS size
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    res.json({ stats, dbSize: sizeRes.rows[0].size });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/db/export — export all data as SQL
// NOTE: Does NOT use session_replication_role (requires superuser).
// Instead: DELETE in reverse FK order, INSERT in FK-safe order.
router.get("/export", async (req, res) => {
  if (!isSudo(req)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }
  try {
    const date = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    let totalRows = 0;
    let out = `-- Buyurtma tizimi DB backup\n`;
    out += `-- Sana: ${new Date().toISOString()}\n`;
    out += `-- Versiya: 1.0\n\n`;

    // DELETE in reverse FK order (children first) — no superuser needed
    out += `-- ===== Eski ma'lumotlarni tozalash =====\n`;
    for (const table of TABLES_REVERSE) {
      out += `DELETE FROM "${table}";\n`;
    }
    out += `\n`;

    // INSERT in FK-safe order (parents first)
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

    out += `-- ===== Sequence reset =====\n`;
    out += SEQUENCE_RESET_SQL + "\n";
    out += `-- Total rows: ${totalRows}\n`;

    res.setHeader("Content-Type", "application/sql");
    res.setHeader("Content-Disposition", `attachment; filename="backup-${date}.sql"`);
    res.send(out);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Split a SQL string into individual statements.
 * Correctly handles $$ dollar-quoted blocks (DO statements, functions, etc.)
 * so that semicolons inside dollar quotes are NOT treated as statement terminators.
 */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inDollarQuote = false;
  let dollarTag = "";
  let i = 0;

  while (i < sql.length) {
    // Detect dollar-quote start (e.g. $$ or $body$)
    if (!inDollarQuote && sql[i] === "$") {
      const rest = sql.slice(i);
      const m = rest.match(/^\$([^$]*)\$/);
      if (m) {
        inDollarQuote = true;
        dollarTag = m[0];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }

    // Detect dollar-quote end
    if (inDollarQuote && sql.slice(i).startsWith(dollarTag)) {
      inDollarQuote = false;
      current += dollarTag;
      i += dollarTag.length;
      dollarTag = "";
      continue;
    }

    // Statement separator (only outside dollar quotes)
    if (!inDollarQuote && sql[i] === ";") {
      current += ";";
      const stmt = current.trim();
      if (stmt.length > 1) statements.push(stmt);
      current = "";
      i++;
      continue;
    }

    current += sql[i];
    i++;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

// POST /api/db/import — restore from SQL text
// Executes each statement individually (guarantees FK-safe sequential order).
// No superuser privileges required.
router.post("/import", express.text({ type: "*/*", limit: "100mb" }), async (req, res) => {
  if (!isSudo(req)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }
  const sqlText = req.body as string;
  if (!sqlText || typeof sqlText !== "string") {
    res.status(400).json({ error: "SQL matn kerak" }); return;
  }

  // Strip lines that require superuser
  const cleaned = sqlText
    .split("\n")
    .filter(line =>
      !/SET\s+session_replication_role/i.test(line) &&
      !/ALTER\s+TABLE\s+.+\s+(DISABLE|ENABLE)\s+TRIGGER/i.test(line)
    )
    .join("\n");

  const statements = splitSqlStatements(cleaned).filter(s => {
    const up = s.replace(/--[^\n]*/g, "").trim().toUpperCase();
    return up.length > 0 && !up.match(/^--/);
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const stmt of statements) {
      await client.query(stmt);
    }

    // Always reset sequences after import
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
