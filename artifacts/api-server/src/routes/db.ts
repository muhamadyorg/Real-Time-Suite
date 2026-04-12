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
  "order_templates",
  "service_types",
  "accounts",
  "admin_allowed_service_types",
  "clients",
  "products",
  "orders",
  "account_permissions",
  "store_permission_modes",
  "client_accounts",
  "client_transactions",
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
    const now = new Date();
    // Toshkent vaqti UTC+5
    const tashkentOffset = 5 * 60;
    const tashkentMs = now.getTime() + tashkentOffset * 60 * 1000;
    const t = new Date(tashkentMs);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateLabel = `${pad(t.getUTCDate())}.${pad(t.getUTCMonth()+1)}.${t.getUTCFullYear()}`;
    const timeLabel = `${pad(t.getUTCHours())}-${pad(t.getUTCMinutes())}`;
    const date = `${dateLabel}_${timeLabel}`;
    const datePretty = `${pad(t.getUTCDate())}.${pad(t.getUTCMonth()+1)}.${t.getUTCFullYear()} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())} (Toshkent vaqti)`;
    let totalRows = 0;
    let out = `-- Buyurtma tizimi DB backup\n`;
    out += `-- Sana: ${datePretty}\n`;
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
          // JSONB/JSON columns come as parsed JS objects — serialize to JSON string
          if (typeof v === "object" || Array.isArray(v)) {
            const str = JSON.stringify(v).replace(/\\/g, "\\\\").replace(/'/g, "''");
            return `'${str}'`;
          }
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

// Parse pg_dump COPY blocks → grouped by table name
function parsePgDump(sql: string): Map<string, string[]> {
  const knownTables = new Set(TABLES_ORDERED);
  const byTable = new Map<string, string[]>();
  const lines = sql.split("\n");

  let inCopy = false;
  let table = "";
  let columns: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    const m = line.match(/^COPY\s+(?:public\.)?(\w+)\s+\(([^)]+)\)\s+FROM\s+stdin/i);
    if (m) {
      if (knownTables.has(m[1])) {
        inCopy = true;
        table = m[1];
        columns = m[2].split(",").map(c => c.trim());
        if (!byTable.has(table)) byTable.set(table, []);
      }
      continue;
    }

    if (line === "\\.") { inCopy = false; table = ""; columns = []; continue; }

    if (inCopy && line.length > 0) {
      const vals = line.split("\t").map(v => {
        if (v === "\\N") return "NULL";
        const d = v.replace(/\\\\/g, "\\").replace(/\\n/g, "\n").replace(/\\t/g, "\t");
        return `'${d.replace(/'/g, "''")}'`;
      });
      const colList = columns.map(c => `"${c}"`).join(", ");
      byTable.get(table)!.push(
        `INSERT INTO "${table}" (${colList}) VALUES (${vals.join(", ")}) ON CONFLICT (id) DO NOTHING`
      );
    }
  }
  return byTable;
}

// POST /api/db/import — restore from SQL text
// Supports our own export format AND pg_dump format.
// pg_dump: FK-safe insert order, ON CONFLICT DO NOTHING (keeps existing data).
// Our format: runs statements as-is (includes DELETE + INSERT).
router.post("/import", express.text({ type: "*/*", limit: "100mb" }), async (req, res) => {
  if (!isSudo(req)) { res.status(403).json({ error: "Ruxsat yo'q" }); return; }
  const sqlText = req.body as string;
  if (!sqlText || typeof sqlText !== "string") {
    res.status(400).json({ error: "SQL matn kerak" }); return;
  }

  let statements: string[];
  const isPgDumpFormat =
    /-- PostgreSQL database dump/i.test(sqlText) ||
    /COPY\s+(?:public\.)?\w+\s+\([^)]+\)\s+FROM\s+stdin/i.test(sqlText);

  if (isPgDumpFormat) {
    // Parse COPY blocks, then replay in FK-safe order (TABLES_ORDERED)
    const byTable = parsePgDump(sqlText);
    statements = [];
    for (const tbl of TABLES_ORDERED) {
      const rows = byTable.get(tbl);
      if (rows && rows.length > 0) statements.push(...rows);
    }
  } else {
    // Our own export format
    const cleaned = sqlText
      .split("\n")
      .filter(line =>
        !/SET\s+session_replication_role/i.test(line) &&
        !/ALTER\s+TABLE\s+.+\s+(DISABLE|ENABLE)\s+TRIGGER/i.test(line)
      )
      .join("\n");
    statements = splitSqlStatements(cleaned).filter(s => {
      const up = s.replace(/--[^\n]*/g, "").trim().toUpperCase();
      return up.length > 0 && !up.match(/^--/);
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const stmt of statements) {
      await client.query(stmt);
    }
    await client.query(SEQUENCE_RESET_SQL);
    await client.query("COMMIT");
    res.json({ ok: true, message: `Import muvaffaqiyatli bajarildi (${statements.length} ta amal)` });
  } catch (e: any) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

export default router;
